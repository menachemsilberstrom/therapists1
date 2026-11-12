import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../api/services';
import CategoriesManager from '../components/admin/CategoriesManager';
import TherapistList from '../components/admin/TherapistList';
import type { AdminStats } from '../types';

const TABS = [
  { id: 'pending', label: 'ממתינים לאישור' },
  { id: 'therapists', label: 'כל המטפלים' },
  { id: 'categories', label: 'קטגוריות' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const isTabId = (value: string | null): value is TabId => TABS.some((t) => t.id === value);

export default function AdminPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: TabId = isTabId(requested) ? requested : 'pending';
  const [stats, setStats] = useState<AdminStats | null>(null);

  const refreshStats = useCallback(() => {
    adminApi
      .stats()
      .then(setStats)
      .catch(() => setStats(null)); // the counters are a convenience; the tabs still work without them
  }, []);

  useEffect(() => refreshStats(), [refreshStats]);

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold sm:text-2xl">ניהול האתר</h1>
      {stats && (
        <p className="mb-5 text-sm text-slate-600">
          {stats.total} מטפלים: {stats.active} פעילים, {stats.pending} ממתינים לאישור, {stats.suspended} מושעים.
        </p>
      )}

      {/* Phones: one scrollable row of tabs. */}
      <div
        role="tablist"
        aria-label="אזורי ניהול"
        className="-mx-4 mb-6 flex gap-2 overflow-x-auto border-b border-slate-200 px-4 pb-3 sm:mx-0 sm:px-0"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams(t.id === 'pending' ? {} : { tab: t.id })}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition ${
              tab === t.id ? 'bg-teal-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            {t.label}
            {t.id === 'pending' && stats && stats.pending > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${tab === t.id ? 'bg-white text-teal-700' : 'bg-amber-100 text-amber-800'}`}
              >
                {stats.pending}
              </span>
            )}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'pending' && <TherapistList key="pending" mode="pending" onChanged={refreshStats} />}
        {tab === 'therapists' && <TherapistList key="all" mode="all" onChanged={refreshStats} />}
        {tab === 'categories' && <CategoriesManager />}
      </div>
    </div>
  );
}
