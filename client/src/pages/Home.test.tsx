import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { categoriesApi, therapistsApi } from '../api/services';
import { httpError, LocationProbe, makeCard, renderWithProviders } from '../test/utils';
import type { PagedResult, TherapistCardData } from '../types';
import Home from './Home';

vi.mock('../api/services', () => ({
  categoriesApi: { list: vi.fn() },
  therapistsApi: { list: vi.fn(), filterOptions: vi.fn() },
}));

const categories = [
  { id: '1', name: 'חרדה', slug: 'anxiety' },
  { id: '2', name: 'טראומה', slug: 'trauma' },
];

const page = (items: TherapistCardData[], overrides: Partial<PagedResult<TherapistCardData>> = {}): PagedResult<TherapistCardData> => ({
  items,
  total: items.length,
  page: 1,
  limit: 12,
  totalPages: 1,
  ...overrides,
});

const twoTherapists = [makeCard({ id: '1', slug: 'dana-1', fullName: 'דנה כהן' }), makeCard({ id: '2', slug: 'yossi-2', fullName: 'יוסי לוי' })];

async function openHome(route = '/', result = page(twoTherapists)) {
  vi.mocked(categoriesApi.list).mockResolvedValue(categories);
  vi.mocked(therapistsApi.filterOptions).mockResolvedValue({ cities: [{ name: 'חיפה', count: 2 }] });
  vi.mocked(therapistsApi.list).mockResolvedValue(result);
  renderWithProviders(
    <>
      <LocationProbe />
      <Home />
    </>,
    { route },
  );
  await screen.findByText(/נמצאו \d+ מטפלים|לא נמצאו מטפלים/);
  return userEvent.setup();
}

const lastCall = () => vi.mocked(therapistsApi.list).mock.calls.at(-1)?.[0];
const url = () => decodeURIComponent(screen.getByTestId('location').textContent ?? '');

describe('Home: results', () => {
  it('lists the therapists as cards that link to their profiles, with the total', async () => {
    await openHome();
    expect(screen.getByText('נמצאו 2 מטפלים')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /דנה כהן/ })).toHaveAttribute('href', '/therapist/dana-1');
    expect(screen.getByRole('link', { name: /יוסי לוי/ })).toHaveAttribute('href', '/therapist/yossi-2');
  });

  it('asks for the first page with no filters when the URL is plain', async () => {
    await openHome('/');
    expect(lastCall()).toEqual(expect.objectContaining({ page: 1 }));
    expect(lastCall()?.category).toBeUndefined();
    expect(lastCall()?.gender).toBeUndefined();
  });

  it('shows a Hebrew error when the search fails', async () => {
    vi.mocked(categoriesApi.list).mockResolvedValue(categories);
    vi.mocked(therapistsApi.filterOptions).mockResolvedValue({ cities: [] });
    vi.mocked(therapistsApi.list).mockRejectedValue(httpError(500));
    renderWithProviders(<Home />);
    expect(await screen.findByRole('alert')).toHaveTextContent('אירעה שגיאה בשרת');
  });

  it('still works when the optional filter lists cannot be loaded', async () => {
    vi.mocked(categoriesApi.list).mockRejectedValue(httpError(500));
    vi.mocked(therapistsApi.filterOptions).mockRejectedValue(httpError(500));
    vi.mocked(therapistsApi.list).mockResolvedValue(page(twoTherapists));
    renderWithProviders(<Home />);
    expect(await screen.findByText('נמצאו 2 מטפלים')).toBeInTheDocument();
  });
});

describe('Home: filters come from the URL', () => {
  const FULL = '/?q=דנה&category=anxiety&gender=FEMALE&region=NORTH&city=חיפה&audience=ADULTS,TEENS&online=1&page=2';

  it('sends every filter in the URL to the API', async () => {
    await openHome(FULL);
    expect(lastCall()).toEqual({
      q: 'דנה',
      category: 'anxiety',
      gender: 'FEMALE',
      region: 'NORTH',
      city: 'חיפה',
      audience: 'ADULTS,TEENS',
      online: true,
      page: 2,
    });
  });

  it('shows every filter as selected in the sidebar, so a shared link looks the way it was shared', async () => {
    await openHome(FULL);
    expect(screen.getByRole('checkbox', { name: 'חרדה' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'טראומה' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'מטפלת (אישה)' })).toBeChecked();
    expect(screen.getByLabelText('אזור')).toHaveValue('NORTH');
    expect(screen.getByLabelText('עיר')).toHaveValue('חיפה');
    expect(screen.getByRole('checkbox', { name: 'מבוגרים' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'בני נוער' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'מטפלים שמקבלים גם אונליין' })).toBeChecked();
    expect(screen.getByRole('searchbox', { name: 'חיפוש מטפל' })).toHaveValue('דנה');
  });

  it('ignores unknown or tampered values', async () => {
    await openHome('/?gender=ALIEN&region=MARS&audience=ROBOTS&online=maybe&page=abc');
    expect(lastCall()).toEqual(expect.objectContaining({ page: 1 }));
    for (const key of ['gender', 'region', 'audience', 'online'] as const) expect(lastCall()?.[key]).toBeUndefined();
  });
});

