import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { categoriesApi, therapistsApi } from '../api/services';
import { adminUser, httpError, makeOwnProfile, renderWithProviders, therapistUser } from '../test/utils';
import Dashboard from './Dashboard';

vi.mock('../api/services', () => ({
  therapistsApi: {
    getMine: vi.fn(),
    updateMine: vi.fn(),
    uploadAvatar: vi.fn(),
    deleteAvatar: vi.fn(),
    addCertificate: vi.fn(),
    deleteCertificate: vi.fn(),
  },
  categoriesApi: { list: vi.fn() },
}));

const categories = [
  { id: '1', name: 'חרדה', slug: 'anxiety' },
  { id: '2', name: 'טיפול בילדים', slug: 'child-therapy' },
];

async function openDashboard(profile = makeOwnProfile()) {
  vi.mocked(therapistsApi.getMine).mockResolvedValue(profile);
  vi.mocked(categoriesApi.list).mockResolvedValue(categories);
  renderWithProviders(<Dashboard />, { user: therapistUser });
  await screen.findByRole('heading', { name: 'עריכת הפרופיל שלי' });
  return userEvent.setup();
}

describe('Dashboard: approval status banner', () => {
  it('a pending therapist sees the "waiting for approval" banner and no public-profile link', async () => {
    await openDashboard(makeOwnProfile({ accountStatus: 'PENDING_APPROVAL', isPubliclyVisible: false }));
    expect(screen.getByRole('status')).toHaveTextContent('הפרופיל שלכם ממתין לאישור מנהל האתר');
    expect(screen.queryByRole('link', { name: 'צפייה בפרופיל הציבורי' })).not.toBeInTheDocument(); // that page would 404
  });

  it('an approved therapist sees the green "active" note and a link to the public page', async () => {
    await openDashboard(makeOwnProfile({ accountStatus: 'ACTIVE', isPubliclyVisible: true, slug: 'dana-abc123' }));
    expect(screen.getByRole('status')).toHaveTextContent('הפרופיל שלכם פעיל ומופיע בחיפוש');
    expect(screen.getByRole('link', { name: 'צפייה בפרופיל הציבורי' })).toHaveAttribute('href', '/therapist/dana-abc123');
  });

  it('a profile without a name has no public link yet, even when it is visible', async () => {
    await openDashboard(makeOwnProfile({ fullName: '', isPubliclyVisible: true }));
    expect(screen.queryByRole('link', { name: 'צפייה בפרופיל הציבורי' })).not.toBeInTheDocument();
  });

  it('a pending therapist can still use every part of the dashboard while waiting', async () => {
    await openDashboard(makeOwnProfile({ accountStatus: 'PENDING_APPROVAL', isPubliclyVisible: false }));
    expect(screen.getByRole('heading', { name: 'תמונת פרופיל' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'תעודות והסמכות' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'שמירת שינויים' })).toBeEnabled();
  });
});

