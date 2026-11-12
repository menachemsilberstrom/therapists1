export interface DetectedFileType {
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  ext: '.jpg' | '.png' | '.webp' | '.pdf';
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Identifies a file by its actual first bytes ("magic numbers").
 * The file name and the Content-Type header come from the client and can be faked, the bytes cannot.
 */
export function detectFileType(buf: Buffer): DetectedFileType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: '.jpg' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE)) return { mime: 'image/png', ext: '.png' };
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') {
    return { mime: 'image/webp', ext: '.webp' };
  }
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf', ext: '.pdf' };
  return null;
}
