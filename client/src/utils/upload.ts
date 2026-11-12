export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // keep in sync with the server limit

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const DOCUMENT_TYPES = [...IMAGE_TYPES, 'application/pdf'];

/** Quick checks before uploading, so people get an instant message instead of waiting for the server. The server re-checks everything. */
export function validateUpload(file: File, allowedTypes: string[], typeMessage: string): string | null {
  if (!allowedTypes.includes(file.type)) return typeMessage;
  if (file.size > MAX_UPLOAD_BYTES) return 'הקובץ גדול מדי (עד 5MB).';
  return null;
}
