import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';

/** `code` is a stable machine-readable reason the client can translate (the message stays English). */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ message: 'Not found' });
};

function multerFailure(err: multer.MulterError): { message: string; code: string } {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return { message: 'File too large (max 5MB)', code: 'FILE_TOO_LARGE' };
    case 'LIMIT_UNEXPECTED_FILE':
    case 'LIMIT_FILE_COUNT':
      return { message: 'Unexpected file or field name', code: 'FILE_FIELD_INVALID' };
    default:
      return { message: 'Upload failed', code: 'UPLOAD_INVALID' };
  }
}

export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  // Expected errors (4xx) are already logged at "warn" level by the request logger.
  if (err instanceof ZodError) {
    res.status(400).json({ message: 'Validation failed', errors: err.flatten().fieldErrors });
    return;
  }
  if (err instanceof multer.MulterError) {
    res.status(400).json(multerFailure(err));
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message, ...(err.code ? { code: err.code } : {}) });
    return;
  }
  // Anything else is a bug or an outage: log it with the stack trace, tell the client nothing about it.
  req.log.error({ err }, 'Unhandled error');
  res.status(500).json({ message: 'Internal server error' });
};
