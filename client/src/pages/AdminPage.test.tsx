import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { adminApi } from '../api/services';
import { adminUser, httpError, LocationProbe, makeAdminDetail, renderWithProviders } from '../test/utils';
import type { AdminCategory, AdminTherapistRow, PagedResult } from '../types';
import AdminPage from './AdminPage';

vi.mock('../api/services', () => ({
  adminApi: {
    stats: vi.fn(),
    listTherapists: vi.fn(),
    setStatus: vi.fn(),
    listCategories: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
  },
}));

const row = (overrides: Partial<AdminTherapistRow> = {}): AdminTherapistRow => ({
  id: 'u1',
  email: 'dana@example.com',
  accountStatus: 'PENDING_APPROVAL',
  isSeeded: false,
  hasProfile: true,
  fullName: 'דנה כהן',
  professionalTitle: 'פסיכולוגית',
  city: 'חיפה',
  isPubliclyVisible: false,
  certificateCount: 2,
  verifiedCertificateCount: 1,
  createdAt: '2026-03-04T00:00:00.000Z',
  ...overrides,
});

const rows = (items: AdminTherapistRow[], overrides: Partial<PagedResult<AdminTherapistRow>> = {}): PagedResult<AdminTherapistRow> => ({
  items,
  total: items.length,
  page: 1,
  limit: 20,
  totalPages: 1,
  ...overrides,
});

const category = (overrides: Partial<AdminCategory> = {}): AdminCategory => ({ id: 'k1', name: 'חרדה', slug: 'anxiety', isActive: true, usageCount: 3, ...overrides });

async function openAdmin(route = '/admin', list = rows([row()])) {
  vi.mocked(adminApi.stats).mockResolvedValue({ pending: 7, active: 20, suspended: 4, total: 31 });
  vi.mocked(adminApi.listTherapists).mockResolvedValue(list);
  vi.mocked(adminApi.listCategories).mockResolvedValue([category(), category({ id: 'k2', name: 'ישנה', slug: 'old', isActive: false, usageCount: 0 })]);
  renderWithProviders(
    <>
      <LocationProbe />
      <AdminPage />
    </>,
    { route, user: adminUser },
  );
  await screen.findByRole('heading', { name: 'ניהול האתר' });
  return userEvent.setup();
}

const lastList = () => vi.mocked(adminApi.listTherapists).mock.calls.at(-1)?.[0];

