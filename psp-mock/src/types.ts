export const CHECKOUT_STATUSES = ['OPEN', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED'] as const;
export type CheckoutStatus = (typeof CHECKOUT_STATUSES)[number];

export interface CheckoutInput {
  amount: string; // "350.00": always two decimals, never a number
  currency: string;
  reference: string;
  returnUrl?: string;
}

export interface Checkout extends CheckoutInput {
  id: string; // chk_ + 24 hex
  status: CheckoutStatus;
  url: string;
  expiresAt: string; // ISO UTC
  paymentId?: string; // pay_ + 24 hex, only when SUCCEEDED
}
