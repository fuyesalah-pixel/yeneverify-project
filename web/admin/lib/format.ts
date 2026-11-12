// Formatting helpers shared by the admin screens.

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatNumber(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-GB');
}

/** Signed credits, e.g. "+50" / "−12". */
export function formatSigned(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toLocaleString('en-GB')}`;
}

/** Minor units (cents) to "1,250.00 ETB". */
export function formatMoneyMinor(value: string | null | undefined, currency = 'ETB'): string {
  if (value === null || value === undefined) return '—';
  const n = Number(value) / 100;
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/** "3 days ago" style label for activity columns. */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return 'never';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return 'never';

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatDate(date);
}

export function truncate(value: string | null | undefined, max = 40): string {
  if (!value) return '—';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
