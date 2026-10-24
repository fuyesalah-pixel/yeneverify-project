// ============================================================
// Yene Verify — BrowserPool Unit Tests
//
// Puppeteer is fully module-mocked: no real Chromium in any test.
// The module mock covers launch(); pages are plain objects with
// the two calls BrowserPool makes on them.
// ============================================================

jest.mock('puppeteer', () => ({
  launch: jest.fn(),
}));

import puppeteer from 'puppeteer';
import { BrowserPool } from './browser-pool';

const fakePage = {
  setUserAgent: jest.fn().mockResolvedValue(undefined),
  setDefaultTimeout: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
};

const fakeBrowser = {
  connected: true,
  newPage: jest.fn().mockResolvedValue(fakePage),
  close: jest.fn().mockResolvedValue(undefined),
};

const config = {
  telebirr: { headlessEnabled: true, browserPoolSize: 2, maxConcurrent: 2 },
  bankAdapters: { timeoutMs: 250, retries: 2, userAgent: 'yene-verify-test/1.0', mock: false },
} as never;

const makePool = () => new BrowserPool(config);

beforeEach(() => {
  jest.clearAllMocks();
  (puppeteer.launch as jest.Mock).mockResolvedValue(fakeBrowser);
  fakePage.close.mockResolvedValue(undefined);
});

afterEach(async () => {
  await makePool().onModuleDestroy();
});

describe('BrowserPool (unit)', () => {
  it('launches one shared browser and reuses it across pages', async () => {
    const pool = makePool();

    const page1 = await pool.getPage();
    const page2 = await pool.getPage();
    pool.release();
    pool.release();

    expect(page1).toEqual(fakePage); // mock returns the same object
    expect(page2).toEqual(fakePage);
    expect(puppeteer.launch).toHaveBeenCalledTimes(1);
    expect(puppeteer.launch).toHaveBeenCalledWith(expect.objectContaining({ headless: true }));
    expect(page1.setUserAgent).toHaveBeenCalledWith('yene-verify-test/1.0');
    expect(page1.setDefaultTimeout).toHaveBeenCalledWith(250);
  });

  it('releases the slot on a getPage failure — no leak', async () => {
    (puppeteer.launch as jest.Mock).mockRejectedValue(new Error('chrome missing'));

    const pool = makePool();
    await expect(pool.getPage()).rejects.toThrow('chrome missing');

    // The failed acquire freed its slot, so a later getPage works.
    (puppeteer.launch as jest.Mock).mockResolvedValue(fakeBrowser);
    const page = await pool.getPage();
    pool.release();
    expect(page).toEqual(fakePage);
  });

  it('bounds concurrency: the third acquire waits until a release', async () => {
    const pool = makePool();

    const p1 = pool.getPage();
    const p2 = pool.getPage();
    const p3 = pool.getPage(); // maxConcurrent=2 — must wait

    await Promise.all([p1, p2]);
    expect(fakeBrowser.newPage).toHaveBeenCalledTimes(2);

    pool.release(); // one slot frees → p3 proceeds
    await p3;
    pool.release();

    expect(fakeBrowser.newPage).toHaveBeenCalledTimes(3);
  });

  it('relaunches after the browser dies (connected false)', async () => {
    const pool = makePool();
    await pool.getPage();
    pool.release();

    fakeBrowser.connected = false;
    await pool.getPage();
    pool.release();

    expect(puppeteer.launch).toHaveBeenCalledTimes(2);
  });

  it('onModuleDestroy closes the browser', async () => {
    const pool = makePool();
    await pool.getPage();
    pool.release();

    await pool.onModuleDestroy();

    expect(fakeBrowser.close).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy is safe when no browser ever launched', async () => {
    await expect(new BrowserPool(config).onModuleDestroy()).resolves.toBeUndefined();
  });

  it('health() returns true when a page opens and false when launch fails', async () => {
    const pool = makePool();
    expect(await pool.health()).toBe(true);

    (puppeteer.launch as jest.Mock).mockRejectedValue(new Error('fail'));
    expect(await pool.health()).toBe(false);
  });
});
