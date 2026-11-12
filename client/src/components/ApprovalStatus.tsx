import type { OwnTherapistProfile } from '../types';

/** Tells the therapist whether their profile is live or still waiting for an admin to approve it. */
export default function ApprovalStatus({ profile }: { profile: OwnTherapistProfile }) {
  if (profile.isPubliclyVisible) {
    return (
      <div role="status" className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        הפרופיל שלכם פעיל ומופיע בחיפוש.
      </div>
    );
  }

  const waiting = profile.accountStatus === 'PENDING_APPROVAL';
  return (
    <div role="status" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
      <p className="font-semibold">{waiting ? 'הפרופיל שלכם ממתין לאישור מנהל האתר' : 'הפרופיל שלכם אינו מוצג כרגע בחיפוש'}</p>
      <p className="mt-1 text-sm leading-relaxed">
        {waiting
          ? 'עד לאישור הפרופיל אינו מופיע בחיפוש ואין אליו קישור ציבורי. בינתיים אפשר להשלים את הפרטים, להעלות תמונה ותעודות (אופציונלי), וכך לזרז את הבדיקה. כשהפרופיל יאושר הוא יופיע כאן כפעיל.'
          : 'פנו למנהל האתר לבירור.'}
      </p>
    </div>
  );
}
