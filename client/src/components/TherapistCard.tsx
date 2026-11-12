import { Link } from 'react-router-dom';
import type { TherapistCardData } from '../types';
import { REGION_LABELS } from '../utils/contact';

export default function TherapistCard({ therapist }: { therapist: TherapistCardData }) {
  const location = therapist.city || (therapist.region ? REGION_LABELS[therapist.region] : '');

  return (
    <Link
      to={`/therapist/${therapist.slug}`}
      className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 transition hover:border-teal-300 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xl font-bold text-teal-700"
        >
          {therapist.fullName.charAt(0)}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-slate-900">{therapist.fullName}</h3>
          {therapist.professionalTitle && (
            <p className="truncate text-sm text-slate-600">{therapist.professionalTitle}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {location && <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{location}</span>}
        {therapist.acceptsOnline && (
          <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-700">טיפול אונליין</span>
        )}
      </div>

      {therapist.bioSnippet && <p className="mt-3 break-words text-sm leading-relaxed text-slate-600">{therapist.bioSnippet}</p>}

      {therapist.categories.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          {therapist.categories.map((c) => (
            <span key={c.id} className="rounded-full bg-teal-50 px-2 py-1 text-xs text-teal-700">
              {c.name}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