describe('AdminPage: overview and tabs', () => {
  it('summarises the site and shows the pending counter on the first tab', async () => {
    await openAdmin();
    expect(await screen.findByText('31 מטפלים: 20 פעילים, 7 ממתינים לאישור, 4 מושעים.')).toBeInTheDocument();
    const pendingTab = screen.getByRole('tab', { name: /ממתינים לאישור/ });
    expect(pendingTab).toHaveAttribute('aria-selected', 'true');
    expect(within(pendingTab).getByText('7')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('hides the counter when nothing is pending', async () => {
    vi.mocked(adminApi.stats).mockResolvedValue({ pending: 0, active: 5, suspended: 0, total: 5 });
    vi.mocked(adminApi.listTherapists).mockResolvedValue(rows([]));
    renderWithProviders(<AdminPage />, { user: adminUser });
    await screen.findByText('5 מטפלים: 5 פעילים, 0 ממתינים לאישור, 0 מושעים.');
    expect(within(screen.getByRole('tab', { name: /ממתינים לאישור/ })).queryByText('0')).not.toBeInTheDocument();
  });

  it('still works when the counters cannot be loaded', async () => {
    vi.mocked(adminApi.stats).mockRejectedValue(httpError(500));
    vi.mocked(adminApi.listTherapists).mockResolvedValue(rows([row()]));
    renderWithProviders(<AdminPage />, { user: adminUser });
    expect(await screen.findByText('דנה כהן')).toBeInTheDocument();
  });

  it('opens the tab named in the URL, and falls back to the queue for a bogus one', async () => {
    await openAdmin('/admin?tab=categories');
    expect(screen.getByRole('tab', { name: 'קטגוריות' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('ישנה')).toBeInTheDocument();
  });

  it('falls back to the pending queue for an unknown tab name', async () => {
    await openAdmin('/admin?tab=nonsense');
    expect(screen.getByRole('tab', { name: /ממתינים לאישור/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('switching tabs updates the URL', async () => {
    const user = await openAdmin();
    await user.click(screen.getByRole('tab', { name: 'קטגוריות' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/admin?tab=categories');
    await user.click(screen.getByRole('tab', { name: /ממתינים לאישור/ }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/admin$/);
  });
});

describe('AdminPage: moderation queue', () => {
  it('asks for pending accounts, oldest first, and describes each one', async () => {
    await openAdmin('/admin', rows([row(), row({ id: 'u2', fullName: 'יוסי לוי', email: 'yossi@example.com', certificateCount: 0, verifiedCertificateCount: 0, isSeeded: true })]));
    await screen.findByText('יוסי לוי');
    expect(lastList()).toEqual(expect.objectContaining({ status: 'PENDING_APPROVAL', sort: 'oldest', page: 1 }));
    expect(screen.getByText('dana@example.com')).toBeInTheDocument();
    expect(screen.getByText(/2 תעודות \(1 אומתו\)/)).toBeInTheDocument();
    expect(screen.getByText(/ללא תעודות/)).toBeInTheDocument();
    expect(screen.getByText('נתוני דוגמה')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'פתיחה ובדיקה' })[0]).toHaveAttribute('href', '/admin/therapists/u1');
  });

  it('says so when the queue is empty', async () => {
    await openAdmin('/admin', rows([]));
    expect(await screen.findByText('אין מטפלים הממתינים לאישור.')).toBeInTheDocument();
  });

  it('marks an account that has no profile and offers no quick approval for it', async () => {
    await openAdmin('/admin', rows([row({ id: 'u9', hasProfile: false, fullName: '', email: 'orphan@example.com' })]));
    expect(await screen.findByText('אין פרופיל')).toBeInTheDocument();
    expect(screen.getByText('ללא שם')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'אישור' })).not.toBeInTheDocument();
  });

  it('approves after confirmation, then reloads the queue and the counters', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = await openAdmin();
    vi.mocked(adminApi.setStatus).mockResolvedValue(makeAdminDetail({ accountStatus: 'ACTIVE', isPubliclyVisible: true }));
    await screen.findByText('דנה כהן');
    const statsCallsBefore = vi.mocked(adminApi.stats).mock.calls.length;
    const listCallsBefore = vi.mocked(adminApi.listTherapists).mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'אישור' }));

    await waitFor(() => expect(adminApi.setStatus).toHaveBeenCalledWith('u1', 'ACTIVE'));
    expect(await screen.findByText(/דנה כהן אושר\/ה/)).toBeInTheDocument();
    await waitFor(() => expect(vi.mocked(adminApi.listTherapists).mock.calls.length).toBeGreaterThan(listCallsBefore));
    expect(vi.mocked(adminApi.stats).mock.calls.length).toBeGreaterThan(statsCallsBefore);
  });

  it('does nothing when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = await openAdmin();
    await screen.findByText('דנה כהן');
    await user.click(screen.getByRole('button', { name: 'אישור' }));
    expect(adminApi.setStatus).not.toHaveBeenCalled();
  });

  it('shows a Hebrew error when approving fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = await openAdmin();
    vi.mocked(adminApi.setStatus).mockRejectedValue(httpError(409, { code: 'NO_PROFILE' }));
    await screen.findByText('דנה כהן');
    await user.click(screen.getByRole('button', { name: 'אישור' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('אין פרופיל');
  });

  it('shows a Hebrew error when the list cannot be loaded', async () => {
    vi.mocked(adminApi.stats).mockResolvedValue({ pending: 0, active: 0, suspended: 0, total: 0 });
    vi.mocked(adminApi.listTherapists).mockRejectedValue(httpError(500));
    renderWithProviders(<AdminPage />, { user: adminUser });
    expect(await screen.findByRole('alert')).toHaveTextContent('אירעה שגיאה בשרת');
  });
});

describe('AdminPage: all therapists', () => {
  it('lists everyone, newest first, with a status filter and search', async () => {
    const user = await openAdmin('/admin?tab=therapists');
    await screen.findByText('דנה כהן');
    expect(lastList()).toEqual(expect.objectContaining({ sort: 'newest', page: 1 }));
    expect(lastList()?.status).toBeUndefined();

    await user.selectOptions(screen.getByRole('combobox', { name: 'סינון לפי סטטוס' }), 'ACTIVE');
    await waitFor(() => expect(lastList()?.status).toBe('ACTIVE'));

    await user.type(screen.getByRole('searchbox', { name: 'חיפוש מטפלים' }), 'חיפה');
    await user.click(screen.getByRole('button', { name: 'חיפוש' }));
    await waitFor(() => expect(lastList()).toEqual(expect.objectContaining({ q: 'חיפה', status: 'ACTIVE', page: 1 })));
  });

  it('the all-therapists tab has no quick approve button (review happens on the detail page)', async () => {
    await openAdmin('/admin?tab=therapists');
    await screen.findByText('דנה כהן');
    expect(screen.queryByRole('button', { name: 'אישור' })).not.toBeInTheDocument();
  });

  it('pages through long lists', async () => {
    const user = await openAdmin('/admin?tab=therapists', rows([row()], { total: 45, page: 1, totalPages: 3 }));
    await screen.findByText('עמוד 1 מתוך 3');
    await user.click(screen.getByRole('button', { name: 'הבא' }));
    await waitFor(() => expect(lastList()?.page).toBe(2));
  });
});

describe('AdminPage: categories', () => {
  it('lists every category with its slug and usage, and marks deactivated ones', async () => {
    await openAdmin('/admin?tab=categories');
    expect(await screen.findByText('חרדה')).toBeInTheDocument();
    expect(screen.getByText('anxiety')).toBeInTheDocument();
    expect(screen.getByText(/3 פרופילים/)).toBeInTheDocument();
    expect(screen.getByText('מושבתת')).toBeInTheDocument();
  });

  it('adds a category with a Hebrew name and a latin slug', async () => {
    const user = await openAdmin('/admin?tab=categories');
    vi.mocked(adminApi.createCategory).mockResolvedValue(category({ id: 'k3', name: 'חרדה חברתית', slug: 'social-anxiety', usageCount: 0 }));
    await screen.findByText('חרדה');
    await user.type(screen.getByLabelText('שם בעברית'), 'חרדה חברתית');
    await user.type(screen.getByLabelText('מזהה (slug) באנגלית'), 'social-anxiety');
    await user.click(screen.getByRole('button', { name: 'הוספה' }));

    await waitFor(() => expect(adminApi.createCategory).toHaveBeenCalledWith({ name: 'חרדה חברתית', slug: 'social-anxiety' }));
    expect(await screen.findByText('הקטגוריה נוספה.')).toBeInTheDocument();
    expect(screen.getByText('חרדה חברתית')).toBeInTheDocument();
    expect(screen.getByLabelText('שם בעברית')).toHaveValue(''); // form cleared
  });

  it.each(['Social-Anxiety', 'social anxiety', 'חרדה', '-leading', 'double--hyphen', 'under_score'])(
    'the browser itself refuses the slug "%s", so nothing is sent to the server',
    async (badSlug) => {
      const user = await openAdmin('/admin?tab=categories');
      await screen.findByText('חרדה');
      await user.type(screen.getByLabelText('שם בעברית'), 'שם כלשהו');
      await user.type(screen.getByLabelText('מזהה (slug) באנגלית'), badSlug);
      await user.click(screen.getByRole('button', { name: 'הוספה' }));
      expect(adminApi.createCategory).not.toHaveBeenCalled();
    },
  );

  it('only accepts a latin slug in the form', async () => {
    await openAdmin('/admin?tab=categories');
    const slug = await screen.findByLabelText('מזהה (slug) באנגלית');
    expect(slug).toHaveAttribute('pattern', '[a-z0-9]+(-[a-z0-9]+)*');
    expect(slug).toHaveAttribute('dir', 'ltr');
  });

  it.each([
    ['CATEGORY_SLUG_TAKEN', 'המזהה (slug) הזה כבר בשימוש'],
    ['CATEGORY_NAME_TAKEN', 'כבר קיימת קטגוריה בשם הזה'],
  ])('shows a Hebrew message for the server code %s', async (code, message) => {
    const user = await openAdmin('/admin?tab=categories');
    vi.mocked(adminApi.createCategory).mockRejectedValue(httpError(409, { code }));
    await screen.findByText('חרדה');
    await user.type(screen.getByLabelText('שם בעברית'), 'שם כלשהו');
    await user.type(screen.getByLabelText('מזהה (slug) באנגלית'), 'some-slug');
    await user.click(screen.getByRole('button', { name: 'הוספה' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('renames a category', async () => {
    const user = await openAdmin('/admin?tab=categories');
    vi.mocked(adminApi.updateCategory).mockResolvedValue(category({ name: 'חרדה ומתח' }));
    await screen.findByText('חרדה');
    const item = screen.getByText('חרדה').closest('li') as HTMLElement;
    await user.click(within(item).getByRole('button', { name: 'שינוי שם' }));
    const input = screen.getByLabelText('שם חדש עבור חרדה');
    await user.clear(input);
    await user.type(input, 'חרדה ומתח');
    await user.click(screen.getByRole('button', { name: 'שמירה' }));

    await waitFor(() => expect(adminApi.updateCategory).toHaveBeenCalledWith('k1', { name: 'חרדה ומתח' }));
    expect(await screen.findByText('חרדה ומתח')).toBeInTheDocument();
    expect(screen.getByText('השם עודכן.')).toBeInTheDocument();
  });

  it('does not call the server when the name was not changed', async () => {
    const user = await openAdmin('/admin?tab=categories');
    await screen.findByText('חרדה');
    const item = screen.getByText('חרדה').closest('li') as HTMLElement;
    await user.click(within(item).getByRole('button', { name: 'שינוי שם' }));
    await user.click(screen.getByRole('button', { name: 'שמירה' }));
    expect(adminApi.updateCategory).not.toHaveBeenCalled();
  });

  it('deactivates after a warning that mentions how many profiles use it, and can reactivate', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = await openAdmin('/admin?tab=categories');
    vi.mocked(adminApi.updateCategory).mockResolvedValue(category({ isActive: false }));
    await screen.findByText('חרדה');

    const item = screen.getByText('חרדה').closest('li') as HTMLElement;
    await user.click(within(item).getByRole('button', { name: 'השבתה' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('3 פרופילים'));
    await waitFor(() => expect(adminApi.updateCategory).toHaveBeenCalledWith('k1', { isActive: false }));
    expect(await screen.findByText('הקטגוריה הושבתה.')).toBeInTheDocument();

    // reactivating needs no warning
    vi.mocked(adminApi.updateCategory).mockResolvedValue(category({ id: 'k2', name: 'ישנה', slug: 'old', isActive: true, usageCount: 0 }));
    confirm.mockClear();
    const oldItem = screen.getByText('ישנה').closest('li') as HTMLElement;
    await user.click(within(oldItem).getByRole('button', { name: 'הפעלה' }));
    await waitFor(() => expect(adminApi.updateCategory).toHaveBeenCalledWith('k2', { isActive: true }));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('keeps the category active when the warning is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = await openAdmin('/admin?tab=categories');
    await screen.findByText('חרדה');
    const item = screen.getByText('חרדה').closest('li') as HTMLElement;
    await user.click(within(item).getByRole('button', { name: 'השבתה' }));
    expect(adminApi.updateCategory).not.toHaveBeenCalled();
  });
});
