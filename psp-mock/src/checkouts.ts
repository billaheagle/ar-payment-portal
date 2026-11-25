import { randomBytes } from 'node:crypto';
import type { CheckoutStore } from './store';
import { PAY_OUTCOMES, type PayOutcome, type Checkout, type CheckoutInput } from './types';

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

export const isOpen = (checkout: Checkout, now: Date): boolean => {
  return checkout.status === 'OPEN' && new Date(checkout.expiresAt) >= now;
};

export const cancelCheckout = (store: CheckoutStore, id: string, now: Date): CancelResult => {
  const checkout = store.checkouts.get(id);

  if (checkout === undefined) return { kind: 'not_found' };
  if (!isOpen(checkout, now)) return { kind: 'not_open' };

  checkout.status = 'CANCELLED';
  return { kind: 'cancelled', checkout };
};

export type PayResult =
  { kind: 'processed'; checkout: Checkout } | { kind: 'not_open' } | { kind: 'not_found' };

export const payCheckout = (
  store: CheckoutStore,
  id: string,
  outcome: PayOutcome,
  now: Date,
): PayResult => {
  const checkout = store.checkouts.get(id);
  if (checkout === undefined) return { kind: 'not_found' };
  if (!isOpen(checkout, now)) return { kind: 'not_open' };

  if (outcome === 'success') {
    checkout.status = 'SUCCEEDED';
    checkout.paymentId = `pay_${randomBytes(12).toString('hex')}`;
    return { kind: 'processed', checkout };
  }

  checkout.status = 'FAILED';
  return { kind: 'processed', checkout };
};

export const expireCheckouts = (store: CheckoutStore, now: Date): Checkout[] => {
  const expired = [...store.checkouts.values()].filter(
    (checkout) => checkout.status === 'OPEN' && !isOpen(checkout, now),
  );

  for (const checkout of expired) {
    checkout.status = 'EXPIRED';
  }

  return expired;
};

export interface PayRequest {
  outcome: PayOutcome;
  duplicateWebhook: boolean;
  delaySeconds: number;
  suppressWebhook: boolean;
}

const isPayOutcome = (value: unknown): value is PayOutcome =>
  typeof value === 'string' && (PAY_OUTCOMES as readonly string[]).includes(value);

export const parsePayRequest = (body: unknown): PayRequest => {
  if (typeof body !== 'object' || body === null)
    throw new CheckoutValidationError('Body must be a JSON object');

  if (!('outcome' in body)) throw new CheckoutValidationError('outcome is required');
  if (!isPayOutcome(body.outcome)) throw new CheckoutValidationError('outcome is invalid');
  const outcome = body.outcome;

  const rawDuplicateWebhook = 'duplicateWebhook' in body ? body.duplicateWebhook : undefined;
  if (rawDuplicateWebhook !== undefined && typeof rawDuplicateWebhook !== 'boolean')
    throw new CheckoutValidationError('duplicateWebhook is invalid');
  const duplicateWebhook = rawDuplicateWebhook ?? false;

  const rawDelaySeconds = 'delaySeconds' in body ? body.delaySeconds : undefined;
  if (
    rawDelaySeconds !== undefined &&
    (typeof rawDelaySeconds !== 'number' ||
      !Number.isInteger(rawDelaySeconds) ||
      rawDelaySeconds < 0 ||
      rawDelaySeconds > 120)
  )
    throw new CheckoutValidationError('delaySeconds is invalid');
  const delaySeconds = rawDelaySeconds ?? 0;

  const rawSuppressWebhook = 'suppressWebhook' in body ? body.suppressWebhook : undefined;
  if (rawSuppressWebhook !== undefined && typeof rawSuppressWebhook !== 'boolean')
    throw new CheckoutValidationError('suppressWebhook is invalid');
  const suppressWebhook = rawSuppressWebhook ?? false;

  return {
    outcome,
    duplicateWebhook,
    delaySeconds,
    suppressWebhook,
  };
};
