import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { getErrorMessage } from '../api/errors';
import { therapistsApi } from '../api/services';
import type { OwnCertificate, OwnTherapistProfile } from '../types';
import { DOCUMENT_TYPES, validateUpload } from '../utils/upload';
import { ErrorMessage } from './Feedback';
import FormField from './FormField';
import { inputClass, panelClass, primaryButtonClass, secondaryButtonClass } from './ui';

const MAX_CERTIFICATES = 10;

interface CertificatesManagerProps {
  certificates: OwnCertificate[];
  onChange: (profile: OwnTherapistProfile) => void;
}

export default function CertificatesManager({ certificates, onChange }: CertificatesManagerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const full = certificates.length >= MAX_CERTIFICATES;

  function handleSelect(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (selected) {
      const problem = validateUpload(selected, DOCUMENT_TYPES, 'ניתן להעלות קבצי PDF, JPG, PNG או WEBP בלבד.');
      if (problem) {
        setError(problem);
        e.target.value = '';
        setFile(null);
        return;
      }
    }
    setError(null);
    setFile(selected);
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('לא נבחר קובץ.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      onChange(await therapistsApi.addCertificate(title.trim(), file));
      setTitle('');
      setFile(null);
      formRef.current?.reset();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(cert: OwnCertificate) {
    if (!window.confirm(`למחוק את התעודה "${cert.title}"?`)) return;
    setError(null);
    setBusy(true);
    try {
      onChange(await therapistsApi.deleteCertificate(cert.id));
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`mt-6 ${panelClass}`} aria-labelledby="certs-heading">
      <h2 id="certs-heading" className="mb-1 text-lg font-semibold">
        תעודות והסמכות
      </h2>
      <p className="mb-4 text-sm text-slate-600">
        העלאת תעודות היא אופציונלית. הקבצים גלויים למנהלי האתר בלבד, ולא מוצגים בפרופיל הציבורי. לאחר אימות תוצג בפרופיל
        תגית &quot;תעודות אומתו&quot;.
      </p>

      {certificates.length > 0 && (
        <ul className="mb-5 divide-y divide-slate-200 rounded-lg border border-slate-200">
          {certificates.map((cert) => (
            <li key={cert.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="wrap-break-word font-medium text-slate-900">{cert.title}</p>
                <p className="break-all text-xs text-slate-500">
                  {cert.originalName} · {new Date(cert.uploadedAt).toLocaleDateString('he-IL')}
                </p>
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${
                    cert.isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {cert.isVerified ? 'אומתה' : 'ממתינה לאימות'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(cert)}
                disabled={busy}
                className={`${secondaryButtonClass} w-full shrink-0 sm:w-auto`}
              >
                מחיקה
              </button>
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <p className="text-sm text-slate-600">הגעתם למספר התעודות המרבי ({MAX_CERTIFICATES}). מחקו תעודה כדי להוסיף חדשה.</p>
      ) : (
        <form ref={formRef} onSubmit={handleAdd} className="space-y-4">
          <FormField label="שם התעודה" htmlFor="cert-title" hint='לדוגמה: "תואר שני בעבודה סוציאלית קלינית"'>
            <input
              id="cert-title"
              required
              minLength={2}
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </FormField>
          <FormField label="קובץ (PDF, JPG, PNG או WEBP, עד 5MB)" htmlFor="cert-file">
            <input
              id="cert-file"
              type="file"
              required
              accept={DOCUMENT_TYPES.join(',')}
              onChange={handleSelect}
              className="block w-full min-h-11 text-sm text-slate-700 file:me-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-4 file:py-2 file:font-medium file:text-slate-700 hover:file:bg-slate-50"
            />
          </FormField>
          {error && <ErrorMessage message={error} />}
          <button type="submit" disabled={busy} className={`${primaryButtonClass} w-full sm:w-auto`}>
            {busy ? 'מעלה...' : 'העלאת תעודה'}
          </button>
        </form>
      )}
      {full && error && (
        <div className="mt-4">
          <ErrorMessage message={error} />
        </div>
      )}
    </section>
  );
}
