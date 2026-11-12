import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from '../api/services';
import { adminUser, httpError, LocationProbe, makeAdminDetail, renderWithProviders } from '../test/utils';
import type { AdminCertificate, AdminTherapistDetail } from '../types';
import AdminTherapistPage from './AdminTherapistPage';

vi.mock('../api/services', () => ({
  adminApi: {
    getTherapist: vi.fn(),
    setStatus: vi.fn(),
    setCertificateVerified: vi.fn(),
    fetchCertificate: vi.fn(),
    deleteTherapist: vi.fn(),
  },
}));

const cert = (overrides: Partial<AdminCertificate> = {}): AdminCertificate => ({
  id: 'c1',
  title: 'תואר שני',
  originalName: 'degree.pdf',
  uploadedAt: '2026-01-02T00:00:00.000Z',
  isVerified: false,
  fileType: 'pdf',
  ...overrides,
});

async function openPage(detail: AdminTherapistDetail = makeAdminDetail()) {
  vi.mocked(adminApi.getTherapist).mockResolvedValue(detail);
  renderWithProviders(
    <>
      <LocationProbe />
      <Routes>
        <Route path="/admin/therapists/:id" element={<AdminTherapistPage />} />
        <Route path="/admin" element={<div>ADMIN LIST PAGE</div>} />
      </Routes>
    </>,
    { route: `/admin/therapists/${detail.id}`, user: adminUser },
  );
  await screen.findByRole('heading', { level: 1 });
  return userEvent.setup();
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:cert');
  URL.revokeObjectURL = vi.fn();
});

describe('AdminTherapistPage: review', () => {
  it('shows who the account belongs to and what state it is in', async () => {
    await openPage(makeAdminDetail({ fullName: 'דנה כהן', email: 'dana@example.com', accountStatus: 'PENDING_APPROVAL', isPubliclyVisible: false }));
    expect(screen.getByRole('heading', { level: 1, name: 'דנה כהן' })).toBeInTheDocument();
    expect(screen.getAllByText('dana@example.com').length).toBeGreaterThan(0);
    expect(screen.getByText('ממתין לאישור')).toBeInTheDocument();
    expect(screen.getByText('מוסתר מהציבור')).toBeInTheDocument();
  });

  it('shows the full profile for the decision: location, contact, categories, bio', async () => {
    await openPage(
      makeAdminDetail({
        city: 'חיפה',
        region: 'NORTH',
        acceptsOnline: true,
        targetAudiences: ['ADULTS', 'COUPLES'],
        categories: [{ id: '1', name: 'חרדה', slug: 'anxiety' }],
        contactInfo: { phone: '050-1234567', whatsapp: '0501234567', email: 'contact@example.com' },
        bio: 'אני מטפלת עם ניסיון',
      }),
    );
    expect(screen.getByRole('heading', { name: 'פרטי הפרופיל' })).toBeInTheDocument();
    expect(screen.getByText('צפון')).toBeInTheDocument();
    expect(screen.getByText('מבוגרים, זוגות')).toBeInTheDocument();
    expect(screen.getByText('חרדה')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '050-1234567' })).toHaveAttribute('href', 'tel:0501234567');
    expect(screen.getByText('אני מטפלת עם ניסיון')).toBeInTheDocument();
  });

  it('labels sample-data accounts', async () => {
    await openPage(makeAdminDetail({ isSeeded: true }));
    expect(screen.getByText('נתוני דוגמה')).toBeInTheDocument();
  });

  it('an account without a profile can be inspected, but not approved', async () => {
    await openPage(makeAdminDetail({ hasProfile: false, fullName: '', accountStatus: 'PENDING_APPROVAL' }));
    expect(screen.getByText('אין פרופיל')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'פרטי הפרופיל' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'אישור' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'מחיקה לצמיתות' })).toBeInTheDocument(); // but it can still be deleted
  });

  it('says so when the account does not exist (any more)', async () => {
    vi.mocked(adminApi.getTherapist).mockRejectedValue(httpError(404));
    renderWithProviders(
      <Routes>
        <Route path="/admin/therapists/:id" element={<AdminTherapistPage />} />
      </Routes>,
      { route: '/admin/therapists/gone', user: adminUser },
    );
    expect(await screen.findByText('המטפל/ת לא נמצא/ה')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'חזרה לניהול' })).toHaveAttribute('href', '/admin');
  });

  it('links to the public page only while the profile is live', async () => {
    await openPage(makeAdminDetail({ accountStatus: 'ACTIVE', isPubliclyVisible: true, slug: 'dana-abc' }));
    expect(screen.getByRole('link', { name: 'צפייה בדף הציבורי' })).toHaveAttribute('href', '/therapist/dana-abc');
  });

  it('has no public-page link while hidden', async () => {
    await openPage(makeAdminDetail({ isPubliclyVisible: false }));
    expect(screen.queryByRole('link', { name: 'צפייה בדף הציבורי' })).not.toBeInTheDocument();
  });
});

