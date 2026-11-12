import axios from 'axios';

/** Turns any thrown value into a Hebrew message that is safe to show to the user. */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'לא ניתן להתחבר לשרת. נסו שוב מאוחר יותר.';
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
      default:
        return 'אירעה שגיאה בשרת. נסו שוב מאוחר יותר.';
    }
  }
  return 'אירעה שגיאה לא צפויה.';
}

export function isNotFound(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}
