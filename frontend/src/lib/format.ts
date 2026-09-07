export function buildQueryString(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 30],
  ['month', 12],
  ['year', Number.POSITIVE_INFINITY],
];

/**
 * Relative, human phrasing for a past/future timestamp (e.g. "hace 3 días").
 * Used in dense lists where an absolute date is noise; falls back to "—".
 */
export function formatRelative(value: string | null): string {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) {
    return '—';
  }

  const formatter = new Intl.RelativeTimeFormat('es-CO', { numeric: 'auto' });
  let delta = (parsed - Date.now()) / 1000;

  for (const [unit, limit] of RELATIVE_STEPS) {
    if (Math.abs(delta) < limit) {
      return formatter.format(Math.round(delta), unit);
    }
    delta /= limit;
  }

  return formatter.format(Math.round(delta), 'year');
}

const AMOUNT_INTEGER_GROUP = /\B(?=(\d{3})+(?!\d))/g;

/**
 * Live-formats an amount as the user types using es-CO separators:
 * `.` for thousands and `,` for decimals (e.g. 20.000.000.000).
 */
export function formatAmountInputEsCo(raw: string): string {
  const sanitized = raw.replace(/[^\d,]/g, '');
  if (sanitized === '') {
    return '';
  }

  const commaIndex = sanitized.indexOf(',');
  const integerDigits = (
    commaIndex === -1 ? sanitized : sanitized.slice(0, commaIndex)
  ).replace(/\D/g, '');
  const fractionDigits =
    commaIndex === -1
      ? null
      : sanitized
          .slice(commaIndex + 1)
          .replace(/\D/g, '')
          .slice(0, 2);

  const strippedInteger = integerDigits.replace(/^0+(?=\d)/, '');
  const grouped =
    strippedInteger === ''
      ? fractionDigits === null
        ? ''
        : '0'
      : strippedInteger.replace(AMOUNT_INTEGER_GROUP, '.');

  if (fractionDigits === null) {
    return grouped;
  }
  return `${grouped},${fractionDigits}`;
}

/**
 * Formats a stored machine number ("20000000000" / "20000000000.00") for display.
 * Trailing zero decimals from DECIMAL columns are omitted.
 */
export function formatAmountEsCo(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) {
    return '';
  }
  const raw = String(value).trim();
  if (raw === '') {
    return '';
  }

  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) {
    return '';
  }

  const [integerPart, fractionPart] = raw.split('.');
  const hasFraction = Boolean(fractionPart && Number(fractionPart) !== 0);
  const inputShape = hasFraction
    ? `${integerPart},${fractionPart.slice(0, 2)}`
    : integerPart;
  return formatAmountInputEsCo(inputShape);
}

/**
 * Parses an es-CO formatted amount back to a number for the API.
 * Returns null for empty input; does not change the stored numeric value.
 */
export function parseAmountInputEsCo(formatted: string): number | null {
  const trimmed = formatted.trim();
  if (trimmed === '') {
    return null;
  }

  const normalized = trimmed
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/\.$/, '');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}
