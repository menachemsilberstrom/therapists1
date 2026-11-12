import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../../api/errors';
import { adminApi } from '../../api/services';
import type { AdminTherapistRow, PagedResult, UserStatus } from '../../types';
import Avatar from '../Avatar';
import { ErrorMessage, Spinner, SuccessMessage } from '../Feedback';
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../ui';
import StatusBadge from './StatusBadge';

interface TherapistListProps {
  /** pending = the moderation queue (oldest first, with a quick Approve button); all = every therapist with filters. */
  mode: 'pending' | 'all';
  /** Called after a change so the tab counters can refresh. */
  onChanged: () => void;
}

const STATUS_FILTERS: { value: UserStatus | ''; label: string }[] = [
  { value: '', label: 'כל הסטטוסים' },
  { value: 'PENDING_APPROVAL', label: 'ממתינים לאישור' },
  { value: 'ACTIVE', label: 'פעילים' },
  { value: 'SUSPENDED', label: 'מושעים' },
];

export default function TherapistList({ mode, onChanged }: TherapistListProps) {
  const pendingMode = mode === 'pending';
  const [searchText, setSearchText] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<PagedResult<AdminTherapistRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi
      .listTherapists({
        status: pendingMode ? 'PENDING_APPROVAL' : status || undefined,
        q: q || undefined,
        sort: pendingMode ? 'oldest' : 'newest',
        page,
      })
      .then((result) => {
        if (!cancelled) setData(result);
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
  }, [pendingMode, q, status, page, reload]);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setQ(searchText.trim());
  }

  async function approve(row: AdminTherapistRow) {
    const name = row.fullName || row.email;
    if (!window.confirm(`לאשר את ${name}? הפרופיל יופיע מיד בחיפוש.`)) return;
    setBusyId(row.id);
    setError(null);
    setNotice(null);
    try {
      await adminApi.setStatus(row.id, 'ACTIVE');
      setNotice(`${name} אושר/ה והפרופיל פעיל.`);
      setReload((n) => n + 1);
      onChanged();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="חיפוש לפי שם, אימייל, עיר או תואר..."
          aria-label="חיפוש מטפלים"
          className={`${inputClass} sm:flex-1`}
        />
        {!pendingMode && (
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as UserStatus | '');
              setPage(1);
            }}
            aria-label="סינון לפי סטטוס"
            className={`${inputClass} sm:w-48`}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        )}
        <button type="submit" className={primaryButtonClass}>
          חיפוש
        </button>
      </form>

      {notice && <SuccessMessage message={notice} />}
      {error && <ErrorMessage message={error} />}
      {loading && <Spinner />}

      {!loading && data && (
        <>
          {data.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-slate-600">
              {pendingMode && !q ? 'אין מטפלים הממתינים לאישור.' : 'לא נמצאו מטפלים התואמים את החיפוש.'}
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                {data.total} {pendingMode ? 'ממתינים לאישור' : 'מטפלים'}
                {pendingMode && ' (מהוותיק לחדש)'}
              </p>
              <ul className="space-y-3">
                {data.items.map((row) => (
                  <li key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <Avatar name={row.fullName || row.email} src={row.profileImageUrl} className="size-12 text-xl" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className={`break-words font-semibold ${row.fullName ? 'text-slate-900' : 'text-slate-400'}`}>
                            {row.fullName || 'ללא שם'}
                          </h3>
                          <StatusBadge status={row.accountStatus} />
                          {row.isSeeded && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">נתוני דוגמה</span>
                          )}
                          {!row.hasProfile && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">אין פרופיל</span>
                          )}
                        </div>
                        <p dir="ltr" className="break-all text-start text-sm text-slate-500">
                          {row.email}
                        </p>
                        <p className="mt-1 break-words text-sm text-slate-600">
                          {[row.professionalTitle, row.city].filter(Boolean).join(' · ') || '—'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          נרשם/ה {new Date(row.createdAt).toLocaleDateString('he-IL')}
                          {' · '}
                          {row.certificateCount === 0
                            ? 'ללא תעודות'
                            : `${row.certificateCount} תעודות (${row.verifiedCertificateCount} אומתו)`}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Link to={`/admin/therapists/${row.id}`} className={`${secondaryButtonClass} w-full sm:w-auto`}>
                        פתיחה ובדיקה
                      </Link>
                      {pendingMode && row.hasProfile && (
                        <button
                          type="button"
                          onClick={() => approve(row)}
                          disabled={busyId === row.id}
                          className={`${primaryButtonClass} w-full sm:w-auto`}
                        >
                          {busyId === row.id ? 'מאשר...' : 'אישור'}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {data.totalPages > 1 && (
                <nav aria-label="עימוד" className="flex items-center justify-between gap-2 pt-2 sm:justify-center sm:gap-4">
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={data.page <= 1}
                    onClick={() => setPage(data.page - 1)}
                  >
                    הקודם
                  </button>
                  <span className="text-sm text-slate-600">
                    עמוד {data.page} מתוך {data.totalPages}
                  </span>
                  <button
                    type="button"
                    className={primaryButtonClass}
                    disabled={data.page >= data.totalPages}
                    onClick={() => setPage(data.page + 1)}
                  >
                    הבא
                  </button>
                </nav>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
