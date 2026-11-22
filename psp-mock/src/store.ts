import type { Checkout } from './types';

export interface IdempotencyEntry {
  fingerprint: string;
  checkoutId: string;
}

export interface CheckoutStore {
  checkouts: Map<string, Checkout>;
  idempotency: Map<string, IdempotencyEntry>;
}

export const createStore = (): CheckoutStore => ({
  checkouts: new Map(),
  idempotency: new Map(),
});
