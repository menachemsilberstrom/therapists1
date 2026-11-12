import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { makeCard } from '../test/utils';
import type { TherapistCardData } from '../types';
import TherapistCard from './TherapistCard';

const show = (overrides: Partial<TherapistCardData> = {}) =>
  render(
    <MemoryRouter>
      <TherapistCard therapist={makeCard(overrides)} />
    </MemoryRouter>,
  );

describe('TherapistCard', () => {
  it('links to the public profile page', () => {
    show({ slug: 'dana-abc123' });
    expect(screen.getByRole('link')).toHaveAttribute('href', '/therapist/dana-abc123');
  });

  it('shows name, title, city and the teaser', () => {
    show({ fullName: 'דנה כהן', professionalTitle: 'פסיכולוגית קלינית', city: 'חיפה', bioSnippet: 'מתמחה בחרדה' });
    expect(screen.getByRole('heading', { name: 'דנה כהן' })).toBeInTheDocument();
    expect(screen.getByText('פסיכולוגית קלינית')).toBeInTheDocument();
    expect(screen.getByText('חיפה')).toBeInTheDocument();
    expect(screen.getByText('מתמחה בחרדה')).toBeInTheDocument();
  });

  it('falls back to the region name when there is no city', () => {
    show({ city: '', region: 'NORTH' });
    expect(screen.getByText('צפון')).toBeInTheDocument();
  });

  it('shows the online badge only for therapists who treat online', () => {
    const { unmount } = show({ acceptsOnline: true });
    expect(screen.getByText('טיפול אונליין')).toBeInTheDocument();
    unmount();
    show({ acceptsOnline: false });
    expect(screen.queryByText('טיפול אונליין')).not.toBeInTheDocument();
  });

  it('lists the categories', () => {
    show({ categories: [{ id: '1', name: 'חרדה', slug: 'anxiety' }, { id: '2', name: 'טראומה', slug: 'trauma' }] });
    expect(screen.getByText('חרדה')).toBeInTheDocument();
    expect(screen.getByText('טראומה')).toBeInTheDocument();
  });

  it('shows the profile picture when there is one', () => {
    const { container } = show({ profileImageUrl: '/uploads/avatars/x.webp' });
    expect(container.querySelector('img')).toHaveAttribute('src', '/uploads/avatars/x.webp');
  });

  it('shows the first letter of the name when there is no picture, or when it fails to load', () => {
    const { container, unmount } = show({ fullName: 'דנה כהן', profileImageUrl: undefined });
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('ד')).toBeInTheDocument();
    unmount();

    const broken = show({ fullName: 'דנה כהן', profileImageUrl: '/uploads/avatars/missing.webp' });
    const img = broken.container.querySelector('img') as HTMLImageElement;
    fireEvent.error(img); // the browser could not load the picture
    expect(broken.container.querySelector('img')).toBeNull();
    expect(screen.getByText('ד')).toBeInTheDocument();
  });
});

describe('TherapistCard avatar address', () => {
  it('loads the picture from the API address when the site and the API live on different domains', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', 'https://therapists-api.onrender.com');
    const { default: Card } = await import('./TherapistCard');
    const { container } = render(
      <MemoryRouter>
        <Card therapist={makeCard({ profileImageUrl: '/uploads/avatars/x.webp' })} />
      </MemoryRouter>,
    );
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://therapists-api.onrender.com/uploads/avatars/x.webp');
    vi.unstubAllEnvs();
  });
});
