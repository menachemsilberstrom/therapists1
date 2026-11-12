import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';

/** One table from a .docx file, together with the paragraph that appears right before it (its heading). */
export interface DocxTable {
  heading: string;
  rows: string[][];
}

const XML_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeXml(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) return String.fromCodePoint(parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCodePoint(Number(entity.slice(1)));
    return XML_ENTITIES[entity.toLowerCase()] ?? '';
  });
}

/** Text of one <w:p>: runs (<w:t>), tabs and manual line breaks. */
function paragraphText(paragraphXml: string): string {
  let text = '';
  for (const m of paragraphXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:(?:br|cr)(?:\s[^>]*)?\/>/g)) {
    if (m[1] !== undefined) text += decodeXml(m[1]);
    else text += m[0].startsWith('<w:tab') ? '\t' : '\n';
  }
  return text;
}

function paragraphsOf(xml: string): string[] {
  return [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) => paragraphText(m[0]));
}

/**
 * Reads every table of a .docx file (in document order).
 * A .docx is a zip; the content is in word/document.xml. This only needs the structure
 * table > row > cell > paragraph > text, so a small dedicated reader is enough.
 */
export async function readDocxTables(filePath: string): Promise<DocxTable[]> {
  const zip = await JSZip.loadAsync(await readFile(filePath));
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) throw new Error('Not a valid .docx file (word/document.xml is missing)');
  const xml = await documentFile.async('string');

  const tableMatches = [...xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)];
  if (tableMatches.length !== (xml.match(/<w:tbl>/g) ?? []).length) {
    throw new Error('Nested tables are not supported');
  }

  const tables: DocxTable[] = [];
  let previousEnd = 0;
  for (const tableMatch of tableMatches) {
    const start = tableMatch.index ?? 0;
    const heading =
      paragraphsOf(xml.slice(previousEnd, start))
        .map((p) => p.trim())
        .filter(Boolean)
        .at(-1) ?? '';
    previousEnd = start + tableMatch[0].length;

    const rows = [...tableMatch[0].matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)].map((row) =>
      [...row[0].matchAll(/<w:tc[ >][\s\S]*?<\/w:tc>/g)].map((cell) =>
        paragraphsOf(cell[0])
          .map((p) => p.trim())
          .filter(Boolean)
          .join('\n'),
      ),
    );
    tables.push({ heading, rows });
  }
  return tables;
}