describe('AdminTherapistPage: approve, suspend, reactivate', () => {
  it.each([
    ['PENDING_APPROVAL', ['אישור', 'דחייה (השעיה)']],
    ['ACTIVE', ['השעיה']],
    ['SUSPENDED', ['הפעלה מחדש']],
  ] as const)('a %s account offers exactly the sensible actions', async (status, expected) => {
    await openPage(makeAdminDetail({ accountStatus: status, isPubliclyVisible: status === 'ACTIVE' }));
    const present = ['אישור', 'דחייה (השעיה)', 'השעיה', 'הפעלה מחדש'].filter((name) => screen.queryByRole('button', { name }));
    expect(present).toEqual(expected);
  });

  it('approves after confirmation and shows the new state from the server', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = await openPage();
    vi.mocked(adminApi.setStatus).mockResolvedValue(makeAdminDetail({ accountStatus: 'ACTIVE', isPubliclyVisible: true, slug: 'dana-abc' }));
    await user.click(screen.getByRole('button', { name: 'אישור' }));

    await waitFor(() => expect(adminApi.setStatus).toHaveBeenCalledWith('u1', 'ACTIVE'));
    expect(await screen.findByText('החשבון פעיל והפרופיל מוצג בחיפוש.')).toBeInTheDocument();
    expect(screen.getByText('מוצג בחיפוש')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'השעיה' })).toBeInTheDocument(); // the buttons follow the new state
    expect(screen.queryByRole('button', { name: 'אישור' })).not.toBeInTheDocument();
  });

  it('suspends after a warning that the user is locked out', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = await openPage(makeAdminDetail({ accountStatus: 'ACTIVE', isPubliclyVisible: true }));
    vi.mocked(adminApi.setStatus).mockResolvedValue(makeAdminDetail({ accountStatus: 'SUSPENDED', isPubliclyVisible: false }));
    await user.click(screen.getByRole('button', { name: 'השעיה' }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('לא יוכל/תוכל להתחבר'));
    await waitFor(() => expect(adminApi.setStatus).toHaveBeenCalledWith('u1', 'SUSPENDED'));
    expect(await screen.findByText('החשבון הושעה והפרופיל הוסתר.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'הפעלה מחדש' })).toBeInTheDocument();
  });

  it('changes nothing when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = await openPage();
    await user.click(screen.getByRole('button', { name: 'אישור' }));
    expect(adminApi.setStatus).not.toHaveBeenCalled();
  });

  it('shows a Hebrew error and keeps the old state when the server refuses', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = await openPage();
    vi.mocked(adminApi.setStatus).mockRejectedValue(httpError(409, { code: 'NO_PROFILE' }));
    await user.click(screen.getByRole('button', { name: 'אישור' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('אין פרופיל');
    expect(screen.getByText('ממתין לאישור')).toBeInTheDocument();
  });
});

describe('AdminTherapistPage: certificates', () => {
  const withCert = (overrides: Partial<AdminCertificate> = {}) => makeAdminDetail({ certificateCount: 1, certificates: [cert(overrides)] });

  it('lists each certificate with its title, file name, type and verification state', async () => {
    await openPage(withCert());
    expect(screen.getByText('תואר שני')).toBeInTheDocument();
    expect(screen.getByText(/degree\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/PDF/)).toBeInTheDocument();
    expect(screen.getByText('ממתינה לאימות')).toBeInTheDocument();
  });

  it('says so when there are no certificates', async () => {
    await openPage(makeAdminDetail({ certificates: [] }));
    expect(screen.getByText('לא הועלו תעודות.')).toBeInTheDocument();
  });

  it('opens the private file with the admin token, from a temporary local URL', async () => {
    const popup = { opener: {} as unknown, close: vi.fn(), location: { href: '' } };
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    vi.mocked(adminApi.fetchCertificate).mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
    const user = await openPage(withCert());
    await user.click(screen.getByRole('button', { name: 'צפייה בקובץ' }));

    await waitFor(() => expect(popup.location.href).toBe('blob:cert'));
    expect(adminApi.fetchCertificate).toHaveBeenCalledWith('u1', 'c1');
    expect(popup.opener).toBeNull(); // the new tab gets no handle back to the admin page
    expect(popup.close).not.toHaveBeenCalled();
  });

  it('closes the blank tab and shows an error when the file cannot be fetched', async () => {
    const popup = { opener: {} as unknown, close: vi.fn(), location: { href: '' } };
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    vi.mocked(adminApi.fetchCertificate).mockRejectedValue(httpError(404));
    const user = await openPage(withCert());
    await user.click(screen.getByRole('button', { name: 'צפייה בקובץ' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('לא נמצא');
    expect(popup.close).toHaveBeenCalled();
    expect(popup.location.href).toBe('');
  });

  it('verifies a certificate and then offers to cancel the verification', async () => {
    const user = await openPage(withCert());
    vi.mocked(adminApi.setCertificateVerified).mockResolvedValue(withCert({ isVerified: true }));
    await user.click(screen.getByRole('button', { name: 'אימות' }));

    await waitFor(() => expect(adminApi.setCertificateVerified).toHaveBeenCalledWith('u1', 'c1', true));
    expect(await screen.findByRole('button', { name: 'ביטול אימות' })).toBeInTheDocument();
    expect(screen.getByText('אומתה')).toBeInTheDocument();
  });

  it('can cancel a verification', async () => {
    const user = await openPage(withCert({ isVerified: true }));
    vi.mocked(adminApi.setCertificateVerified).mockResolvedValue(withCert({ isVerified: false }));
    await user.click(screen.getByRole('button', { name: 'ביטול אימות' }));
    await waitFor(() => expect(adminApi.setCertificateVerified).toHaveBeenCalledWith('u1', 'c1', false));
  });
});

describe('AdminTherapistPage: guarded deletion', () => {
  const typeInto = (value: string) => userEvent.type(screen.getByLabelText(/להקלדה לאישור/), value);
  const deleteButton = () => screen.getByRole('button', { name: 'מחיקה לצמיתות' });

  it('starts with the delete button disabled and explains what will be removed', async () => {
    await openPage();
    expect(deleteButton()).toBeDisabled();
    expect(screen.getByText(/מוחקת לצמיתות את החשבון, הפרופיל, תמונת הפרופיל וכל התעודות/)).toBeInTheDocument();
  });

  it('stays disabled for a wrong or partial e-mail', async () => {
    await openPage(makeAdminDetail({ email: 'dana@example.com' }));
    await typeInto('dana@example');
    expect(deleteButton()).toBeDisabled();
    await userEvent.clear(screen.getByLabelText(/להקלדה לאישור/));
    await typeInto('someone.else@example.com');
    expect(deleteButton()).toBeDisabled();
  });

  it('never calls the server while the e-mail does not match, even if clicked', async () => {
    const user = await openPage();
    await typeInto('nope');
    await user.click(deleteButton());
    expect(adminApi.deleteTherapist).not.toHaveBeenCalled();
  });

  it('enables for the exact e-mail (letter case ignored), deletes, and returns to the list', async () => {
    vi.mocked(adminApi.deleteTherapist).mockResolvedValue({ deleted: true, filesRemoved: 2 });
    const user = await openPage(makeAdminDetail({ email: 'dana@example.com' }));
    await typeInto('DANA@Example.com');
    expect(deleteButton()).toBeEnabled();
    await user.click(deleteButton());

    await waitFor(() => expect(adminApi.deleteTherapist).toHaveBeenCalledWith('u1', 'DANA@Example.com'));
    expect(await screen.findByText('ADMIN LIST PAGE')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/admin?tab=therapists');
  });

  it('shows the server refusal in Hebrew and stays on the page', async () => {
    vi.mocked(adminApi.deleteTherapist).mockRejectedValue(httpError(400, { code: 'CONFIRMATION_MISMATCH' }));
    const user = await openPage(makeAdminDetail({ email: 'dana@example.com' }));
    await typeInto('dana@example.com');
    await user.click(deleteButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('לא נמחק דבר');
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/therapists/u1');
  });
});
