/**
 * generate-user-guide.mjs
 *
 * Reads user-guide.md and generates a branded Word document.
 * Run with: node scripts/generate-user-guide.mjs
 * Output:   /mnt/user-data/outputs/SAT-Tutor-Pro-User-Guide.docx
 *
 * Branding (kept in sync with the Branding section of user-guide.md):
 *   Primary  #1E3A5F  — dark blue, used for headings and title banner
 *   Accent   #B8860B  — gold, used for blockquote callout boxes
 *   Info     #D6E4F0  — light blue, used for info/tip boxes
 *   Font     Arial
 */

import { readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  BorderStyle,
} from 'docx';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Branding ──────────────────────────────────────────────────────────────────
const PRIMARY   = '1E3A5F'; // dark blue
const ACCENT    = 'B8860B'; // gold
const INFO_BG   = 'D6E4F0'; // light blue
const WHITE     = 'FFFFFF';
const BODY_TEXT = '1A1A1A';
const FONT      = 'Arial';

// ── Helpers ───────────────────────────────────────────────────────────────────

function run(text, opts = {}) {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size ?? 22,           // half-points (11pt default)
    bold: opts.bold ?? false,
    italics: opts.italics ?? false,
    color: opts.color ?? BODY_TEXT,
  });
}

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300, after: 120 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: 36,        // 18pt
        bold: true,
        color: PRIMARY,
      }),
    ],
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: 28,        // 14pt
        bold: true,
        color: PRIMARY,
      }),
    ],
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 160, after: 60 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: 24,        // 12pt
        bold: true,
        color: PRIMARY,
      }),
    ],
  });
}

function body(text, opts = {}) {
  if (!text.trim()) return spacer();
  // Parse inline bold (**text**) and italic (*text*)
  const children = parseInline(text, opts);
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children,
  });
}

function bullet(text, level = 0) {
  const children = parseInline(text);
  return new Paragraph({
    bullet: { level },
    spacing: { before: 40, after: 40 },
    children,
  });
}

function spacer() {
  return new Paragraph({ children: [new TextRun({ text: '', font: FONT })] });
}

function hrule() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY } },
    spacing: { before: 120, after: 120 },
    children: [],
  });
}

/** Callout box implemented as a shaded single-cell table */
function callout(lines, bgHex, textColor = BODY_TEXT) {
  const paragraphs = lines.map((line) =>
    new Paragraph({
      spacing: { before: 40, after: 40 },
      children: parseInline(line, { color: textColor }),
    })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 80, bottom: 80, left: 140, right: 140 },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.SOLID, fill: bgHex },
            borders: {
              top:    { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left:   { style: BorderStyle.THICK, size: 12, color: ACCENT },
              right:  { style: BorderStyle.NONE },
            },
            children: paragraphs,
          }),
        ],
      }),
    ],
  });
}

/** Title banner — full-width shaded table */
function titleBanner(title, subtitle) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.SOLID, fill: PRIMARY },
            margins: { top: 200, bottom: 200, left: 240, right: 240 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: title, font: FONT, size: 52, bold: true, color: WHITE }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 80 },
                children: [
                  new TextRun({ text: subtitle, font: FONT, size: 24, color: 'D0E4F7', italics: true }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** Quick-reference table */
function quickRefTable(rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: ['What you want to do', 'How to do it'].map((h) =>
      new TableCell({
        shading: { type: ShadingType.SOLID, fill: PRIMARY },
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
        children: [
          new Paragraph({
            children: [new TextRun({ text: h, font: FONT, size: 20, bold: true, color: WHITE })],
          }),
        ],
      })
    ),
  });

  const dataRows = rows.map(([col1, col2]) =>
    new TableRow({
      children: [col1, col2].map((cell) =>
        new TableCell({
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: parseInline(cell),
            }),
          ],
        })
      ),
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

/**
 * Parse inline bold (**text**) and italic (*text*) markers into TextRun array.
 * Also strips leading markdown list markers (-, *) that weren't caught earlier.
 */
function parseInline(text, baseOpts = {}) {
  const size  = baseOpts.size  ?? 22;
  const color = baseOpts.color ?? BODY_TEXT;

  // Remove trailing ** or * used as emphasis markers in raw text edges
  const segments = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ text: text.slice(last, match.index), bold: false, italics: false });
    }
    if (match[2] !== undefined) {
      segments.push({ text: match[2], bold: true, italics: false });
    } else {
      segments.push({ text: match[3], bold: false, italics: true });
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    segments.push({ text: text.slice(last), bold: false, italics: false });
  }

  return segments
    .filter((s) => s.text.length > 0)
    .map(
      (s) =>
        new TextRun({
          text: s.text,
          font: FONT,
          size,
          bold: s.bold,
          italics: s.italics,
          color,
        })
    );
}

// ── Markdown parser ────────────────────────────────────────────────────────────

/**
 * Very targeted parser for the specific Markdown patterns in user-guide.md.
 * Not a general-purpose parser — handles only what the guide uses.
 */
