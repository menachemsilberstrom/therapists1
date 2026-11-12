import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../api/errors';
import { categoriesApi, therapistsApi } from '../api/services';
import { ErrorMessage, Spinner } from '../components/Feedback';
import FilterSidebar from '../components/FilterSidebar';
import TherapistCard from '../components/TherapistCard';
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../components/ui';
import type { Category, CityOption, PagedResult, TherapistCardData } from '../types';
import { AUDIENCE_LABELS, GENDER_LABELS, REGION_LABELS } from '../utils/contact';
import { countActiveFilters, parseFilters, toApiParams, toSearchParams, type SearchFilters } from '../utils/searchFilters';

interface ActiveTag {
  key: string;
  label: string;
  /** What to change to remove this filter. */
  remove: Partial<SearchFilters>;
}

export default function Home() {
  const [params, setParams] = useSearchParams();
  const paramsKey = params.toString();
  const filters = useMemo(() => parseFilters(new URLSearchParams(paramsKey)), [paramsKey]);

  const [searchText, setSearchText] = useState(filters.q);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [result, setResult] = useState<PagedResult<TherapistCardData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Both lists only power the filter controls; the search itself still works without them.
  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => setCategories([]));
    therapistsApi.filterOptions().then((o) => setCities(o.cities)).catch(() => setCities([]));
  }, []);

  // Keep the keyword box in sync with the URL (back/forward, clear all).
  useEffect(() => setSearchText(filters.q), [filters.q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    therapistsApi
      .list(toApiParams(parseFilters(new URLSearchParams(paramsKey))))
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
  }, [paramsKey]);

  /** Applies a change to the filters. Any change goes back to page 1 unless it is itself a page change. */
  const update = useCallback(
    (changes: Partial<SearchFilters>) => {
      setParams(toSearchParams({ ...parseFilters(new URLSearchParams(paramsKey)), page: 1, ...changes }));
    },
    [paramsKey, setParams],
  );

  const clearSidebarFilters = useCallback(
    () => update({ categories: [], gender: '', region: '', city: '', audiences: [], online: false }),
    [update],
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    update({ q: searchText.trim() });
  }

  const activeCount = countActiveFilters(filters);
  const hasAnyFilter = activeCount > 0 || filters.q !== '';

  const tags: ActiveTag[] = [
    ...(filters.q ? [{ key: 'q', label: `חיפוש: ${filters.q}`, remove: { q: '' } }] : []),
    ...filters.categories.map((slug) => ({
      key: `c-${slug}`,
      label: categories.find((c) => c.slug === slug)?.name ?? slug,
      remove: { categories: filters.categories.filter((s) => s !== slug) },
    })),
    ...(filters.gender ? [{ key: 'g', label: GENDER_LABELS[filters.gender], remove: { gender: '' as const } }] : []),
    ...(filters.region ? [{ key: 'r', label: REGION_LABELS[filters.region], remove: { region: '' as const } }] : []),
    ...(filters.city ? [{ key: 'city', label: `עיר: ${filters.city}`, remove: { city: '' } }] : []),
    ...filters.audiences.map((a) => ({
      key: `a-${a}`,
      label: `קהל יעד: ${AUDIENCE_LABELS[a]}`,
      remove: { audiences: filters.audiences.filter((x) => x !== a) },
    })),
    ...(filters.online ? [{ key: 'online', label: 'מקבלים אונליין', remove: { online: false } }] : []),
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 px-4 py-8 text-white sm:px-6 md:px-8 md:py-12">
        <h1 className="text-2xl font-bold md:text-3xl">מצאו את המטפל/ת המתאימ/ה לכם</h1>
        <p className="mt-2 text-sm text-teal-50 md:text-base">חיפוש בקהילת המטפלים לפי שם, תחום התמחות או עיר, וסינון מתקדם לפי הצרכים שלכם.</p>

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

      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <FilterSidebar
          filters={filters}
          categories={categories}
          cities={cities}
          activeCount={activeCount}
          onChange={update}
          onClear={clearSidebarFilters}
        />

        <section aria-label="תוצאות החיפוש" className="min-w-0 space-y-4">
          {tags.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="סינונים פעילים">
              {tags.map((tag) => (
                <li key={tag.key}>
                  <button
                    type="button"
                    onClick={() => update(tag.remove)}
                    aria-label={`הסרת הסינון: ${tag.label}`}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 text-sm text-teal-800 transition hover:bg-teal-100"
                  >
                    {tag.label}
                    <span aria-hidden="true" className="text-teal-600">
                      ×
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {loading && <Spinner />}
          {error && <ErrorMessage message={error} />}

          {!loading && !error && result && (
            <div aria-live="polite">
              {result.items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-16 text-center">
                  <p className="text-lg font-medium text-slate-700">לא נמצאו מטפלים התואמים את החיפוש</p>
                  {hasAnyFilter && (
                    <>
                      <p className="mt-1 text-sm text-slate-500">נסו להסיר חלק מהסינונים.</p>
                      <button type="button" onClick={() => setParams(new URLSearchParams())} className={`${secondaryButtonClass} mt-4`}>
                        ניקוי כל הסינונים
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <p className="mb-4 text-sm text-slate-500">נמצאו {result.total} מטפלים</p>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
                        onClick={() => update({ page: result.page - 1 })}
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
                        onClick={() => update({ page: result.page + 1 })}
                      >
                        הבא
                      </button>
                    </nav>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
