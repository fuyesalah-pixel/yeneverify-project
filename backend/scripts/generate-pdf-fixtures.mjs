// ============================================================
// Yene Verify — PDF Fixture Generator (one-off, 13D.6+7)
//
// Generates the bank receipt PDF fixtures by rendering HTML in
// headless Chromium (puppeteer, already a dependency — pdfkit was
// deliberately NOT installed) and printing to PDF.
//
// Usage: node scripts/generate-pdf-fixtures.mjs
// Output:
//   src/verification/adapters/mpesa/fixtures/receipt-success.pdf
//   src/verification/adapters/mpesa/fixtures/receipt-success.json  ({ pdfBase64 } wrapper)
//   src/verification/adapters/mpesa/fixtures/receipt-not-found.pdf
//   src/verification/adapters/zemen/fixtures/receipt-success.pdf
//   src/verification/adapters/zemen/fixtures/receipt-not-found.pdf
// Regenerate only when a fixture's CONTENT must change — they are
// version-controlled so parser tests stay deterministic.
// ============================================================

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const here = dirname(fileURLToPath(import.meta.url));
const out = (bank, name) =>
  resolve(here, `../src/verification/adapters/${bank}/fixtures/${name}`);

const MPESA_SUCCESS = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>M-Pesa Receipt</title></head>
<body style="font-family:Arial,Sans-Serif;margin:24px;">
  <h2 style="margin:0 0 4px;">M-Pesa Ethiopia</h2>
  <p style="margin:0 0 16px;">Transaction Receipt — copy for your records</p>
  <p>Payer Name: Yonas Alemu</p>
  <p>Receiver Name: Selam Coffee</p>
  <p>Amount: ETB 250.00</p>
  <p>Transaction ID: MPX1234ABC</p>
  <p>Transaction Date: 14/07/2026 2:08 PM</p>
  <p>Status: Completed</p>
</body></html>`;

const MPESA_NOT_FOUND = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>M-Pesa Receipt</title></head>
<body style="font-family:Arial,Sans-Serif;margin:24px;">
  <h2 style="margin:0 0 4px;">M-Pesa Ethiopia</h2>
  <h3>Transaction Not Available</h3>
  <p>This reference does not exist in our records. Check the SMS confirmation and try again.</p>
</body></html>`;

// A real receipt whose transaction ID belongs to another lookup —
// exercises the parser's expectedReference cross-check.
const MPESA_MISMATCH = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>M-Pesa Receipt</title></head>
<body style="font-family:Arial,Sans-Serif;margin:24px;">
  <h2 style="margin:0 0 4px;">M-Pesa Ethiopia</h2>
  <p style="margin:0 0 16px;">Transaction Receipt</p>
  <p>Payer Name: Yonas Alemu</p>
  <p>Receiver Name: Selam Coffee</p>
  <p>Amount: ETB 250.00</p>
  <p>Transaction ID: MPXXXXXXXX</p>
  <p>Transaction Date: 14/07/2026 2:08 PM</p>
  <p>Status: Completed</p>
</body></html>`;

const ZEMEN_SUCCESS = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Zemen Bank Receipt</title></head>
<body style="font-family:Arial,Sans-Serif;margin:24px;">
  <h2 style="margin:0 0 4px;">Zemen Bank</h2>
  <p style="margin:0 0 16px;">Fund Transfer Receipt</p>
  <p>Sender Name: Dawit Tesfaye</p>
  <p>Receiver Name: Dawit Electronics</p>
  <p>Amount: ETB 450.00</p>
  <p>Reference Number: 108IBET252931385</p>
  <p>Transaction Date: 18/07/2026 4:20 PM</p>
  <p>Status: Successful</p>
</body></html>`;

const ZEMEN_NOT_FOUND = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Zemen Bank Receipt</title></head>
<body style="font-family:Arial,Sans-Serif;margin:24px;">
  <h2 style="margin:0 0 4px;">Zemen Bank</h2>
  <h3>No record found</h3>
  <p>We could not find a transaction with this reference number.</p>
</body></html>`;

const ZEMEN_MISMATCH = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Zemen Bank Receipt</title></head>
<body style="font-family:Arial,Sans-Serif;margin:24px;">
  <h2 style="margin:0 0 4px;">Zemen Bank</h2>
  <p style="margin:0 0 16px;">Fund Transfer Receipt</p>
  <p>Sender Name: Dawit Tesfaye</p>
  <p>Receiver Name: Dawit Electronics</p>
  <p>Amount: ETB 450.00</p>
  <p>Reference Number: 108ZZZZZZZZZZ9</p>
  <p>Transaction Date: 18/07/2026 4:20 PM</p>
  <p>Status: Successful</p>
</body></html>`;

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  const render = async (html, outPath) => {
    mkdirSync(dirname(outPath), { recursive: true });
    await page.setContent(html, { waitUntil: 'load' });
    await page.pdf({ path: outPath, format: 'A4', margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' } });
  };

  await render(MPESA_SUCCESS, out('mpesa', 'receipt-success.pdf'));
  await render(MPESA_NOT_FOUND, out('mpesa', 'receipt-not-found.pdf'));
  await render(MPESA_MISMATCH, out('mpesa', 'receipt-mismatch.pdf'));
  await render(ZEMEN_SUCCESS, out('zemen', 'receipt-success.pdf'));
  await render(ZEMEN_NOT_FOUND, out('zemen', 'receipt-not-found.pdf'));
  await render(ZEMEN_MISMATCH, out('zemen', 'receipt-mismatch.pdf'));

  // M-Pesa's API wraps the PDF in JSON { pdfBase64 } — fixture mirrors it.
  const success = readFileSync(out('mpesa', 'receipt-success.pdf'));
  mkdirSync(dirname(out('mpesa', 'receipt-success.json')), { recursive: true });
  writeFileSync(
    out('mpesa', 'receipt-success.json'),
    JSON.stringify({ pdfBase64: success.toString('base64') }, null, 2),
  );
  console.log('PDF fixtures generated.');
} finally {
  await browser.close();
}
