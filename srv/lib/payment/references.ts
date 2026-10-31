const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuidV4 = (value: string): boolean => UUID_V4_RE.test(value);

export const paymentReference = (id: string): string => {
  if (!isUuidV4(id)) throw new Error(`Invalid format ID "${id}"`);
  return `PAY-${id.slice(0, 8).toUpperCase()}`;
};
