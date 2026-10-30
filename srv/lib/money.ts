const AMOUNT = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

export const toCents = (value: number | string): number => {
  const s: string = String(value).trim();
  const m = AMOUNT.exec(s);
  if (m === null) throw new Error(`Invalid amount: ${s}`);

  const [, sign = '', whole = '', decimals = ''] = m;
  return Number(sign + whole + decimals.padEnd(2, '0'));
};

export const fromCents = (cents: number): string => {
  if (!Number.isInteger(cents)) throw new Error(`Invalid cents: ${String(cents)}`);
  return (cents / 100).toFixed(2);
};