describe('Home: changing filters', () => {
  it('selecting a category searches again from page 1 and updates the URL', async () => {
    const user = await openHome('/?page=3');
    await user.click(screen.getByRole('checkbox', { name: 'חרדה' }));

    await waitFor(() => expect(lastCall()).toEqual(expect.objectContaining({ category: 'anxiety', page: 1 })));
    expect(url()).toBe('/?category=anxiety'); // page=3 was dropped
  });

  it('several categories are combined', async () => {
    const user = await openHome();
    await user.click(screen.getByRole('checkbox', { name: 'חרדה' }));
    await user.click(screen.getByRole('checkbox', { name: 'טראומה' }));
    await waitFor(() => expect(lastCall()?.category).toBe('anxiety,trauma'));
    expect(url()).toBe('/?category=anxiety,trauma');
  });

  it('gender, region, audience and online each add their own filter', async () => {
    const user = await openHome();
    await user.click(screen.getByRole('radio', { name: 'מטפל (גבר)' }));
    await user.selectOptions(screen.getByLabelText('אזור'), 'JERUSALEM');
    await user.click(screen.getByRole('checkbox', { name: 'זוגות' }));
    await user.click(screen.getByRole('checkbox', { name: 'מטפלים שמקבלים גם אונליין' }));

    await waitFor(() => expect(lastCall()).toEqual(expect.objectContaining({ gender: 'MALE', region: 'JERUSALEM', audience: 'COUPLES', online: true })));
    expect(url()).toBe('/?gender=MALE&region=JERUSALEM&audience=COUPLES&online=1');
  });

  it('submitting the keyword box searches for that text', async () => {
    const user = await openHome();
    await user.type(screen.getByRole('searchbox', { name: 'חיפוש מטפל' }), 'טראומה');
    await user.click(screen.getByRole('button', { name: 'חיפוש' }));
    await waitFor(() => expect(lastCall()?.q).toBe('טראומה'));
    expect(url()).toBe('/?q=טראומה');
  });

  it('typing a city applies after the pause', async () => {
    const user = await openHome();
    await user.type(screen.getByLabelText('עיר'), 'עכו');
    await waitFor(() => expect(lastCall()?.city).toBe('עכו'), { timeout: 2000 });
    expect(url()).toBe('/?city=עכו');
  });

  it('"clear all" in the sidebar drops the filters but keeps the keyword', async () => {
    const user = await openHome('/?q=דנה&gender=FEMALE&online=1');
    await user.click(screen.getByRole('button', { name: 'ניקוי הכל' }));
    await waitFor(() => expect(lastCall()?.gender).toBeUndefined());
    expect(lastCall()?.q).toBe('דנה');
    expect(url()).toBe('/?q=דנה');
  });
});

describe('Home: active filter tags', () => {
  it('shows one removable tag per selected option, in plain Hebrew', async () => {
    await openHome('/?q=דנה&category=anxiety&gender=FEMALE&region=NORTH&city=חיפה&audience=ADULTS&online=1');
    const tags = within(screen.getByRole('list', { name: 'סינונים פעילים' }))
      .getAllByRole('button')
      .map((b) => b.textContent?.replace('×', '').trim());
    expect(tags).toEqual(['חיפוש: דנה', 'חרדה', 'מטפלת (אישה)', 'צפון', 'עיר: חיפה', 'קהל יעד: מבוגרים', 'מקבלים אונליין']);
  });

  it('shows no tags when nothing is selected', async () => {
    await openHome('/');
    expect(screen.queryByRole('list', { name: 'סינונים פעילים' })).not.toBeInTheDocument();
  });

  it('removing a tag drops just that filter', async () => {
    const user = await openHome('/?region=NORTH&gender=FEMALE');
    await user.click(screen.getByRole('button', { name: 'הסרת הסינון: צפון' }));
    await waitFor(() => expect(lastCall()?.region).toBeUndefined());
    expect(lastCall()?.gender).toBe('FEMALE');
    expect(url()).toBe('/?gender=FEMALE');
  });

  it('removing one category tag keeps the other categories', async () => {
    const user = await openHome('/?category=anxiety,trauma');
    await user.click(screen.getByRole('button', { name: 'הסרת הסינון: חרדה' }));
    await waitFor(() => expect(lastCall()?.category).toBe('trauma'));
  });
});

describe('Home: empty results and paging', () => {
  it('explains an empty result and offers to clear everything, including the keyword', async () => {
    const user = await openHome('/?q=xyz&gender=MALE', page([]));
    expect(screen.getByText('לא נמצאו מטפלים התואמים את החיפוש')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ניקוי כל הסינונים' }));
    await waitFor(() => expect(url()).toBe('/'));
  });

  it('does not offer to clear anything when there were no filters in the first place', async () => {
    await openHome('/', page([]));
    expect(screen.getByText('לא נמצאו מטפלים התואמים את החיפוש')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ניקוי כל הסינונים' })).not.toBeInTheDocument();
  });

  it('pages forward and back while keeping the filters', async () => {
    const user = await openHome('/?gender=FEMALE', page(twoTherapists, { total: 30, page: 1, totalPages: 3 }));
    expect(screen.getByText('עמוד 1 מתוך 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'הקודם' })).toBeDisabled();

    vi.mocked(therapistsApi.list).mockResolvedValue(page(twoTherapists, { total: 30, page: 2, totalPages: 3 }));
    await user.click(screen.getByRole('button', { name: 'הבא' }));
    await waitFor(() => expect(lastCall()).toEqual(expect.objectContaining({ gender: 'FEMALE', page: 2 })));
    expect(url()).toBe('/?gender=FEMALE&page=2');

    await user.click(await screen.findByRole('button', { name: 'הקודם' }));
    await waitFor(() => expect(lastCall()?.page).toBe(1));
  });

  it('has no paging controls when everything fits on one page', async () => {
    await openHome('/', page(twoTherapists));
    expect(screen.queryByRole('navigation', { name: 'עימוד' })).not.toBeInTheDocument();
  });

  it('disables "next" on the last page', async () => {
    await openHome('/?page=3', page(twoTherapists, { total: 30, page: 3, totalPages: 3 }));
    expect(screen.getByRole('button', { name: 'הבא' })).toBeDisabled();
  });
});
