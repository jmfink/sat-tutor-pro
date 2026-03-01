// Server-side PDF text extraction using unpdf (pdfjs-dist under the hood, Node.js only).
// This runs in API routes, avoiding all browser/webpack compatibility issues.
import { extractText } from 'unpdf';

export async function extractTextFromPDFBuffer(buffer: Buffer): Promise<string> {
  const { text } = await extractText(new Uint8Array(buffer));
  // text is an array of per-page strings — join with page separators
  return text.map((page, i) => `--- Page ${i + 1} ---\n${page}`).join('\n');
}
