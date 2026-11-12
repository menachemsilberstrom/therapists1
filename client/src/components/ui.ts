// Shared Tailwind class strings. Logical properties only (ms-/me-/ps-/pe-/text-start) so the layout is RTL-safe.
// min-h-11 = 44px, the recommended minimum touch target. Inputs use text-base (16px) so iOS doesn't zoom on focus.

export const inputClass =
  'block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-start text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30';

export const primaryButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-600 px-5 py-2 font-medium text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-600/40 disabled:cursor-not-allowed disabled:opacity-60';

export const secondaryButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400/40 disabled:cursor-not-allowed disabled:opacity-60';

/** Card/panel surface with padding that grows from phone to desktop. */
export const panelClass = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6';
