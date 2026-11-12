import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../api/errors';
import { categoriesApi, therapistsApi } from '../api/services';
import { ErrorMessage, Spinner, SuccessMessage } from '../components/Feedback';
import FormField from '../components/FormField';
import { inputClass, panelClass, primaryButtonClass, secondaryButtonClass } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import ApprovalStatus from '../components/ApprovalStatus';
import AvatarUploader from '../components/AvatarUploader';
import CertificatesManager from '../components/CertificatesManager';
import type { Category, Gender, OwnTherapistProfile, Region, TargetAudience, TherapistProfile } from '../types';
import { AUDIENCE_LABELS, GENDER_LABELS, REGION_LABELS } from '../utils/contact';
import { AUDIENCE_VALUES, GENDER_VALUES, REGION_VALUES, toggleItem } from '../utils/searchFilters';

interface FormState {
  fullName: string;
  professionalTitle: string;
  bio: string;
  city: string;
  phone: string;
  whatsapp: string;
  contactEmail: string;
  categories: string[]; // slugs
  // The public search filters on these four, so they are part of the profile form.
  gender: Gender | '';
  region: Region | '';
  acceptsOnline: boolean;
  targetAudiences: TargetAudience[];
}

const BIO_MAX_LENGTH = 3000;

function toFormState(p: TherapistProfile): FormState {
  return {
    fullName: p.fullName,
    professionalTitle: p.professionalTitle,
    bio: p.bio,
    city: p.city,
    phone: p.contactInfo.phone,
    whatsapp: p.contactInfo.whatsapp ?? '',
    contactEmail: p.contactInfo.email ?? '',
    categories: p.categories.map((c) => c.slug),
    gender: p.gender ?? '',
    region: p.region ?? '',
    acceptsOnline: p.acceptsOnline,
    targetAudiences: p.targetAudiences,
  };
}

