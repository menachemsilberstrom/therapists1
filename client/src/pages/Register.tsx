import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../api/errors';
import FormField from '../components/FormField';
import { ErrorMessage } from '../components/Feedback';
import { inputClass, primaryButtonClass } from '../components/ui';
import { useAuth } from '../context/AuthContext';

const MIN_PASSWORD_LENGTH = 8;

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים.`);
      return;
    }
    if (password !== confirm) {
      setError('הסיסמאות אינן תואמות.');
      return;
    }

    setSubmitting(true);
    try {
      await register({ email: email.trim(), password, fullName: fullName.trim() || undefined });
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <h1 className="mb-6 text-xl font-bold sm:text-2xl">הצטרפות כמטפל/ת</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorMessage message={error} />}
        <FormField label="שם מלא" htmlFor="fullName">
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            maxLength={100}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField label="אימייל" htmlFor="email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField label="סיסמה" htmlFor="password" hint={`לפחות ${MIN_PASSWORD_LENGTH} תווים`}>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField label="אימות סיסמה" htmlFor="confirm">
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            dir="ltr"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
        </FormField>
        <button type="submit" disabled={submitting} className={`${primaryButtonClass} w-full`}>
          {submitting ? 'יוצר חשבון...' : 'יצירת חשבון'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        כבר יש לכם חשבון?{' '}
        <Link to="/login" className="font-medium text-teal-700 hover:underline">
          התחברות
        </Link>
      </p>
    </div>
  );
}
