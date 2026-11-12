import { useEffect, useState } from 'react';
import type { Category, CityOption, Gender, Region } from '../types';
import { AUDIENCE_LABELS, GENDER_LABELS, REGION_LABELS } from '../utils/contact';
import { AUDIENCE_VALUES, GENDER_VALUES, REGION_VALUES, toggleItem, type SearchFilters } from '../utils/searchFilters';
import { inputClass, secondaryButtonClass } from './ui';

interface FilterSidebarProps {
  filters: SearchFilters;
  categories: Category[];
  cities: CityOption[];
  activeCount: number;
  onChange: (changes: Partial<SearchFilters>) => void;
  onClear: () => void;
}

const rowClass = 'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-slate-50';
const legendClass = 'mb-2 text-sm font-semibold text-slate-800';
const CITY_DEBOUNCE_MS = 400;

/**
 * The search filters. On phones it collapses behind a "סינון" button so the results stay in view;
 * from the lg breakpoint up it is a permanent sidebar (on the start side, i.e. the right in Hebrew).
 */
export default function FilterSidebar({ filters, categories, cities, activeCount, onChange, onClear }: FilterSidebarProps) {
  const [open, setOpen] = useState(false);
  const [cityText, setCityText] = useState(filters.city);

  // Keep the box in sync when the URL changes (clear all, back/forward, removing a tag).
  useEffect(() => setCityText(filters.city), [filters.city]);

  // Typing a city applies after a short pause instead of on every keystroke.
  useEffect(() => {
    const trimmed = cityText.trim();
    if (trimmed === filters.city) return;
    const timer = window.setTimeout(() => onChange({ city: trimmed }), CITY_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [cityText, filters.city, onChange]);

  return (
    <aside aria-label="סינון תוצאות" className="lg:sticky lg:top-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="filters-panel"
        className={`${secondaryButtonClass} w-full justify-between lg:hidden`}
      >
        <span>סינון מתקדם</span>
        <span className="flex items-center gap-2">
          {activeCount > 0 && <span className="rounded-full bg-teal-600 px-2 py-0.5 text-xs text-white">{activeCount}</span>}
          <span aria-hidden="true">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      <div
        id="filters-panel"
        className={`${open ? 'mt-3 block' : 'hidden'} space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:mt-0 lg:block`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">סינון</h2>
          {activeCount > 0 && (
            <button type="button" onClick={onClear} className="min-h-11 px-2 text-sm font-medium text-teal-700 hover:underline">
              ניקוי הכל
            </button>
          )}
        </div>

        {categories.length > 0 && (
          <fieldset>
            <legend className={legendClass}>תחומי טיפול</legend>
            <div>
              {categories.map((c) => (
                <label key={c.id} className={rowClass}>
                  <input
                    type="checkbox"
                    checked={filters.categories.includes(c.slug)}
                    onChange={() => onChange({ categories: toggleItem(filters.categories, c.slug) })}
                    className="size-5 shrink-0 accent-teal-600"
                  />
                  <span className="text-sm">{c.name}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 px-2 text-xs text-slate-500">מוצגים מטפלים שעוסקים בלפחות אחד מהתחומים שנבחרו.</p>
          </fieldset>
        )}

        <fieldset>
          <legend className={legendClass}>מגדר המטפל/ת</legend>
          <div>
            {([['', 'הכל'], ...GENDER_VALUES.map((g): [Gender, string] => [g, GENDER_LABELS[g]])] as [Gender | '', string][]).map(
              ([value, label]) => (
                <label key={value || 'all'} className={rowClass}>
                  <input
                    type="radio"
                    name="gender-filter"
                    checked={filters.gender === value}
                    onChange={() => onChange({ gender: value })}
                    className="size-5 shrink-0 accent-teal-600"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ),
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend className={legendClass}>מיקום</legend>
          <div className="space-y-3">
            <div>
              <label htmlFor="region-filter" className="mb-1 block text-xs text-slate-600">
                אזור
              </label>
              <select
                id="region-filter"
                value={filters.region}
                onChange={(e) => onChange({ region: (REGION_VALUES.find((r) => r === e.target.value) ?? '') as Region | '' })}
                className={inputClass}
              >
                <option value="">כל האזורים</option>
                {REGION_VALUES.map((r) => (
                  <option key={r} value={r}>
                    {REGION_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="city-filter" className="mb-1 block text-xs text-slate-600">
                עיר
              </label>
              <input
                id="city-filter"
                list="city-options"
                value={cityText}
                onChange={(e) => setCityText(e.target.value)}
                placeholder="הקלידו שם עיר"
                autoComplete="off"
                maxLength={100}
                className={inputClass}
              />
              <datalist id="city-options">
                {cities.map((c) => (
                  <option key={c.name} value={c.name} label={`${c.name} (${c.count})`} />
                ))}
              </datalist>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className={legendClass}>קהל יעד</legend>
          <div>
            {AUDIENCE_VALUES.map((a) => (
              <label key={a} className={rowClass}>
                <input
                  type="checkbox"
                  checked={filters.audiences.includes(a)}
                  onChange={() => onChange({ audiences: toggleItem(filters.audiences, a) })}
                  className="size-5 shrink-0 accent-teal-600"
                />
                <span className="text-sm">{AUDIENCE_LABELS[a]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="sr-only">טיפול אונליין</legend>
          <label className={rowClass}>
            <input
              type="checkbox"
              checked={filters.online}
              onChange={() => onChange({ online: !filters.online })}
              className="size-5 shrink-0 accent-teal-600"
            />
            <span className="text-sm font-medium">מטפלים שמקבלים גם אונליין</span>
          </label>
        </fieldset>
      </div>
    </aside>
  );
}
