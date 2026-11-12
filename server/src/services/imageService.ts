import sharp from 'sharp';
import { HttpError } from '../middlewares/errorHandler.js';

export const AVATAR_SIZE = 512;
const MAX_INPUT_PIXELS = 40_000_000; // refuse decompression bombs (a tiny file that expands to gigabytes)

/**
 * Turns whatever the therapist uploaded into a small square WebP.
 * - rotate() applies the camera's EXIF orientation first, so photos aren't sideways
 * - sharp drops all metadata on output, so GPS location and device info in the original are NOT kept
 * - "attention" crops around the most interesting part (usually the face) instead of the dead centre
 */
export async function processAvatar(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: sharp.strategy.attention })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new HttpError(400, 'The image could not be processed', 'IMAGE_INVALID');
  }
}
