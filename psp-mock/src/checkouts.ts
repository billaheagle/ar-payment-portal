import { randomBytes } from 'node:crypto';
import type { CheckoutStore } from './store';
import type { Checkout, CheckoutInput } from './types';

const AMOUNT_RE = /^\d+\.\d{2}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;

export class CheckoutValidationError extends Error {}

export type CreateResult =
  | { kind: 'created'; checkout: Checkout }
  | { kind: 'replayed'; checkout: Checkout }
  | { kind: 'conflict' };

export type CancelResult =
  { kind: 'cancelled'; checkout: Checkout } | { kind: 'not_open' } | { kind: 'not_found' };

export interface CreateContext {
  now: Date;
  publicUrl: string;
  ttlSeconds: number;
}

export const parseCheckoutInput = (body: unknown): CheckoutInput => {
  if (typeof body !== 'object' || body === null)
    throw new CheckoutValidationError('Body must be a JSON object');

  if (!('amount' in body)) throw new CheckoutValidationError('amount is required');
  if (!('currency' in body)) throw new CheckoutValidationError('currency is required');
  if (!('reference' in body)) throw new CheckoutValidationError('reference is required');

  if (typeof body.amount !== 'string' || !AMOUNT_RE.test(body.amount) || Number(body.amount) <= 0)
    throw new CheckoutValidationError('amount is invalid');

  if (typeof body.currency !== 'string' || !CURRENCY_RE.test(body.currency))
    throw new CheckoutValidationError('currency is invalid');

  if (
    typeof body.reference !== 'string' ||
    body.reference.length === 0 ||
    body.reference.length > 35
  )
    throw new CheckoutValidationError('reference is invalid');

  const rawReturnUrl = 'returnUrl' in body ? body.returnUrl : undefined;

  if (rawReturnUrl !== undefined && typeof rawReturnUrl !== 'string')
    throw new CheckoutValidationError('returnUrl is invalid');

  return {
    amount: body.amount,
    currency: body.currency,
    reference: body.reference,
    ...(typeof rawReturnUrl === 'string' ? { returnUrl: rawReturnUrl } : {}),
  };
};

export const createCheckout = (
  store: CheckoutStore,
  idempotencyKey: string,
  input: CheckoutInput,
  ctx: CreateContext,
): CreateResult => {
  const fingerprint = JSON.stringify([
    input.amount,
    input.currency,
    input.reference,
    input.returnUrl ?? null,
  ]);

  const previous = store.idempotency.get(idempotencyKey);
  if (previous) {
    if (previous.fingerprint !== fingerprint) return { kind: 'conflict' };
    const checkout = store.checkouts.get(previous.checkoutId);

    if (!checkout) throw new Error('Fingerprint is matched but checkout not found');

    return {
      kind: 'replayed',
      checkout,
    };
  }

  const id = `chk_${randomBytes(12).toString('hex')}`;
  const newCheckout: Checkout = {
    ...input,
    id,
    status: 'OPEN',
    url: `${ctx.publicUrl}/checkout/${id}`,
    expiresAt: new Date(ctx.now.getTime() + ctx.ttlSeconds * 1000).toISOString(),
  };

  store.checkouts.set(id, newCheckout);
  store.idempotency.set(idempotencyKey, { fingerprint, checkoutId: id });
  return { kind: 'created', checkout: newCheckout };
};

export const findByReference = (store: CheckoutStore, reference: string): Checkout[] => {
  return [...store.checkouts.values()].filter((checkout) => checkout.reference === reference);
};

const isOpen = (checkout: Checkout, now: Date): boolean => {
  return checkout.status === 'OPEN' && new Date(checkout.expiresAt) >= now;
};

export const cancelCheckout = (store: CheckoutStore, id: string, now: Date): CancelResult => {
  const checkout = store.checkouts.get(id);

  if (checkout === undefined) return { kind: 'not_found' };
  if (!isOpen(checkout, now)) return { kind: 'not_open' };

  checkout.status = 'CANCELLED';
  return { kind: 'cancelled', checkout };
};
