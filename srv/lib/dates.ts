const MS_PER_DAY = 86_400_000;
const ISO_DATE_RE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

export const isoToUtcMillis = (value: string): number => {
  const m = ISO_DATE_RE.exec(value.trim());
  if (m === null) throw new Error(`Invalid ISO date: ${value}`);
  const [, year = '', month = '', day = ''] = m;
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
};

export const daysBetween = (from: string, to: string): number => {
  const fromMs = isoToUtcMillis(from);
  const toMs = isoToUtcMillis(to);
  return (toMs - fromMs) / MS_PER_DAY;
};

export const addDays = (value: string, days: number): string => {
  if (!Number.isInteger(days)) throw new Error(`Days must be an integer: ${String(days)}`);
  const ms = isoToUtcMillis(value) + days * MS_PER_DAY;
  return new Date(ms).toISOString().slice(0, 10);
};
