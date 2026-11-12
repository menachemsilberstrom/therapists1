import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { authApi } from '../api/services';
import { adminUser, httpError, LocationProbe, renderWithProviders, therapistUser } from '../test/utils';
import Login from './Login';

vi.mock('../api/services', () => ({ authApi: { login: vi.fn(), register: vi.fn() } }));

function App() {
  return (
    <>
      <LocationProbe />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<div>REGISTER PAGE</div>} />
        <Route path="/dashboard" element={<div>DASHBOARD PAGE</div>} />
        <Route path="/admin" element={<div>ADMIN PAGE</div>} />
        <Route path="/admin/therapists/9" element={<div>ADMIN DETAIL PAGE</div>} />
      </Routes>
    </>
  );
}

async function signIn(email = 'dana@example.com', password = 'secret-pass-123') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('אימייל'), email);
  await user.type(screen.getByLabelText('סיסמה'), password);
  await user.click(screen.getByRole('button', { name: 'התחברות' }));
}

describe('Login page', () => {
  it('renders the form with sensible input types', () => {
    renderWithProviders(<App />, { route: '/login' });
    expect(screen.getByRole('heading', { name: 'התחברות' })).toBeInTheDocument();
    expect(screen.getByLabelText('אימייל')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('אימייל')).toBeRequired();
    expect(screen.getByLabelText('סיסמה')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('סיסמה')).toBeRequired();
    expect(screen.getByRole('link', { name: 'הצטרפו כמטפל/ת' })).toHaveAttribute('href', '/register');
  });

  it('sends the credentials and lands a therapist on their dashboard', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ token: 'jwt', user: therapistUser });
    renderWithProviders(<App />, { route: '/login' });
    await signIn();

    await waitFor(() => expect(screen.getByText('DASHBOARD PAGE')).toBeInTheDocument());
    expect(authApi.login).toHaveBeenCalledWith({ email: 'dana@example.com', password: 'secret-pass-123' });
    expect(localStorage.getItem('auth_token')).toBe('jwt');
  });

  it('lands an admin on the admin panel', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ token: 'jwt', user: adminUser });
    renderWithProviders(<App />, { route: '/login' });
    await signIn('admin@example.com');
    await waitFor(() => expect(screen.getByText('ADMIN PAGE')).toBeInTheDocument());
  });

  it('returns to the page the visitor was originally heading for', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ token: 'jwt', user: adminUser });
    renderWithProviders(<App />, { route: { pathname: '/login', state: { from: '/admin/therapists/9' } } });
    await signIn('admin@example.com');
    await waitFor(() => expect(screen.getByText('ADMIN DETAIL PAGE')).toBeInTheDocument());
  });

  it.each([
    [401, 'אימייל או סיסמה שגויים'],
    [429, 'יותר מדי ניסיונות'],
    [403, 'אין לכם הרשאה'],
    [500, 'אירעה שגיאה בשרת'],
  ])('shows a Hebrew error for HTTP %i and stays on the page', async (status, message) => {
    vi.mocked(authApi.login).mockRejectedValue(httpError(status));
    renderWithProviders(<App />, { route: '/login' });
    await signIn();

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('keeps what was typed after a failed attempt, and clears the error on the next try', async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce(httpError(401)).mockResolvedValueOnce({ token: 'jwt', user: therapistUser });
    renderWithProviders(<App />, { route: '/login' });
    await signIn();
    await screen.findByRole('alert');
    expect(screen.getByLabelText('אימייל')).toHaveValue('dana@example.com');

    await userEvent.click(screen.getByRole('button', { name: 'התחברות' }));
    await waitFor(() => expect(screen.getByText('DASHBOARD PAGE')).toBeInTheDocument());
  });

  it('disables the button while signing in, so it cannot be double-submitted', async () => {
    let finish: (value: { token: string; user: typeof therapistUser }) => void = () => undefined;
    vi.mocked(authApi.login).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderWithProviders(<App />, { route: '/login' });
    await signIn();

    const busy = await screen.findByRole('button', { name: 'מתחבר...' });
    expect(busy).toBeDisabled();
    finish({ token: 'jwt', user: therapistUser });
    await waitFor(() => expect(screen.getByText('DASHBOARD PAGE')).toBeInTheDocument());
    expect(authApi.login).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a therapist', therapistUser, 'DASHBOARD PAGE'],
    ['an admin', adminUser, 'ADMIN PAGE'],
  ])('skips the form for %s who is already logged in', (_who, user, page) => {
    renderWithProviders(<App />, { route: '/login', user });
    expect(screen.getByText(page)).toBeInTheDocument();
    expect(screen.queryByLabelText('אימייל')).not.toBeInTheDocument();
  });
});
