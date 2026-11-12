import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../api/errors';
import { categoriesApi, therapistsApi } from '../api/services';
import { ErrorMessage, Spinner } from '../components/Feedback';
import TherapistCard from '../components/TherapistCard';
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../components/ui';
import type { Category, PagedResult, TherapistCardData } from '../types';

// shrink-0 stops chips from squashing inside the scrollable row; min-h-10 (40px) is a comfortable tap size.
const chipClass =
  'inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full border px-4 py-2 text-sm transition';
const chipActiveClass = 'border-teal-600 bg-teal-600 text-white';
const chipIdleClass = 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100';

export default function Home() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [searchText, setSearchText] = useState(q);
  const [categories, setCategories] = useState<Category[]>([]);
  const [result, setResult] = useState<PagedResult<TherapistCardData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    categoriesApi
      .list()
      .then(setCategories)
      .catch(() => setCategories([])); // the filter is optional; search still works without it
  }, []);

  // Keep the input in sync when the URL changes (back/forward buttons).
  useEffect(() => setSearchText(q), [q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    therapistsApi
      .list({ q: q || undefined, category: category || undefined, page })
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, category, page]);

  function updateParams(changes: { q?: string; category?: string; page?: number }) {
    const next = new URLSearchParams(params);
    const merged = { q, category, page, ...changes };
    if (merged.q) next.set('q', merged.q);
    else next.delete('q');
    if (merged.category) next.set('category', merged.category);
    else next.delete('category');
    if (merged.page > 1) next.set('page', String(merged.page));
    else next.delete('page');
    setParams(next);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    updateParams({ q: searchText.trim(), page: 1 });
  }

  function clearFilters() {
    setSearchText('');
    setParams(new URLSearchParams());
  }

  const hasFilters = q !== '' || category !== '';

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 px-4 py-8 text-white sm:px-6 md:px-8 md:py-12">
        <h1 className="text-2xl font-bold md:text-3xl">מצאו את המטפל/ת המתאימ/ה לכם</h1>
        <p className="mt-2 text-sm text-teal-50 md:text-base">חיפוש בקהילת המטפלים לפי שם, תחום התמחות או עיר.</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="שם, התמחות או עיר..."
            aria-label="חיפוש מטפל"
            className={`${inputClass} sm:flex-1`}
          />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-6 py-2 font-medium text-teal-800 transition hover:bg-teal-50"
          >
            חיפוש
          </button>
        </form>
      </section>

      {categories.length > 0 && (
        <section aria-label="סינון לפי תחום">
          {/* Phones: one horizontally scrollable row (saves vertical space). From sm up: wrapping chips. */}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            <button
              type="button"
              onClick={() => updateParams({ category: '', page: 1 })}
              aria-pressed={category === ''}
              className={`${chipClass} ${category === '' ? chipActiveClass : chipIdleClass}`}
            >
              הכל
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => updateParams({ category: c.slug, page: 1 })}
                aria-pressed={category === c.slug}
                className={`${chipClass} ${category === c.slug ? chipActiveClass : chipIdleClass}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {loading && <Spinner />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && result && (
        <section aria-live="polite">
          {result.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
              <p className="text-lg font-medium text-slate-700">לא נמצאו מטפלים התואמים את החיפוש</p>
              {hasFilters && (
                <button type="button" onClick={clearFilters} className={`${secondaryButtonClass} mt-4`}>
                  ניקוי הסינון
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-slate-500">נמצאו {result.total} מטפלים</p>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {result.items.map((t) => (
                  <TherapistCard key={t.id} therapist={t} />
                ))}
              </div>

              {result.totalPages > 1 && (
                <nav aria-label="עימוד" className="mt-8 flex items-center justify-between gap-2 sm:justify-center sm:gap-4">
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={result.page <= 1}
                    onClick={() => updateParams({ page: result.page - 1 })}
                  >
                    הקודם
                  </button>
                  <span className="text-sm text-slate-600">
                    עמוד {result.page} מתוך {result.totalPages}
                  </span>
                  <button
                    type="button"
                    className={primaryButtonClass}
                    disabled={result.page >= result.totalPages}
                    onClick={() => updateParams({ page: result.page + 1 })}
                  >
                    הבא
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
