import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getErrorMessage, isNotFound } from '../api/errors';
import { adminApi } from '../api/services';
import StatusBadge from '../components/admin/StatusBadge';
import Avatar from '../components/Avatar';
import { ErrorMessage, Spinner, SuccessMessage } from '../components/Feedback';
import { dangerButtonClass, inputClass, panelClass, primaryButtonClass, secondaryButtonClass } from '../components/ui';
import type { AdminCertificate, AdminTherapistDetail } from '../types';
import { AUDIENCE_LABELS, REGION_LABELS, toTelUrl } from '../utils/contact';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export default function AdminTherapistPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [therapist, setTherapist] = useState<AdminTherapistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    adminApi
      .getTherapist(id)
      .then((data) => {
        if (!cancelled) setTherapist(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (isNotFound(err)) setNotFound(true);
        else setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  /** Runs one admin action and replaces the page data with the server's fresh answer. */
  async function perform(action: () => Promise<AdminTherapistDetail>, successMessage: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setTherapist(await action());
      setNotice(successMessage);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function changeStatus(status: 'ACTIVE' | 'SUSPENDED') {
    if (!therapist) return;
    const name = therapist.fullName || therapist.email;
    const question =
      status === 'ACTIVE'
        ? `לאשר את ${name}? הפרופיל יופיע מיד בחיפוש.`
        : `להשעות את ${name}? הפרופיל יוסתר מיד, והמשתמש/ת לא יוכל/תוכל להתחבר.`;
    if (!window.confirm(question)) return;
    void perform(
      () => adminApi.setStatus(therapist.id, status),
      status === 'ACTIVE' ? 'החשבון פעיל והפרופיל מוצג בחיפוש.' : 'החשבון הושעה והפרופיל הוסתר.',
    );
  }

  function toggleVerified(cert: AdminCertificate) {
    if (!therapist) return;
    void perform(
      () => adminApi.setCertificateVerified(therapist.id, cert.id, !cert.isVerified),
      cert.isVerified ? 'האימות בוטל.' : 'התעודה אומתה. בפרופיל הציבורי תוצג תגית "תעודות אומתו".',
    );
  }

  /** The file is private, so it is fetched with the admin's token and opened from a temporary local URL. */
  async function viewCertificate(cert: AdminCertificate) {
    if (!therapist) return;
    setError(null);
    // Open the tab right away (inside the click) so popup blockers allow it, then point it at the file.
    const tab = window.open('', '_blank');
    try {
      const blob = await adminApi.fetchCertificate(therapist.id, cert.id);
      const url = URL.createObjectURL(blob);
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = cert.originalName || 'certificate';
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: unknown) {
      tab?.close();
      setError(getErrorMessage(err));
    }
  }

  async function deleteAccount() {
    if (!therapist) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.deleteTherapist(therapist.id, confirmEmail);
      navigate('/admin?tab=therapists', { replace: true });
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;
  if (notFound) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">המטפל/ת לא נמצא/ה</h1>
        <p className="mt-2 text-slate-600">ייתכן שהחשבון נמחק.</p>
        <Link to="/admin" className={`${secondaryButtonClass} mt-6`}>
          חזרה לניהול
        </Link>
      </div>
    );
  }
  if (!therapist) return <ErrorMessage message={error ?? 'אירעה שגיאה'} />;

  const t = therapist;
  const emailMatches = confirmEmail.trim().toLowerCase() === t.email.toLowerCase();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/admin" className="inline-flex min-h-11 items-center text-sm text-teal-700 hover:underline">
        &rarr; חזרה לניהול
      </Link>

      {notice && <SuccessMessage message={notice} />}
      {error && <ErrorMessage message={error} />}

      {/* Header + moderation actions */}
      <section className={panelClass}>
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-start">
          <Avatar name={t.fullName || t.email} src={t.profileImageUrl} eager className="size-20 text-3xl" />
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-xl font-bold sm:text-2xl">{t.fullName || 'ללא שם'}</h1>
            {t.professionalTitle && <p className="break-words text-slate-600">{t.professionalTitle}</p>}
            <p dir="ltr" className="mt-1 break-all text-sm text-slate-500">
              {t.email}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <StatusBadge status={t.accountStatus} />
              <span className="text-xs text-slate-500">{t.isPubliclyVisible ? 'מוצג בחיפוש' : 'מוסתר מהציבור'}</span>
              {t.isSeeded && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">נתוני דוגמה</span>}
              {!t.hasProfile && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">אין פרופיל</span>}
            </div>
            <p className="mt-2 text-xs text-slate-500">נרשם/ה {new Date(t.createdAt).toLocaleDateString('he-IL')}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:flex-wrap">
          {t.accountStatus !== 'ACTIVE' && t.hasProfile && (
            <button type="button" disabled={busy} onClick={() => changeStatus('ACTIVE')} className={`${primaryButtonClass} w-full sm:w-auto`}>
              {t.accountStatus === 'SUSPENDED' ? 'הפעלה מחדש' : 'אישור'}
            </button>
          )}
          {t.accountStatus !== 'SUSPENDED' && (
            <button type="button" disabled={busy} onClick={() => changeStatus('SUSPENDED')} className={`${secondaryButtonClass} w-full sm:w-auto`}>
              {t.accountStatus === 'PENDING_APPROVAL' ? 'דחייה (השעיה)' : 'השעיה'}
            </button>
          )}
          {t.isPubliclyVisible && t.slug && (
            <Link to={`/therapist/${t.slug}`} className={`${secondaryButtonClass} w-full sm:w-auto`}>
              צפייה בדף הציבורי
            </Link>
          )}
        </div>
      </section>

      {/* Profile details */}
      {t.hasProfile && (
        <section className={panelClass} aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="mb-4 text-lg font-semibold">
            פרטי הפרופיל
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="עיר">{t.city || '—'}</Field>
            <Field label="אזור">{t.region ? REGION_LABELS[t.region] : '—'}</Field>
            <Field label="טיפול אונליין">{t.acceptsOnline ? 'כן' : 'לא'}</Field>
            <Field label="קהלי יעד">{t.targetAudiences.length ? t.targetAudiences.map((a) => AUDIENCE_LABELS[a]).join(', ') : '—'}</Field>
            <Field label="טלפון">
              {t.contactInfo.phone ? (
                <a href={toTelUrl(t.contactInfo.phone)} dir="ltr" className="text-teal-700 hover:underline">
                  {t.contactInfo.phone}
                </a>
              ) : (
                '—'
              )}
            </Field>
            <Field label="וואטסאפ">
              <span dir="ltr">{t.contactInfo.whatsapp || '—'}</span>
            </Field>
            <Field label="אימייל ליצירת קשר">
              <span dir="ltr" className="break-all">
                {t.contactInfo.email || '—'}
              </span>
            </Field>
            <Field label="קטגוריות">{t.categories.length ? t.categories.map((c) => c.name).join(', ') : '—'}</Field>
          </dl>
          <div className="mt-4 border-t border-slate-200 pt-4">
            <p className="text-xs font-medium text-slate-500">אודות</p>
            <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-slate-800">{t.bio || '—'}</p>
          </div>
        </section>
      )}

      {/* Certificates */}
      <section className={panelClass} aria-labelledby="certs-heading">
        <h2 id="certs-heading" className="mb-1 text-lg font-semibold">
          תעודות והסמכות
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          הקבצים פרטיים וגלויים למנהלים בלבד. אימות תעודה מציג בפרופיל הציבורי את התגית &quot;תעודות אומתו&quot;. כל צפייה נרשמת ביומן המערכת.
        </p>
        {t.certificates.length === 0 ? (
          <p className="text-sm text-slate-500">לא הועלו תעודות.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
            {t.certificates.map((cert) => (
              <li key={cert.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words font-medium text-slate-900">{cert.title}</p>
                  <p className="break-all text-xs text-slate-500">
                    {cert.originalName} · {cert.fileType === 'pdf' ? 'PDF' : 'תמונה'} · {new Date(cert.uploadedAt).toLocaleDateString('he-IL')}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${
                      cert.isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {cert.isVerified ? 'אומתה' : 'ממתינה לאימות'}
                  </span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
                  <button type="button" onClick={() => viewCertificate(cert)} className={`${secondaryButtonClass} w-full sm:w-auto`}>
                    צפייה בקובץ
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => toggleVerified(cert)}
                    className={`${cert.isVerified ? secondaryButtonClass : primaryButtonClass} w-full sm:w-auto`}
                  >
                    {cert.isVerified ? 'ביטול אימות' : 'אימות'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Danger zone */}
      <section className="rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-6" aria-labelledby="danger-heading">
        <h2 id="danger-heading" className="mb-1 text-lg font-semibold text-red-800">
          מחיקת החשבון
        </h2>
        <p className="mb-4 text-sm text-red-900">
          הפעולה מוחקת לצמיתות את החשבון, הפרופיל, תמונת הפרופיל וכל התעודות שהועלו, ואי אפשר לשחזר אותה. אם רק רוצים להסתיר את
          הפרופיל, עדיף להשעות.
        </p>
        <label htmlFor="confirm-email" className="mb-1 block text-sm font-medium text-red-900">
          להקלדה לאישור: כתובת האימייל של החשבון
        </label>
        <p dir="ltr" className="mb-2 break-all text-start text-sm font-medium text-red-900">
          {t.email}
        </p>
        <input
          id="confirm-email"
          dir="ltr"
          autoComplete="off"
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          className={inputClass}
        />
        <button
          type="button"
          disabled={busy || !emailMatches}
          onClick={deleteAccount}
          className={`${dangerButtonClass} mt-3 w-full sm:w-auto`}
        >
          {busy ? 'מוחק...' : 'מחיקה לצמיתות'}
        </button>
      </section>
    </div>
  );
}
