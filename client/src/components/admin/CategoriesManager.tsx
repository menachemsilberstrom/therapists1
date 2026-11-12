import { useEffect, useState, type FormEvent } from 'react';
import { getErrorMessage } from '../../api/errors';
import { adminApi } from '../../api/services';
import type { AdminCategory } from '../../types';
import { ErrorMessage, Spinner, SuccessMessage } from '../Feedback';
import FormField from '../FormField';
import { inputClass, panelClass, primaryButtonClass, secondaryButtonClass } from '../ui';

export default function CategoriesManager() {
  const [categories, setCategories] = useState<AdminCategory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    let cancelled = false;
    adminApi
      .listCategories()
      .then((list) => {
        if (!cancelled) setCategories(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Runs one change; on success replaces the touched category in the list. */
  async function run(action: () => Promise<AdminCategory>, successMessage: string, onDone?: () => void) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await action();
      setCategories((prev) => {
        if (!prev) return prev;
        const exists = prev.some((c) => c.id === saved.id);
        const next = exists ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved];
        return next.sort((a, b) => a.name.localeCompare(b.name, 'he'));
      });
      setNotice(successMessage);
      onDone?.();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    void run(() => adminApi.createCategory({ name: newName.trim(), slug: newSlug.trim().toLowerCase() }), 'הקטגוריה נוספה.', () => {
      setNewName('');
      setNewSlug('');
    });
  }

  function startEdit(c: AdminCategory) {
    setEditingId(c.id);
    setEditName(c.name);
    setError(null);
    setNotice(null);
  }

  function saveEdit(c: AdminCategory) {
    if (editName.trim() === c.name) {
      setEditingId(null);
      return;
    }
    void run(() => adminApi.updateCategory(c.id, { name: editName.trim() }), 'השם עודכן.', () => setEditingId(null));
  }

  function toggleActive(c: AdminCategory) {
    const deactivating = c.isActive;
    if (
      deactivating &&
      !window.confirm(
        `להשבית את "${c.name}"? היא תוסתר מהחיפוש ומהפרופילים (${c.usageCount} פרופילים משתמשים בה). הנתונים נשמרים וניתן להפעיל אותה מחדש.`,
      )
    ) {
      return;
    }
    void run(() => adminApi.updateCategory(c.id, { isActive: !c.isActive }), deactivating ? 'הקטגוריה הושבתה.' : 'הקטגוריה הופעלה.');
  }

  return (
    <div className="space-y-6">
      {notice && <SuccessMessage message={notice} />}
      {error && <ErrorMessage message={error} />}

      <form onSubmit={handleAdd} className={`space-y-4 ${panelClass}`}>
        <h2 className="text-lg font-semibold">הוספת קטגוריה</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="שם בעברית" htmlFor="cat-name">
            <input
              id="cat-name"
              required
              minLength={2}
              maxLength={60}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={inputClass}
            />
          </FormField>
          <FormField
            label="מזהה (slug) באנגלית"
            htmlFor="cat-slug"
            hint="אותיות לועזיות קטנות, ספרות ומקפים, לדוגמה: social-anxiety. מופיע בכתובות ולא ניתן לשינוי."
          >
            <input
              id="cat-slug"
              required
              dir="ltr"
              minLength={2}
              maxLength={60}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              title="אותיות לועזיות קטנות, ספרות ומקפים בלבד"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className={inputClass}
            />
          </FormField>
        </div>
        <button type="submit" disabled={busy} className={`${primaryButtonClass} w-full sm:w-auto`}>
          הוספה
        </button>
      </form>

      <section aria-labelledby="cat-list-heading">
        <h2 id="cat-list-heading" className="mb-3 text-lg font-semibold">
          כל הקטגוריות
        </h2>
        {!categories && !error && <Spinner />}
        {categories && (
          <ul className="space-y-3">
            {categories.map((c) => (
              <li
                key={c.id}
                className={`rounded-xl border p-4 shadow-sm ${c.isActive ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-100'}`}
              >
                {editingId === c.id ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      aria-label={`שם חדש עבור ${c.name}`}
                      minLength={2}
                      maxLength={60}
                      className={`${inputClass} sm:flex-1`}
                    />
                    <div className="flex gap-2">
                      <button type="button" disabled={busy} onClick={() => saveEdit(c)} className={`${primaryButtonClass} flex-1 sm:flex-none`}>
                        שמירה
                      </button>
                      <button type="button" disabled={busy} onClick={() => setEditingId(null)} className={`${secondaryButtonClass} flex-1 sm:flex-none`}>
                        ביטול
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`break-words font-semibold ${c.isActive ? 'text-slate-900' : 'text-slate-500'}`}>{c.name}</span>
                        {!c.isActive && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">מושבתת</span>}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        <span dir="ltr" className="inline-block">
                          {c.slug}
                        </span>
                        {' · '}
                        {c.usageCount} פרופילים
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" disabled={busy} onClick={() => startEdit(c)} className={`${secondaryButtonClass} flex-1 sm:flex-none`}>
                        שינוי שם
                      </button>
                      <button type="button" disabled={busy} onClick={() => toggleActive(c)} className={`${secondaryButtonClass} flex-1 sm:flex-none`}>
                        {c.isActive ? 'השבתה' : 'הפעלה'}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
