import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../api/errors';
import FormField from '../components/FormField';
import { ErrorMessage } from '../components/Feedback';
import { inputClass, primaryButtonClass } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { homePathFor } from '../utils/routes';

interface LocationState {
  from?: string;
}

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Where the user was heading (if a protected page sent them here), otherwise their role's home page.
  const requestedPath = (location.state as LocationState | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to={requestedPath ?? homePathFor(user.role)} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const loggedIn = await login({ email: email.trim(), password });
      navigate(requestedPath ?? homePathFor(loggedIn.role), { replace: true });
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <h1 className="mb-6 text-xl font-bold sm:text-2xl">התחברות</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorMessage message={error} />}
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
        <FormField label="סיסמה" htmlFor="password">
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </FormField>
        <button type="submit" disabled={submitting} className={`${primaryButtonClass} w-full`}>
          {submitting ? 'מתחבר...' : 'התחברות'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        עדיין אין לכם חשבון?{' '}
        <Link to="/register" className="font-medium text-teal-700 hover:underline">
          הצטרפו כמטפל/ת
        </Link>
      </p>
    </div>
  );
}
