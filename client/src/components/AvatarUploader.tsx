import { useEffect, useState, type ChangeEvent } from 'react';
import { getErrorMessage } from '../api/errors';
import { therapistsApi } from '../api/services';
import type { OwnTherapistProfile } from '../types';
import { IMAGE_TYPES, validateUpload } from '../utils/upload';
import Avatar from './Avatar';
import { ErrorMessage } from './Feedback';
import { panelClass, secondaryButtonClass } from './ui';

interface AvatarUploaderProps {
  name: string;
  imageUrl?: string;
  onChange: (profile: OwnTherapistProfile) => void;
}

export default function AvatarUploader({ name, imageUrl, onChange }: AvatarUploaderProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Free the temporary preview URL when it is replaced or the component goes away.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again later
    if (!file) return;

    const problem = validateUpload(file, IMAGE_TYPES, 'ניתן להעלות תמונות JPG, PNG או WEBP בלבד.');
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    setBusy(true);
    setPreview(URL.createObjectURL(file)); // show the choice immediately while it uploads
    try {
      onChange(await therapistsApi.uploadAvatar(file));
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setPreview(null);
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!window.confirm('להסיר את תמונת הפרופיל?')) return;
    setError(null);
    setBusy(true);
    try {
      onChange(await therapistsApi.deleteAvatar());
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`mb-6 ${panelClass}`} aria-labelledby="avatar-heading">
      <h2 id="avatar-heading" className="mb-4 text-lg font-semibold">
        תמונת פרופיל
      </h2>
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className={busy ? 'opacity-60' : ''}>
          <Avatar
            name={name || '?'}
            src={preview ?? imageUrl}
            alt="תמונת הפרופיל הנוכחית"
            eager
            className="size-24 text-4xl"
          />
        </div>

        <div className="w-full space-y-3 sm:w-auto">
          <div className="flex flex-col gap-2 sm:flex-row">
            {/* The file input is visually hidden; the label is the big, tappable button. */}
            <label
              className={`${secondaryButtonClass} cursor-pointer focus-within:ring-2 focus-within:ring-teal-600/40 ${busy ? 'pointer-events-none opacity-60' : ''}`}
            >
              {busy ? 'מעלה...' : imageUrl ? 'החלפת תמונה' : 'העלאת תמונה'}
              <input
                type="file"
                accept={IMAGE_TYPES.join(',')}
                onChange={handleSelect}
                disabled={busy}
                className="sr-only"
              />
            </label>
            {imageUrl && (
              <button type="button" onClick={handleRemove} disabled={busy} className={secondaryButtonClass}>
                הסרת התמונה
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">
            JPG, PNG או WEBP עד 5MB. התמונה תיחתך לריבוע ותוקטן אוטומטית.
          </p>
        </div>
      </div>
      {error && (
        <div className="mt-4">
          <ErrorMessage message={error} />
        </div>
      )}
    </section>
  );
}
