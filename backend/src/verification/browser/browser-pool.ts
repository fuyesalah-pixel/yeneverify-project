// ============================================================
// Yene Verify — Headless Browser Pool
//
// One shared Chromium instance for every JS-rendered bank page
// (Telebirr today; future banks reuse it). Bounded by a tiny
// inline semaphore per-pool: no worker threads, no npm dep.
//
// Contract:
//   page = await pool.getPage()   // acquires; may launch browser
//   ... use the page ...
//   await page.close()            // caller closes the page
//   pool.release()                // caller MUST release (adapter finally)
//
// getPage() failures release the slot themselves so callers never
// double-release on a failed acquire.
// ============================================================

import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { Browser, Page } from 'puppeteer';
import { AppConfigService } from '../../config/config.service';

/**
 * Minimal counting semaphore: bounds concurrent page sessions.
 * FIFO queue of pending acquirers, no timers needed.
 */
export class Semaphore {
  private readonly queue: (() => void)[] = [];
  private active = 0;

  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active += 1;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active += 1;
  }

  release(): void {
    if (this.active > 0) {
      this.active -= 1;
    }
    const next = this.queue.shift();
    next?.();
  }

  /** Active + waiting — diagnostics/tests. */
  get load(): number {
    return this.active + this.queue.length;
  }
}

const LAUNCH_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];

// puppeteer is imported lazily (never at module load): its ESM
// bundle breaks plain require, and unit tests everywhere else
// construct adapters with mocked pools that never launch.
let puppeteerModule: typeof import('puppeteer') | null = null;

async function loadPuppeteer(): Promise<typeof import('puppeteer')> {
  puppeteerModule ??= await import('puppeteer');
  return puppeteerModule;
}

@Injectable()
export class BrowserPool implements OnModuleDestroy {
  private browser: Browser | null = null;
  private readonly semaphore: Semaphore;
  /** Set during launch to collapse concurrent first-launches into one. */
  private launching: Promise<Browser> | null = null;

  constructor(private readonly config: AppConfigService) {
    this.semaphore = new Semaphore(config.telebirr.maxConcurrent);
  }

  /** Acquire a session slot and return a fresh page. Throws if launch fails (slot auto-released). */
  async getPage(): Promise<Page> {
    await this.semaphore.acquire();
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      await page.setUserAgent(this.config.bankAdapters.userAgent);
      page.setDefaultTimeout(this.config.bankAdapters.timeoutMs); // void — sync setter
      return page;
    } catch (err) {
      this.semaphore.release();
      throw err;
    }
  }

  /** Release a session slot after page.close(). */
  release(): void {
    this.semaphore.release();
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }
    this.browser = null;
    if (!this.launching) {
      // Assign the promise synchronously so concurrent first-callers
      // share one launch (and never leak a second browser).
      this.launching = (async () => {
        const puppeteer = await loadPuppeteer();
        return puppeteer.launch({ headless: true, args: LAUNCH_ARGS });
      })()
        .then((browser) => {
          this.browser = browser;
          return browser;
        })
        .finally(() => {
          this.launching = null;
        });
    }
    return this.launching;
  }

  async health(): Promise<boolean> {
    try {
      const page = await this.getPage();
      await page.close().catch(() => {});
      this.release();
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    const browser = this.browser;
    this.browser = null;
    this.launching = null;
    await browser?.close().catch(() => {});
  }
}
