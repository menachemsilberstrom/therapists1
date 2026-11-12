import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getErrorMessage, isNotFound } from '../api/errors';
import { therapistsApi } from '../api/services';
import Avatar from '../components/Avatar';
import { ErrorMessage, Spinner } from '../components/Feedback';
import { panelClass, secondaryButtonClass } from '../components/ui';
import type { TargetAudience, TherapistProfile } from '../types';
import { REGION_LABELS, toTelUrl, toWhatsAppUrl } from '../utils/contact';

const AUDIENCE_LABELS: Record<TargetAudience, string> = {
  CHILDREN: 'ילדים',
  TEENS: 'בני נוער',
  ADULTS: 'מבוגרים',
  COUPLES: 'זוגות',
  PARENTS: 'הורים',
};

export default function TherapistProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [therapist, setTherapist] = useState<TherapistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotFound(false);
    therapistsApi
      .getBySlug(slug)
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
  }, [slug]);

  if (loading) return <Spinner />;

  if (notFound) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">המטפל/ת לא נמצא/ה</h1>
        <p className="mt-2 text-slate-600">ייתכן שהפרופיל הוסר או שהכתובת שגויה.</p>
        <Link to="/" className={`${secondaryButtonClass} mt-6`}>
          חזרה לחיפוש
        </Link>
      </div>
    );
  }

  if (error || !therapist) return <ErrorMessage message={error ?? 'אירעה שגיאה'} />;

  const { contactInfo } = therapist;
  const whatsapp = contactInfo.whatsapp || contactInfo.phone;
  const place = [therapist.city, therapist.region ? REGION_LABELS[therapist.region] : ''].filter(Boolean).join(' · ');

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Link to="/" className="inline-flex min-h-11 items-center text-sm text-teal-700 hover:underline">
        &rarr; חזרה לתוצאות החיפוש
      </Link>

      {/* Phones: avatar above the details, centred. From sm up: avatar beside the details. */}
      <header className={`flex flex-col items-center gap-4 text-center sm:flex-row sm:text-start ${panelClass}`}>
        <Avatar
          name={therapist.fullName}
          src={therapist.profileImageUrl}
          eager
          className="size-24 text-3xl sm:size-28 sm:text-4xl"
        />
        <div className="min-w-0">
          <h1 className="break-words text-xl font-bold text-slate-900 sm:text-2xl">{therapist.fullName}</h1>
          {therapist.professionalTitle && (
            <p className="break-words text-sm text-slate-600 sm:text-base">{therapist.professionalTitle}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm sm:justify-start">
            {place && <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{place}</span>}
            {therapist.acceptsOnline && (
              <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700">טיפול אונליין</span>
            )}
            {therapist.hasVerifiedCertificates && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">תעודות אומתו</span>
            )}
          </div>
        </div>
      </header>

      {therapist.bio && (
        <section className={panelClass}>
          <h2 className="mb-2 text-lg font-semibold">אודות</h2>
          <p className="whitespace-pre-line break-words text-sm leading-relaxed text-slate-700 sm:text-base">
            {therapist.bio}
          </p>
        </section>
      )}

      {(therapist.categories.length > 0 || therapist.targetAudiences.length > 0) && (
        <section className={`space-y-4 ${panelClass}`}>
          {therapist.categories.length > 0 && (
            <div>
              <h2 className="mb-2 text-lg font-semibold">תחומי התמחות</h2>
              <div className="flex flex-wrap gap-2">
                {therapist.categories.map((c) => (
                  <Link
                    key={c.id}
                    to={`/?category=${encodeURIComponent(c.slug)}`}
                    className="inline-flex min-h-10 items-center rounded-full bg-teal-50 px-4 py-2 text-sm text-teal-700 hover:bg-teal-100"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {therapist.targetAudiences.length > 0 && (
            <div>
              <h2 className="mb-2 text-lg font-semibold">קהלי יעד</h2>
              <p className="text-slate-700">{therapist.targetAudiences.map((a) => AUDIENCE_LABELS[a]).join(', ')}</p>
            </div>
          )}
        </section>
      )}

      <section className={panelClass}>
        <h2 className="mb-4 text-lg font-semibold">יצירת קשר</h2>
        {contactInfo.phone || contactInfo.email ? (
          // Phones: full-width stacked buttons (easy thumb taps). From sm up: a wrapping row.
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {contactInfo.phone && (
              <a
                href={toTelUrl(contactInfo.phone)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-5 py-2 font-medium text-white transition hover:bg-teal-700 sm:w-auto"
              >
                התקשרו
                <bdi dir="ltr">{contactInfo.phone}</bdi>
              </a>
            )}
            {whatsapp && (
              <a
                href={toWhatsAppUrl(whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-green-600 px-5 py-2 font-medium text-white transition hover:bg-green-700 sm:w-auto"
              >
                שלחו הודעה בוואטסאפ
              </a>
            )}
            {contactInfo.email && (
              <a href={`mailto:${contactInfo.email}`} className={`${secondaryButtonClass} w-full sm:w-auto`}>
                שלחו אימייל
              </a>
            )}
          </div>
        ) : (
          <p className="text-slate-500">פרטי יצירת קשר טרם הוזנו.</p>
        )}
      </section>
    </article>
  );
}
