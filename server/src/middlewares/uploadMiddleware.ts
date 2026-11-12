import multer from 'multer';
import { HttpError } from './errorHandler.js';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Files are kept in memory (max 5MB, one per request) so they can be validated and processed
 * before anything is written anywhere. Always mount AFTER requireAuth: anonymous clients must not be
 * able to make the server buffer uploads.
 *
 * The Content-Type check here is only a first, cheap filter; controllers re-check the real file bytes.
 */
function singleFileUpload(field: string, allowedTypes: string[]) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5, fieldSize: 2 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (allowedTypes.includes(file.mimetype)) cb(null, true);
      else cb(new HttpError(400, 'Unsupported file type', 'FILE_TYPE_INVALID'));
    },
  }).single(field);
}

export const avatarUpload = singleFileUpload('avatar', IMAGE_TYPES);
export const certificateUpload = singleFileUpload('certificate', [...IMAGE_TYPES, 'application/pdf']);
