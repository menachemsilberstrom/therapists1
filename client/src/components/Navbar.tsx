import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// min-h-11 keeps every nav item a comfortable 44px touch target.
const linkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition ${
    isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'
  }`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      {/* On narrow phones the logo takes the first row and the links wrap to the next one. */}
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 gap-y-0 px-4 py-1 sm:gap-x-2">
        <Link to="/" className="me-auto inline-flex min-h-11 items-center text-lg font-bold text-teal-700">
          מדריך המטפלים
        </Link>

        <NavLink to="/" end className={linkClass}>
          חיפוש
        </NavLink>

        {user ? (
          <>
            {user.role === 'ADMIN' ? (
              <NavLink to="/admin" className={linkClass}>
                ניהול
              </NavLink>
            ) : (
              <NavLink to="/dashboard" className={linkClass}>
                האזור האישי
              </NavLink>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              התנתקות
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login" className={linkClass}>
              התחברות
            </NavLink>
            <Link
              to="/register"
              className="inline-flex min-h-11 items-center rounded-md bg-teal-600 px-3 text-sm font-medium text-white transition hover:bg-teal-700"
            >
              הצטרפות כמטפל/ת
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