describe('Dashboard: the profile form', () => {
  it('is filled with the saved profile', async () => {
    await openDashboard(
      makeOwnProfile({
        fullName: 'דנה כהן',
        professionalTitle: 'פסיכולוגית',
        city: 'חיפה',
        bio: 'ביו קיים',
        gender: 'FEMALE',
        region: 'NORTH',
        acceptsOnline: true,
        targetAudiences: ['ADULTS'],
        categories: [categories[0] as (typeof categories)[number]],
        contactInfo: { phone: '050-1111111', whatsapp: '0502222222', email: 'd@example.com' },
      }),
    );
    expect(screen.getByLabelText('שם מלא')).toHaveValue('דנה כהן');
    expect(screen.getByLabelText('תואר מקצועי')).toHaveValue('פסיכולוגית');
    expect(screen.getByLabelText('עיר')).toHaveValue('חיפה');
    expect(screen.getByLabelText('קצת עליי')).toHaveValue('ביו קיים');
    expect(screen.getByLabelText('מגדר')).toHaveValue('FEMALE');
    expect(screen.getByLabelText('אזור')).toHaveValue('NORTH');
    expect(screen.getByRole('checkbox', { name: 'אני מקבל/ת גם טיפול אונליין (זום)' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'מבוגרים' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'חרדה' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'טיפול בילדים' })).not.toBeChecked();
    expect(screen.getByLabelText('טלפון')).toHaveValue('050-1111111');
    expect(screen.getByLabelText('וואטסאפ')).toHaveValue('0502222222');
    expect(screen.getByLabelText('אימייל ליצירת קשר')).toHaveValue('d@example.com');
  });

  it('saves edits, including the fields the public search filters on', async () => {
    const user = await openDashboard();
    vi.mocked(therapistsApi.updateMine).mockResolvedValue(makeOwnProfile({ bio: 'ביו חדש' }));

    await user.clear(screen.getByLabelText('קצת עליי'));
    await user.type(screen.getByLabelText('קצת עליי'), 'ביו חדש');
    await user.selectOptions(screen.getByLabelText('מגדר'), 'FEMALE');
    await user.selectOptions(screen.getByLabelText('אזור'), 'CENTER');
    await user.click(screen.getByRole('checkbox', { name: 'ילדים' }));
    await user.click(screen.getByRole('checkbox', { name: 'אני מקבל/ת גם טיפול אונליין (זום)' }));
    await user.click(screen.getByRole('checkbox', { name: 'חרדה' }));
    await user.click(screen.getByRole('button', { name: 'שמירת שינויים' }));

    await waitFor(() => expect(therapistsApi.updateMine).toHaveBeenCalledTimes(1));
    expect(therapistsApi.updateMine).toHaveBeenCalledWith({
      fullName: 'דנה כהן',
      professionalTitle: 'פסיכולוגית',
      bio: 'ביו חדש',
      city: 'חיפה',
      phone: '050-1234567',
      whatsapp: '',
      contactEmail: '',
      categories: ['anxiety'],
      gender: 'FEMALE',
      region: 'CENTER',
      acceptsOnline: true,
      targetAudiences: ['CHILDREN'],
    });
    expect(await screen.findByText('הפרופיל נשמר בהצלחה.')).toBeInTheDocument();
  });

  it('sends null for gender and region when "not specified" is chosen, so the server clears them', async () => {
    const user = await openDashboard(makeOwnProfile({ gender: 'MALE', region: 'SOUTH' }));
    vi.mocked(therapistsApi.updateMine).mockResolvedValue(makeOwnProfile());
    await user.selectOptions(screen.getByLabelText('מגדר'), '');
    await user.selectOptions(screen.getByLabelText('אזור'), '');
    await user.click(screen.getByRole('button', { name: 'שמירת שינויים' }));
    await waitFor(() => expect(therapistsApi.updateMine).toHaveBeenCalled());
    expect(vi.mocked(therapistsApi.updateMine).mock.calls[0]?.[0]).toMatchObject({ gender: null, region: null });
  });

  it('trims whitespace before saving', async () => {
    const user = await openDashboard();
    vi.mocked(therapistsApi.updateMine).mockResolvedValue(makeOwnProfile());
    await user.clear(screen.getByLabelText('עיר'));
    await user.type(screen.getByLabelText('עיר'), '   עכו   ');
    await user.click(screen.getByRole('button', { name: 'שמירת שינויים' }));
    await waitFor(() => expect(therapistsApi.updateMine).toHaveBeenCalled());
    expect(vi.mocked(therapistsApi.updateMine).mock.calls[0]?.[0]).toMatchObject({ city: 'עכו' });
  });

  it('shows a Hebrew error when saving fails, and no success message', async () => {
    const user = await openDashboard();
    vi.mocked(therapistsApi.updateMine).mockRejectedValue(httpError(400));
    await user.click(screen.getByRole('button', { name: 'שמירת שינויים' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('הנתונים שהוזנו אינם תקינים');
    expect(screen.queryByText('הפרופיל נשמר בהצלחה.')).not.toBeInTheDocument();
  });

  it('hides the "saved" message again as soon as something is edited', async () => {
    const user = await openDashboard();
    vi.mocked(therapistsApi.updateMine).mockResolvedValue(makeOwnProfile());
    await user.click(screen.getByRole('button', { name: 'שמירת שינויים' }));
    await screen.findByText('הפרופיל נשמר בהצלחה.');
    await user.type(screen.getByLabelText('קצת עליי'), '!');
    expect(screen.queryByText('הפרופיל נשמר בהצלחה.')).not.toBeInTheDocument();
  });

  it('disables the save button while saving', async () => {
    const user = await openDashboard();
    let finish: (p: ReturnType<typeof makeOwnProfile>) => void = () => undefined;
    vi.mocked(therapistsApi.updateMine).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await user.click(screen.getByRole('button', { name: 'שמירת שינויים' }));
    expect(await screen.findByRole('button', { name: 'שומר...' })).toBeDisabled();
    finish(makeOwnProfile());
    await screen.findByRole('button', { name: 'שמירת שינויים' });
  });
});

describe('Dashboard: access and loading problems', () => {
  it('is for therapists only: an admin is told so and no profile is requested', () => {
    renderWithProviders(<Dashboard />, { user: adminUser });
    expect(screen.getByRole('alert')).toHaveTextContent('האזור האישי זמין למטפלים בלבד');
    expect(therapistsApi.getMine).not.toHaveBeenCalled();
  });

  it('shows a Hebrew error when the profile cannot be loaded', async () => {
    vi.mocked(therapistsApi.getMine).mockRejectedValue(httpError(500));
    vi.mocked(categoriesApi.list).mockResolvedValue(categories);
    renderWithProviders(<Dashboard />, { user: therapistUser });
    expect(await screen.findByRole('alert')).toHaveTextContent('אירעה שגיאה בשרת');
    expect(screen.queryByRole('button', { name: 'שמירת שינויים' })).not.toBeInTheDocument();
  });

  it('shows a loading indicator first', () => {
    vi.mocked(therapistsApi.getMine).mockReturnValue(new Promise(() => undefined));
    vi.mocked(categoriesApi.list).mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<Dashboard />, { user: therapistUser });
    expect(screen.getByRole('status')).toHaveTextContent('טוען');
  });
});
