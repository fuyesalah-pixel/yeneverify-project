// ============================================================
// Yene Verify — PDF Parser
//
// Thin wrapper around pdf-parse so adapter code never touches the
// SDK directly, and so unit specs can stub the module instead of
// shipping real PDFs. Exported as a plain function (no NestJS) to
// keep adapters instantiable in isolation.
// ============================================================

import pdfParse from 'pdf-parse';

export interface PdfExtract {
  text: string;
  pages: number;
}

export async function extractPdfText(buffer: Buffer): Promise<PdfExtract> {
  // pdf.js officially accepts Uint8Array. A Buffer crosses pdf.js's
  // internal worker boundary unreliably in some module sandboxes
  // (jest): its subclassed prototype breaks the structured transfer
  // and the parse falls into XRef recovery. Always hand pdf.js a
  // plain Uint8Array copy.
  const bytes = Uint8Array.from(buffer);
  const result = await pdfParse(bytes as unknown as Buffer);
  return {
    text: result.text,
    pages: result.numpages ?? 0,
  };
}

/** Text-with-pages convenience for adapters that only need text. */
export async function extractText(buffer: Buffer): Promise<string> {
  return (await extractPdfText(buffer)).text;
}