export default function Dashboard() {
  const { user } = useAuth();
  const isTherapist = user?.role === 'THERAPIST';

  const [form, setForm] = useState<FormState | null>(null);
  const [profile, setProfile] = useState<OwnTherapistProfile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(isTherapist);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isTherapist) return;
    let cancelled = false;
    Promise.all([therapistsApi.getMine(), categoriesApi.list()])
      .then(([mine, cats]) => {
        if (cancelled) return;
        setProfile(mine);
        setForm(toFormState(mine));
        setCategories(cats);
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
  }, [isTherapist]);

  if (!isTherapist) {
    return <ErrorMessage message="האזור האישי זמין למטפלים בלבד." />;
  }
  if (loading) return <Spinner />;
  if (!form || !profile) return <ErrorMessage message={error ?? 'לא ניתן לטעון את הפרופיל.'} />;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  function toggleCategory(slug: string) {
    if (!form) return;
    setField(
      'categories',
      form.categories.includes(slug) ? form.categories.filter((s) => s !== slug) : [...form.categories, slug],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await therapistsApi.updateMine({
        fullName: form.fullName.trim(),
        professionalTitle: form.professionalTitle.trim(),
        bio: form.bio.trim(),
        city: form.city.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        contactEmail: form.contactEmail.trim(),
        categories: form.categories,
        gender: form.gender || null,
        region: form.region || null,
        acceptsOnline: form.acceptsOnline,
        targetAudiences: form.targetAudiences,
      });
      setProfile(updated);
      setForm(toFormState(updated));
      setSaved(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">עריכת הפרופיל שלי</h1>
        {profile.fullName && profile.isPubliclyVisible && (
          <Link to={`/therapist/${profile.slug}`} className={`${secondaryButtonClass} w-full sm:w-auto`}>
            צפייה בפרופיל הציבורי
          </Link>
        )}
      </div>

      <ApprovalStatus profile={profile} />

      {/* Uploads save immediately and independently of the text form, so unsaved text edits are kept. */}
      <AvatarUploader name={profile.fullName} imageUrl={profile.profileImageUrl} onChange={setProfile} />

      <form onSubmit={handleSubmit} className={`space-y-5 ${panelClass}`}>
        {error && <ErrorMessage message={error} />}
        {saved && <SuccessMessage message="הפרופיל נשמר בהצלחה." />}

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="שם מלא" htmlFor="fullName" hint="נדרש כדי שהפרופיל יופיע בחיפוש">
            <input
              id="fullName"
              required
              minLength={2}
              maxLength={100}
              value={form.fullName}
              onChange={(e) => setField('fullName', e.target.value)}
              className={inputClass}
            />
          </FormField>
          <FormField label="תואר מקצועי" htmlFor="professionalTitle">
            <input
              id="professionalTitle"
              maxLength={100}
              placeholder="לדוגמה: מטפל רגשי וזוגי"
              value={form.professionalTitle}
              onChange={(e) => setField('professionalTitle', e.target.value)}
              className={inputClass}
            />
          </FormField>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="עיר" htmlFor="city">
            <input id="city" maxLength={100} value={form.city} onChange={(e) => setField('city', e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="אזור" htmlFor="region" hint="עוזר ללקוחות לסנן לפי אזור">
            <select
              id="region"
              value={form.region}
              onChange={(e) => setField('region', (REGION_VALUES.find((r) => r === e.target.value) ?? '') as Region | '')}
              className={inputClass}
            >
              <option value="">לא צוין</option>
              {REGION_VALUES.map((r) => (
                <option key={r} value={r}>
                  {REGION_LABELS[r]}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="מגדר" htmlFor="gender" hint="לא חובה. מאפשר ללקוחות לחפש מטפל או מטפלת.">
          <select
            id="gender"
            value={form.gender}
            onChange={(e) => setField('gender', (GENDER_VALUES.find((g) => g === e.target.value) ?? '') as Gender | '')}
            className={inputClass}
          >
            <option value="">לא צוין</option>
            {GENDER_VALUES.map((g) => (
              <option key={g} value={g}>
                {GENDER_LABELS[g]}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="קצת עליי" htmlFor="bio" hint={`${form.bio.length}/${BIO_MAX_LENGTH}`}>
          <textarea
            id="bio"
            rows={6}
            maxLength={BIO_MAX_LENGTH}
            value={form.bio}
            onChange={(e) => setField('bio', e.target.value)}
            className={inputClass}
          />
        </FormField>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">תחומי התמחות</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.map((c) => (
              <label key={c.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={form.categories.includes(c.slug)}
                  onChange={() => toggleCategory(c.slug)}
                  className="size-5 shrink-0 accent-teal-600"
                />
                <span className="text-sm">{c.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">קהלי יעד</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {AUDIENCE_VALUES.map((a) => (
              <label key={a} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={form.targetAudiences.includes(a)}
                  onChange={() => setField('targetAudiences', toggleItem(form.targetAudiences, a))}
                  className="size-5 shrink-0 accent-teal-600"
                />
                <span className="text-sm">{AUDIENCE_LABELS[a]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
          <input
            type="checkbox"
            checked={form.acceptsOnline}
            onChange={(e) => setField('acceptsOnline', e.target.checked)}
            className="size-5 shrink-0 accent-teal-600"
          />
          <span className="text-sm font-medium">אני מקבל/ת גם טיפול אונליין (זום)</span>
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="טלפון" htmlFor="phone">
            <input
              id="phone"
              type="tel"
              dir="ltr"
              maxLength={30}
              pattern="[0-9+\-\s()]*"
              title="ספרות, רווחים, + - ( ) בלבד"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              className={inputClass}
            />
          </FormField>
          <FormField label="וואטסאפ" htmlFor="whatsapp" hint="אם ריק, ייעשה שימוש במספר הטלפון">
            <input
              id="whatsapp"
              type="tel"
              dir="ltr"
              maxLength={30}
              pattern="[0-9+\-\s()]*"
              title="ספרות, רווחים, + - ( ) בלבד"
              value={form.whatsapp}
              onChange={(e) => setField('whatsapp', e.target.value)}
              className={inputClass}
            />
          </FormField>
        </div>

        <FormField label="אימייל ליצירת קשר" htmlFor="contactEmail">
          <input
            id="contactEmail"
            type="email"
            dir="ltr"
            value={form.contactEmail}
            onChange={(e) => setField('contactEmail', e.target.value)}
            className={inputClass}
          />
        </FormField>

        <button type="submit" disabled={saving} className={`${primaryButtonClass} w-full sm:w-auto`}>
          {saving ? 'שומר...' : 'שמירת שינויים'}
        </button>
      </form>

      <CertificatesManager certificates={profile.certificates} onChange={setProfile} />
    </div>
  );
}
