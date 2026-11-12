import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AUTH_EXPIRED_EVENT, TOKEN_KEY } from '../api/client';
import { authApi } from '../api/services';
import { renderWithProviders, therapistUser } from '../test/utils';
import type { AuthUser } from '../types';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('../api/services', () => ({ authApi: { login: vi.fn(), register: vi.fn() } }));

let loggedInUser: AuthUser | undefined;

function Probe() {
  const { user, login, register, logout } = useAuth();
  return (
    <div>
      <span data-testid="who">{user ? `${user.email} (${user.role})` : 'nobody'}</span>
      <button
        onClick={() =>
          void login({ email: 'dana@example.com', password: 'secret-123' })
            .then((u) => (loggedInUser = u))
            .catch(() => undefined) // a real screen shows the error; here we only need the call not to blow up
        }
      >
        login
      </button>
      <button onClick={() => void register({ email: 'new@example.com', password: 'secret-123', fullName: 'חדשה' })}>register</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

describe('AuthProvider', () => {
  it('starts logged out when nothing is stored', () => {
    renderWithProviders(<Probe />);
    expect(screen.getByTestId('who')).toHaveTextContent('nobody');
  });

  it('restores a saved session after a page reload', () => {
    renderWithProviders(<Probe />, { user: therapistUser });
    expect(screen.getByTestId('who')).toHaveTextContent('dana@example.com (THERAPIST)');
  });

  // These two prepare storage by hand and render with a plain render() (the shared helper wipes storage first).
  it('treats a saved user without a token as logged out', () => {
    localStorage.setItem('auth_user', JSON.stringify(therapistUser)); // a user, but no token
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByTestId('who')).toHaveTextContent('nobody');
  });

  it('survives corrupted storage instead of crashing', () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    localStorage.setItem('auth_user', '{this is not json');
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByTestId('who')).toHaveTextContent('nobody');
  });

  it('login stores the token and user, updates the app, and hands the user back to the caller', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ token: 'jwt-123', user: therapistUser });
    renderWithProviders(<Probe />);
    await userEvent.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('dana@example.com (THERAPIST)'));
    expect(localStorage.getItem(TOKEN_KEY)).toBe('jwt-123');
    expect(JSON.parse(localStorage.getItem('auth_user') as string)).toEqual(therapistUser);
    expect(loggedInUser).toEqual(therapistUser);
    expect(authApi.login).toHaveBeenCalledWith({ email: 'dana@example.com', password: 'secret-123' });
  });

  it('a failed login leaves the user logged out and stores nothing', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new Error('401'));
    renderWithProviders(<Probe />);
    await userEvent.click(screen.getByText('login'));
    // let the rejected promise settle
    await act(async () => {});
    expect(screen.getByTestId('who')).toHaveTextContent('nobody');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('register logs the new user in right away', async () => {
    vi.mocked(authApi.register).mockResolvedValue({ token: 'jwt-new', user: { ...therapistUser, email: 'new@example.com', status: 'PENDING_APPROVAL' } });
    renderWithProviders(<Probe />);
    await userEvent.click(screen.getByText('register'));
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('new@example.com'));
    expect(localStorage.getItem(TOKEN_KEY)).toBe('jwt-new');
  });

  it('logout clears the session from the app and from storage', async () => {
    renderWithProviders(<Probe />, { user: therapistUser });
    await userEvent.click(screen.getByText('logout'));
    expect(screen.getByTestId('who')).toHaveTextContent('nobody');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem('auth_user')).toBeNull();
  });

  it('logs out automatically when the API reports an expired or suspended session', async () => {
    renderWithProviders(<Probe />, { user: therapistUser });
    expect(screen.getByTestId('who')).toHaveTextContent('dana@example.com');
    act(() => {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    });
    expect(screen.getByTestId('who')).toHaveTextContent('nobody');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
