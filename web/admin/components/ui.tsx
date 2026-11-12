import type { ReactNode } from 'react';

type Tone = 'green' | 'amber' | 'red' | 'slate' | 'blue';

const TONE_CLASSES: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
};

export function Badge({
  children,
  tone = 'slate',
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

/** Status colouring shared by users, merchants, subscriptions and verifications. */
export function statusTone(status: string | null | undefined): Tone {
  switch (status) {
    case 'ACTIVE':
    case 'VERIFIED':
    case 'APPROVED':
    case 'RESOLVED':
    case 'DELIVERED':
      return 'green';
    case 'SUSPENDED':
    case 'PENDING':
    case 'PENDING_PAYMENT':
    case 'NEEDS_REVIEW':
    case 'IN_REVIEW':
    case 'INVITED':
    case 'PARTIAL':
    case 'IN_APP_ONLY':
      return 'amber';
    case 'BANNED':
    case 'FAKE':
    case 'DUPLICATE':
    case 'REJECTED':
    case 'ERROR':
    case 'FAILED':
    case 'REMOVED':
      return 'red';
    case 'EXPIRED':
    case 'CANCELLED':
    case 'DELETED':
      return 'slate';
    default:
      return 'blue';
  }
}

export function Card({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  note,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${emphasis ? 'text-brand-dark' : 'text-slate-900'}`}>
        {value}
      </p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-800">{value ?? '—'}</dd>
    </div>
  );
}

export function DataError({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <p className="font-medium">Could not load this view</p>
      <p className="mt-1 text-xs">{message}</p>
    </div>
  );
}

export function Flash({ notice, error }: { notice?: string; error?: string }) {
  if (!notice && !error) return null;
  return (
    <div className="mt-4 space-y-2">
      {notice && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-slate-500">
        {children}
      </td>
    </tr>
  );
}

export const TABLE_HEAD = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400';
export const TABLE_CELL = 'px-3 py-2.5 text-sm text-slate-700';
