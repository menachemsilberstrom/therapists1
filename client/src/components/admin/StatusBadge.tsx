import type { UserStatus } from '../../types';

const STATUS_STYLES: Record<UserStatus, { label: string; className: string }> = {
  PENDING_APPROVAL: { label: 'ממתין לאישור', className: 'bg-amber-100 text-amber-800' },
  ACTIVE: { label: 'פעיל', className: 'bg-emerald-100 text-emerald-700' },
  SUSPENDED: { label: 'מושעה', className: 'bg-red-100 text-red-700' },
};

export default function StatusBadge({ status }: { status: UserStatus }) {
  const { label, className } = STATUS_STYLES[status];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>;
}
