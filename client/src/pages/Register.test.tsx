import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { authApi } from '../api/services';
import { httpError, LocationProbe, renderWithProviders, therapistUser } from '../test/utils';
import Register from './Register';

vi.mock('../api/services', () => ({ authApi: { login: vi.fn(), register: vi.fn() } }));

const newUser = { ...therapistUser, email: 'new@example.com', status: 'PENDING_APPROVAL' as const };

function App() {
  return (
    <>
      <LocationProbe />
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
        <Route path="/dashboard" element={<div>DASHBOARD PAGE</div>} />
      </Routes>
    </>
  );
}

interface Fields {
  fullName?: string;
  email?: string;
  password?: string;
  confirm?: string;
}

async function fillAndSubmit({ fullName = 'דנה כהן', email = 'new@example.com', password = 'secret-pass-123', confirm = password }: Fields = {}) {
  const user = userEvent.setup();
  if (fullName) await user.type(screen.getByLabelText('שם מלא'), fullName);
  await user.type(screen.getByLabelText('אימייל'), email);
  await user.type(screen.getByLabelText('סיסמה'), password);
  await user.type(screen.getByLabelText('אימות סיסמה'), confirm);
  await user.click(screen.getByRole('button', { name: 'יצירת חשבון' }));
}

describe('Register page', () => {
  it('creates the account and goes to the dashboard (where the "waiting for approval" banner appears)', async () => {
    vi.mocked(authApi.register).mockResolvedValue({ token: 'jwt', user: newUser });
    renderWithProviders(<App />, { route: '/register' });
    await fillAndSubmit();

    await waitFor(() => expect(screen.getByText('DASHBOARD PAGE')).toBeInTheDocument());
    expect(authApi.register).toHaveBeenCalledWith({ email: 'new@example.com', password: 'secret-pass-123', fullName: 'דנה כהן' });
    expect(localStorage.getItem('auth_token')).toBe('jwt');
  });

  it('sends no full name when the field is left empty', async () => {
    vi.mocked(authApi.register).mockResolvedValue({ token: 'jwt', user: newUser });
    renderWithProviders(<App />, { route: '/register' });
    await fillAndSubmit({ fullName: '' });
    await waitFor(() => expect(authApi.register).toHaveBeenCalled());
    expect(vi.mocked(authApi.register).mock.calls[0]?.[0]).toEqual({ email: 'new@example.com', password: 'secret-pass-123', fullName: undefined });
  });

  it('refuses mismatching passwords without calling the server', async () => {
    renderWithProviders(<App />, { route: '/register' });
    await fillAndSubmit({ password: 'secret-pass-123', confirm: 'different-pass-123' });
    expect(await screen.findByRole('alert')).toHaveTextContent('הסיסמאות אינן תואמות');
    expect(authApi.register).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/register');
  });

  it('refuses a password shorter than 8 characters without calling the server', async () => {
    renderWithProviders(<App />, { route: '/register' });
    await fillAndSubmit({ password: 'short', confirm: 'short' });
    expect(await screen.findByRole('alert')).toHaveTextContent('לפחות 8 תווים');
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it('accepts exactly 8 characters', async () => {
    vi.mocked(authApi.register).mockResolvedValue({ token: 'jwt', user: newUser });
    renderWithProviders(<App />, { route: '/register' });
    await fillAndSubmit({ password: '12345678' });
    await waitFor(() => expect(authApi.register).toHaveBeenCalled());
  });

  it.each([
    [409, 'כתובת האימייל כבר רשומה'],
    [400, 'הנתונים שהוזנו אינם תקינים'],
    [429, 'יותר מדי ניסיונות'],
  ])('shows a Hebrew error for HTTP %i and keeps the visitor on the form', async (status, message) => {
    vi.mocked(authApi.register).mockRejectedValue(httpError(status));
    renderWithProviders(<App />, { route: '/register' });
    await fillAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByTestId('location')).toHaveTextContent('/register');
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('disables the button while the account is being created', async () => {
    let finish: (value: { token: string; user: typeof newUser }) => void = () => undefined;
    vi.mocked(authApi.register).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderWithProviders(<App />, { route: '/register' });
    await fillAndSubmit();
    expect(await screen.findByRole('button', { name: 'יוצר חשבון...' })).toBeDisabled();
    finish({ token: 'jwt', user: newUser });
    await waitFor(() => expect(screen.getByText('DASHBOARD PAGE')).toBeInTheDocument());
  });

  it('sends a logged-in visitor straight to the dashboard', () => {
    renderWithProviders(<App />, { route: '/register', user: therapistUser });
    expect(screen.getByText('DASHBOARD PAGE')).toBeInTheDocument();
  });

  it('links to the login page and marks every field as required except the name', () => {
    renderWithProviders(<App />, { route: '/register' });
    expect(screen.getByRole('link', { name: 'התחברות' })).toHaveAttribute('href', '/login');
    expect(screen.getByLabelText('שם מלא')).not.toBeRequired();
    for (const label of ['אימייל', 'סיסמה', 'אימות סיסמה']) expect(screen.getByLabelText(label)).toBeRequired();
  });
});
