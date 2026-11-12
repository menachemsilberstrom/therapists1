import axios from 'axios';

/** The server sends a stable `code` for upload problems; these are the Hebrew texts for them. */
const CODE_MESSAGES: Readonly<Record<string, string>> = {
  FILE_TOO_LARGE: 'הקובץ גדול מדי (עד 5MB).',
  FILE_TYPE_INVALID: 'סוג הקובץ אינו נתמך. ניתן להעלות JPG, PNG או WEBP (בתעודות גם PDF).',
  FILE_MISSING: 'לא נבחר קובץ.',
  FILE_FIELD_INVALID: 'שגיאה בהעלאת הקובץ. נסו שוב.',
  IMAGE_INVALID: 'לא ניתן לעבד את התמונה. נסו תמונה אחרת.',
  TOO_MANY_CERTIFICATES: 'ניתן להעלות עד 10 תעודות. מחקו תעודה קיימת כדי להוסיף חדשה.',
};

/** Turns any thrown value into a Hebrew message that is safe to show to the user. */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'לא ניתן להתחבר לשרת. נסו שוב מאוחר יותר.';
    const data: unknown = error.response.data;
    const code = typeof data === 'object' && data !== null ? (data as { code?: unknown }).code : undefined;
    if (typeof code === 'string' && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
    switch (error.response.status) {
      case 400:
        return 'הנתונים שהוזנו אינם תקינים. בדקו את השדות ונסו שוב.';
      case 401:
        return 'אימייל או סיסמה שגויים.';
      case 403:
        return 'אין לכם הרשאה לבצע פעולה זו.';
      case 404:
        return 'לא נמצא.';
      case 409:
        return 'כתובת האימייל כבר רשומה במערכת.';
      case 429:
        return 'יותר מדי ניסיונות. נסו שוב בעוד מספר דקות.';
      default:
        return 'אירעה שגיאה בשרת. נסו שוב מאוחר יותר.';
    }
  }
  return 'אירעה שגיאה לא צפויה.';
}

export function isNotFound(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}
