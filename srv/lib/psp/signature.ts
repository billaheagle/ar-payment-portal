import { createHmac, timingSafeEqual } from 'node:crypto';
const HEADER_RE = /^t=(\d+),v1=([a-f0-9]{64})$/;

export type VerifyResult = 'OK' | 'WEBHOOK_SIGNATURE_INVALID' | 'WEBHOOK_TIMESTAMP_EXPIRED';

export const sign = (secret: string, t: string, rawBody: string): string => {
  return createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
};

export const verify = (
  secret: string,
  header: string | undefined,
  rawBody: string,
  nowSec: number,
): VerifyResult => {
  const m = HEADER_RE.exec(header ?? '');
  if (m === null) return 'WEBHOOK_SIGNATURE_INVALID';
  const [, t = '', v1 = ''] = m;

  if (Math.abs(Number(t) - nowSec) > 300) return 'WEBHOOK_TIMESTAMP_EXPIRED';

  const expected = Buffer.from(sign(secret, t, rawBody), 'hex');
  const given = Buffer.from(v1, 'hex');

  if (expected.length !== given.length) return 'WEBHOOK_SIGNATURE_INVALID';
  if (!timingSafeEqual(expected, given)) return 'WEBHOOK_SIGNATURE_INVALID';

  return 'OK';
};
