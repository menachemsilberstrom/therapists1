/** Escapes user input so it can be used inside a RegExp as plain text. */
export const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
