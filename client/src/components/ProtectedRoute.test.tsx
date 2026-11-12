import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { adminUser, LocationProbe, renderWithProviders, therapistUser } from '../test/utils';
import ProtectedRoute from './ProtectedRoute';

function App() {
  return (
    <>
      <LocationProbe />
      <Routes>
        <Route path="/" element={<div>HOME PAGE</div>} />
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>DASHBOARD PAGE</div>} />
        </Route>
        <Route element={<ProtectedRoute roles={['ADMIN']} />}>
          <Route path="/admin" element={<div>ADMIN PAGE</div>} />
          <Route path="/admin/therapists/5" element={<div>ADMIN DETAIL PAGE</div>} />
        </Route>
      </Routes>
    </>
  );
}

describe('ProtectedRoute', () => {
  it('sends a visitor who is not logged in to the login page and remembers where they were going', () => {
    renderWithProviders(<App />, { route: '/dashboard' });
    expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
    expect(screen.getByTestId('from')).toHaveTextContent('/dashboard');
  });

  it('lets a logged-in user through', () => {
    renderWithProviders(<App />, { route: '/dashboard', user: therapistUser });
    expect(screen.getByText('DASHBOARD PAGE')).toBeInTheDocument();
  });

  it('keeps anonymous visitors out of the admin area too', () => {
    renderWithProviders(<App />, { route: '/admin/therapists/5' });
    expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument();
    expect(screen.getByTestId('from')).toHaveTextContent('/admin/therapists/5');
  });

  it('sends a logged-in therapist away from the admin area (back to the home page)', () => {
    renderWithProviders(<App />, { route: '/admin', user: therapistUser });
    expect(screen.queryByText('ADMIN PAGE')).not.toBeInTheDocument();
    expect(screen.getByText('HOME PAGE')).toBeInTheDocument();
  });

  it('lets an admin into the admin area, including nested pages', () => {
    renderWithProviders(<App />, { route: '/admin', user: adminUser });
    expect(screen.getByText('ADMIN PAGE')).toBeInTheDocument();
  });

  it('lets an admin open an admin detail page directly', () => {
    renderWithProviders(<App />, { route: '/admin/therapists/5', user: adminUser });
    expect(screen.getByText('ADMIN DETAIL PAGE')).toBeInTheDocument();
  });
});
