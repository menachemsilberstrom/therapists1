import { describe, expect, it } from 'vitest';
import { detectFileType } from '../../src/utils/fileType.js';
import { jpegWithExif, pdfBuffer, pngBuffer } from '../helpers.js';

describe('detectFileType (decides by the real first bytes, never by the file name)', () => {
  it('recognises a real PNG', async () => {
    expect(detectFileType(await pngBuffer())).toEqual({ mime: 'image/png', ext: '.png' });
  });

  it('recognises a real JPEG', async () => {
    expect(detectFileType(await jpegWithExif())).toEqual({ mime: 'image/jpeg', ext: '.jpg' });
  });

  it('recognises a WEBP', () => {
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(20)]);
    expect(detectFileType(webp)).toEqual({ mime: 'image/webp', ext: '.webp' });
  });

  it('recognises a PDF', () => {
    expect(detectFileType(pdfBuffer())).toEqual({ mime: 'application/pdf', ext: '.pdf' });
  });

  it.each([
    ['plain text', Buffer.from('hello world, this is just text')],
    ['a Windows executable', Buffer.from('MZ\x90\x00\x03\x00\x00\x00')],
    ['an HTML page', Buffer.from('<html><script>alert(1)</script></html>')],
    ['a GIF', Buffer.from('GIF89a......')],
    ['a RIFF container that is not WEBP (e.g. WAV)', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(8)])],
    ['an empty file', Buffer.alloc(0)],
    ['a file shorter than any signature', Buffer.from([0xff, 0xd8])],
  ])('rejects %s', (_label, data) => {
    expect(detectFileType(data)).toBeNull();
  });
});
