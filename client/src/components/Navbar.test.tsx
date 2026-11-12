import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TOKEN_KEY } from '../api/client';
import { adminUser, LocationProbe, renderWithProviders, therapistUser } from '../test/utils';
import Navbar from './Navbar';

const page = (
  <>
    <Navbar />
    <LocationProbe />
  </>
);

describe('Navbar', () => {
  it('offers login and sign-up to anonymous visitors, and nothing account-related', () => {
    renderWithProviders(page);
    expect(screen.getByRole('link', { name: 'חיפוש' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'התחברות' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'הצטרפות כמטפל/ת' })).toHaveAttribute('href', '/register');
    expect(screen.queryByRole('button', { name: 'התנתקות' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'האזור האישי' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'ניהול' })).not.toBeInTheDocument();
  });

  it('gives a therapist their personal area and a logout button, but no admin link', () => {
    renderWithProviders(page, { user: therapistUser });
    expect(screen.getByRole('link', { name: 'האזור האישי' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('button', { name: 'התנתקות' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'ניהול' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'התחברות' })).not.toBeInTheDocument();
  });

  it('gives an admin the admin link INSTEAD of the therapist dashboard', () => {
    renderWithProviders(page, { user: adminUser });
    expect(screen.getByRole('link', { name: 'ניהול' })).toHaveAttribute('href', '/admin');
    expect(screen.queryByRole('link', { name: 'האזור האישי' })).not.toBeInTheDocument();
  });

  it('logging out ends the session and returns to the home page', async () => {
    renderWithProviders(page, { user: therapistUser, route: '/dashboard' });
    await userEvent.click(screen.getByRole('button', { name: 'התנתקות' }));

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
    expect(screen.getByRole('link', { name: 'התחברות' })).toBeInTheDocument();
  });
});