function parseMarkdown(md) {
  const elements = [];

  // Strip the Branding & Visual Design Notes section entirely
  const brandingStart = md.indexOf('## Branding & Visual Design Notes');
  const brandingEnd   = md.indexOf('\n## ', brandingStart + 1);
  if (brandingStart !== -1 && brandingEnd !== -1) {
    md = md.slice(0, brandingStart) + md.slice(brandingEnd);
  }

  const lines = md.split('\n');
  let i = 0;

  // Track if we've emitted the title banner
  let titleEmitted = false;

  // Blockquote accumulator
  let inBlockquote = false;
  let blockquoteLines = [];

  // Table accumulator
  let inTable = false;
  let tableRows = [];

  const flushBlockquote = () => {
    if (blockquoteLines.length > 0) {
      elements.push(spacer());
      elements.push(callout(blockquoteLines, INFO_BG));
      elements.push(spacer());
      blockquoteLines = [];
    }
    inBlockquote = false;
  };

  const flushTable = () => {
    if (tableRows.length > 0) {
      elements.push(spacer());
      elements.push(quickRefTable(tableRows));
      elements.push(spacer());
      tableRows = [];
    }
    inTable = false;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Blockquote
    if (line.startsWith('> ')) {
      if (!inBlockquote) inBlockquote = true;
      blockquoteLines.push(line.slice(2));
      i++;
      continue;
    }
    if (inBlockquote) flushBlockquote();

    // Table row
    if (line.startsWith('|')) {
      inTable = true;
      // Skip separator rows (|---|---|)
      if (/^\|[-| :]+\|$/.test(line.trim())) { i++; continue; }
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.length >= 2) tableRows.push([cells[0], cells[1]]);
      i++;
      continue;
    }
    if (inTable) flushTable();

    // H1 — title
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      const title = line.slice(2).trim();
      if (!titleEmitted) {
        elements.push(titleBanner(title, 'Your AI-powered personal SAT tutor'));
        elements.push(spacer());
        titleEmitted = true;
      }
      i++;
      continue;
    }

    // H2
    if (line.startsWith('## ')) {
      elements.push(heading1(line.slice(3).trim()));
      i++;
      continue;
    }

    // H3
    if (line.startsWith('### ')) {
      elements.push(heading2(line.slice(4).trim()));
      i++;
      continue;
    }

    // H4
    if (line.startsWith('#### ')) {
      elements.push(heading3(line.slice(5).trim()));
      i++;
      continue;
    }

    // Numbered section heading like "## 1. Start Here …" is already H2
    // Horizontal rule
    if (line.trim() === '---') {
      elements.push(hrule());
      i++;
      continue;
    }

    // Bullet list (-, *)
    if (/^[-*] /.test(line)) {
      elements.push(bullet(line.slice(2).trim()));
      i++;
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      elements.push(spacer());
      i++;
      continue;
    }

    // Bold standalone line (e.g. **Heading**)
    if (/^\*\*[^*]+\*\*$/.test(line.trim())) {
      const text = line.trim().replace(/^\*\*|\*\*$/g, '');
      elements.push(
        new Paragraph({
          spacing: { before: 120, after: 40 },
          children: [new TextRun({ text, font: FONT, size: 24, bold: true, color: PRIMARY })],
        })
      );
      i++;
      continue;
    }

    // Italic standalone line (*text*)
    if (/^\*[^*]+\*$/.test(line.trim())) {
      const text = line.trim().replace(/^\*|\*$/g, '');
      elements.push(body(text, { italics: true }));
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(body(line));
    i++;
  }

  // Flush any trailing accumulators
  if (inBlockquote) flushBlockquote();
  if (inTable) flushTable();

  return elements;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const mdPath = join(ROOT, 'user-guide.md');

// Primary output path for production/cloud environments.
// Falls back to <repo-root>/outputs/ when /mnt is not available (e.g. local dev on macOS).
const PRIMARY_OUT = '/mnt/user-data/outputs/SAT-Tutor-Pro-User-Guide.docx';
const FALLBACK_OUT = join(ROOT, 'outputs', 'SAT-Tutor-Pro-User-Guide.docx');
const outPath = (() => {
  try {
    mkdirSync(dirname(PRIMARY_OUT), { recursive: true });
    return PRIMARY_OUT;
  } catch {
    return FALLBACK_OUT;
  }
})();

const markdown = readFileSync(mdPath, 'utf8');
const docElements = parseMarkdown(markdown);

const doc = new Document({
  creator: 'SAT Tutor Pro',
  title:   'SAT Tutor Pro — User Guide',
  styles: {
    default: {
      document: {
        run: { font: FONT, size: 22, color: BODY_TEXT },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 }, // 0.75in
        },
      },
      children: docElements,
    },
  ],
});

// Ensure output directory exists (primary path already attempted above)
mkdirSync(dirname(outPath), { recursive: true });

const buffer = await Packer.toBuffer(doc);
writeFileSync(outPath, buffer);

console.log(`✓ Generated: ${outPath}`);
