import { toCents } from '../../money';

const DIGITS_RE = /^\d+$/;
const DATS_RE = /^(\d{4})(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])$/;

export const alphaOut = (value: string): string => {
  const s = value.trim();
  if (!DIGITS_RE.test(s)) return s;

  return s.replace(/^0+/, '') || '0';
};

export const alphaIn = (value: string, length: number = 10): string => {
  const s = value.trim();
  if (!DIGITS_RE.test(s)) return s;
  if (s.length > length)
    throw new Error(`ALPHA input "${value}" exceeds ${String(length)} characters`);

  return s.padStart(length, '0');
};

export const datsToIso = (value: string): string => {
  const m = DATS_RE.exec(value.trim());
  if (m === null) throw new Error(`Invalid DATS date: ${value}`);
  const [, year = '', month = '', day = ''] = m;
  return `${year}-${month}-${day}`;
};

export const signedCents = (value: number | string, indicator: 'S' | 'H'): number => {
  const cents: number = toCents(value);
  return indicator === 'H' && cents !== 0 ? -cents : cents;
};
