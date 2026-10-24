// ============================================================
// Yene Verify — Telebirr Live Smoke Test (one-time, manual)
//
// renders https://transactioninfo.ethiotelecom.et/receipt/{ref}
// with a real headless Chromium, then runs the REAL parser
// against the real rendered HTML.
//
// Output discipline: prints only the PATH (found/not-found),
// the NAMES of extracted/missing fields, and timing. Never the
// extracted values, never the page HTML — they may contain PII.
//
// Not part of CI. Run:  npx ts-node scripts/telebirr-smoke.ts <ref-or-url>
// ============================================================

import { Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { parseTelebirrReceipt } from '../src/verification/adapters/telebirr/telebirr.parser';

const BASE_URL = 'https://transactioninfo.ethiotelecom.et';
const USER_AGENT = 'YeneVerify/1.0 (+https://yeneverify.com/bot)';
const HARD_TIMEOUT_MS = 30_000;
const NAV_TIMEOUT_MS = 25_000;
const RENDER_WAIT_MS = 8_000;

const FIELD_NAMES = ['reference', 'amountMinor', 'senderName', 'receiverName', 'paidAt'] as const;

const RENDER_MARKERS = [
  'Payer Name',
  'Receiver Name',
  'Transaction Number',
  'Receipt',
  'not found',
  'invalid',
  'expired',
];

function referenceToUrl(arg: string): string {
  // Accept either a bare reference or a full receipt URL.
  if (arg.startsWith('http')) {
    return arg;
  }
  return `${BASE_URL}/receipt/${encodeURIComponent(arg)}`;
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) {
    throw new Error('usage: ts-node scripts/telebirr-smoke.ts <reference-or-url>');
  }

  const started = Date.now();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    page.setDefaultTimeout(NAV_TIMEOUT_MS);

    await page.goto(referenceToUrl(arg), {
      waitUntil: 'networkidle2',
      timeout: NAV_TIMEOUT_MS,
    });
    await page
      .waitForFunction(
        (markers: string[]) => markers.some((m) => document.body.innerText.includes(m)),
        { timeout: RENDER_WAIT_MS },
        RENDER_MARKERS,
      )
      .catch(() => {}); // parse decides from the DOM either way

    const html = await page.content();
    const parsed = parseTelebirrReceipt(html);
    const durationMs = Date.now() - started;

    if (parsed.found) {
      const extracted = FIELD_NAMES.filter(
        (name) => name === 'amountMinor' || name === 'paidAt'
          ? parsed[name] !== null
          : parsed[name].length > 0,
      );
      const missing = FIELD_NAMES.filter((n) => !(extracted as readonly string[]).includes(n));
      new Logger('telebirr-smoke').log(
        `path: FOUND | fields extracted: [${extracted.join(', ')}] | missing: [${missing.join(', ')}] | durationMs: ${durationMs}`,
      );
    } else {
      new Logger('telebirr-smoke').log(
        `path: NOT-FOUND | durationMs: ${durationMs} (marking "not found"/invalid/expired or no receipt rows)`,
      );
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

// Hard 30s cap: if anything hangs (network, render, launch) we exit 124.
const watchdog = setTimeout(() => {
  new Logger('telebirr-smoke').error(`hard timeout after ${HARD_TIMEOUT_MS}ms`);
  process.exit(124);
}, HARD_TIMEOUT_MS);

main()
  .then(() => {
    clearTimeout(watchdog);
    process.exit(0);
  })
  .catch((err: Error) => {
    clearTimeout(watchdog);
    new Logger('telebirr-smoke').error(err.message);
    process.exit(1);
  });
