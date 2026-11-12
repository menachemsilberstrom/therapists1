import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeOwnProfile } from '../test/utils';
import ApprovalStatus from './ApprovalStatus';

describe('ApprovalStatus banner (what a therapist sees about their own profile)', () => {
  it('tells a pending therapist the profile is waiting for approval, and that it is not public yet', () => {
    render(<ApprovalStatus profile={makeOwnProfile({ accountStatus: 'PENDING_APPROVAL', isPubliclyVisible: false })} />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('הפרופיל שלכם ממתין לאישור מנהל האתר');
    expect(banner).toHaveTextContent('אינו מופיע בחיפוש');
    expect(banner).toHaveClass('border-amber-300'); // warning colour
  });

  it('encourages preparing the profile while waiting', () => {
    render(<ApprovalStatus profile={makeOwnProfile({ accountStatus: 'PENDING_APPROVAL', isPubliclyVisible: false })} />);
    expect(screen.getByRole('status')).toHaveTextContent('להשלים את הפרטים');
  });

  it('confirms in green once the profile is live', () => {
    render(<ApprovalStatus profile={makeOwnProfile({ accountStatus: 'ACTIVE', isPubliclyVisible: true })} />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('הפרופיל שלכם פעיל ומופיע בחיפוש');
    expect(banner).toHaveClass('border-emerald-200');
    expect(banner).not.toHaveTextContent('ממתין');
  });

  it('shows a neutral warning when the profile is hidden for a reason other than pending approval', () => {
    render(<ApprovalStatus profile={makeOwnProfile({ accountStatus: 'ACTIVE', isPubliclyVisible: false })} />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('אינו מוצג כרגע בחיפוש');
    expect(banner).not.toHaveTextContent('ממתין לאישור');
  });

  it('visibility wins over status: a visible profile is always shown as live', () => {
    render(<ApprovalStatus profile={makeOwnProfile({ accountStatus: 'PENDING_APPROVAL', isPubliclyVisible: true })} />);
    expect(screen.getByRole('status')).toHaveTextContent('פעיל ומופיע בחיפוש');
  });
});
