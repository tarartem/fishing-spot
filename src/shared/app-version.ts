import pkg from '../../package.json';

/**
 * Single source of truth for the application version, sourced directly from package.json.
 */
export const APP_VERSION: string = pkg.version;

/**
 * Generates a short, human-readable Report ID in the format FS-YYYYMMDD-XXXX.
 */
export function generateReportId(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const suffix = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');
  return `FS-${year}${month}${day}-${suffix}`;
}

/**
 * Formats a Date or ISO string into a human-friendly 24h timestamp (e.g. "12 Nov 2026, 13:24").
 */
export function formatReportTimestamp(input: Date | string = new Date()): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    return typeof input === 'string' ? input : '';
  }
  const datePart = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
  const timePart = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${datePart}, ${timePart}`;
}
