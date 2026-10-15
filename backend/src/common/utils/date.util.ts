import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const APP_TZ = 'Africa/Addis_Ababa';

/** Format a date for display in the app locale (14 Jul 2026, 2:08 PM) */
export function formatDisplay(date: Date | string): string {
  return dayjs(date).tz(APP_TZ).format('D MMM YYYY, h:mm A');
}

/** Returns an ISO UTC string — use for API responses and DB storage */
export function toUtc(date: Date | string): string {
  return dayjs(date).utc().toISOString();
}

/** Adds seconds to a date */
export function addSeconds(date: Date, seconds: number): Date {
  return dayjs(date).add(seconds, 'second').toDate();
}

/** Adds days to a date */
export function addDays(date: Date, days: number): Date {
  return dayjs(date).add(days, 'day').toDate();
}

/** Returns true if the date is in the past */
export function isExpired(date: Date): boolean {
  return dayjs(date).isBefore(dayjs());
}

export { dayjs, APP_TZ };
