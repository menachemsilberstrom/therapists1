import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import { httpError } from '../test/utils';
import { getErrorMessage, isNotFound } from './errors';

describe('getErrorMessage (always a Hebrew message that is safe to show)', () => {
  it.each([
    [400, 'הנתונים שהוזנו אינם תקינים'],
    [401, 'אימייל או סיסמה שגויים'],
    [403, 'אין לכם הרשאה'],
    [404, 'לא נמצא'],
    [409, 'כתובת האימייל כבר רשומה'],
    [429, 'יותר מדי ניסיונות'],
    [500, 'אירעה שגיאה בשרת'],
    [503, 'אירעה שגיאה בשרת'],
  ])('HTTP %i', (status, fragment) => {
    expect(getErrorMessage(httpError(status))).toContain(fragment);
  });

  it('says the server is unreachable when there was no response at all', () => {
    expect(getErrorMessage(new AxiosError('Network Error', 'ERR_NETWORK'))).toContain('לא ניתן להתחבר לשרת');
  });

  it.each([
    ['FILE_TOO_LARGE', 'גדול מדי'],
    ['FILE_TYPE_INVALID', 'סוג הקובץ אינו נתמך'],
    ['FILE_MISSING', 'לא נבחר קובץ'],
    ['IMAGE_INVALID', 'לא ניתן לעבד את התמונה'],
    ['TOO_MANY_CERTIFICATES', 'עד 10 תעודות'],
    ['NO_PROFILE', 'אין פרופיל'],
    ['CATEGORY_SLUG_TAKEN', 'המזהה'],
    ['CATEGORY_NAME_TAKEN', 'כבר קיימת קטגוריה'],
    ['CONFIRMATION_MISMATCH', 'לא נמחק דבר'],
  ])('uses the specific message for the server code %s, even though the status is generic', (code, fragment) => {
    expect(getErrorMessage(httpError(400, { message: 'English message', code }))).toContain(fragment);
  });

  it('falls back to the status message for an unknown code', () => {
    expect(getErrorMessage(httpError(409, { code: 'SOMETHING_NEW' }))).toContain('כתובת האימייל כבר רשומה');
  });

  it('never shows the raw English server message', () => {
    expect(getErrorMessage(httpError(500, { message: 'Internal server error: stack trace here' }))).not.toMatch(/[A-Za-z]{4,}/);
  });

  it('copes with anything that is not an HTTP error', () => {
    for (const thrown of [new Error('boom'), 'a string', null, undefined, 42]) {
      expect(getErrorMessage(thrown)).toBe('אירעה שגיאה לא צפויה.');
    }
  });
});

describe('isNotFound', () => {
  it('is true only for an HTTP 404', () => {
    expect(isNotFound(httpError(404))).toBe(true);
    expect(isNotFound(httpError(403))).toBe(false);
    expect(isNotFound(new Error('x'))).toBe(false);
  });
});
