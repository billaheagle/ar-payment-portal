import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cancelCheckout,
  CheckoutValidationError,
  createCheckout,
  expireCheckouts,
  findByReference,
  parseCheckoutInput,
  parsePayRequest,
  payCheckout,
} from '../src/checkouts';
import type { CreateContext, CreateResult } from '../src/checkouts';
import { createStore } from '../src/store';
import type { Checkout, CheckoutInput } from '../src/types';

const NOW = new Date('2026-11-01T00:00:00Z');
const ctx: CreateContext = { now: NOW, publicUrl: 'http://localhost:4005', ttlSeconds: 1800 };

const input = (overrides: Partial<CheckoutInput> = {}): CheckoutInput => ({
  amount: '350.00',
  currency: 'EUR',
  reference: 'PAY-TEST0001',
  ...overrides,
});

// Narrows a CreateResult to the expected kind so the test can read .checkout
const expectKind = <K extends CreateResult['kind']>(
  result: CreateResult,
  kind: K,
): Extract<CreateResult, { kind: K }> => {
  assert.equal(result.kind, kind);
  return result as Extract<CreateResult, { kind: K }>;
};

const created = (key = 'key-1', overrides: Partial<CheckoutInput> = {}): Checkout => {
  const store = createStore();
  return expectKind(createCheckout(store, key, input(overrides), ctx), 'created').checkout;
};

// Checks both the error class and that the message names the right field
const expectInvalid = (
  body: unknown,
  field: RegExp,
  parse: (body: unknown) => unknown = parseCheckoutInput,
): void => {
  assert.throws(
    () => parse(body),
    (err) => err instanceof CheckoutValidationError && field.test(err.message),
  );
};

describe('parseCheckoutInput (spec 11.2)', () => {
  it('accepts a body without returnUrl', () => {
    assert.deepEqual(
      parseCheckoutInput({ amount: '350.00', currency: 'EUR', reference: 'PAY-1' }),
      { amount: '350.00', currency: 'EUR', reference: 'PAY-1' },
    );
  });

  it('keeps returnUrl when given', () => {
    assert.deepEqual(
      parseCheckoutInput({
        amount: '350.00',
        currency: 'EUR',
        reference: 'PAY-1',
        returnUrl: '/odata/v4',
      }),
      { amount: '350.00', currency: 'EUR', reference: 'PAY-1', returnUrl: '/odata/v4' },
    );
  });

  it('rejects a body that is not an object', () => {
    expectInvalid(null, /JSON object/);
    expectInvalid('text', /JSON object/);
    expectInvalid(42, /JSON object/);
  });

  it('rejects missing required fields', () => {
    expectInvalid({ currency: 'EUR', reference: 'PAY-1' }, /amount/);
    expectInvalid({ amount: '350.00', reference: 'PAY-1' }, /currency/);
    expectInvalid({ amount: '350.00', currency: 'EUR' }, /reference/);
  });

  it('rejects invalid amounts', () => {
    [350, '350', '350.5', '350.555', '0.00', '-1.00'].forEach((amount) => {
      expectInvalid({ amount: amount, currency: 'EUR', reference: 'PAY-1' }, /amount/);
    });
  });

  it('rejects invalid currency, reference and returnUrl', () => {
    expectInvalid({ amount: '350.00', currency: 'eur', reference: 'PAY-1' }, /currency/);
    expectInvalid({ amount: '350.00', currency: 'EURO', reference: 'PAY-1' }, /currency/);
    expectInvalid({ amount: '350.00', currency: 'EUR', reference: '' }, /reference/);
    expectInvalid({ amount: '350.00', currency: 'EUR', reference: 'x'.repeat(36) }, /reference/);
    expectInvalid(
      {
        amount: '350.00',
        currency: 'EUR',
        reference: 'PAY-1',
        returnUrl: 123,
      },
      /returnUrl/,
    );
  });
});

describe('createCheckout (spec 11.2)', () => {
  it('creates an OPEN checkout with the expected id, url and expiry', () => {
    const checkout = created();
    assert.match(checkout.id, /^chk_[0-9a-f]{24}$/);
    assert.equal(checkout.status, 'OPEN');
    assert.equal(checkout.url, `http://localhost:4005/checkout/${checkout.id}`);
    assert.equal(checkout.expiresAt, '2026-11-01T00:30:00.000Z');
    assert.equal(checkout.paymentId, undefined);
  });

  it('returns the same checkout for the same key and body', () => {
    const store = createStore();
    const first = expectKind(createCheckout(store, 'k', input(), ctx), 'created');
    const second = expectKind(createCheckout(store, 'k', input(), ctx), 'replayed');
    assert.equal(store.checkouts.size, 1);
    assert.equal(second.checkout.id, first.checkout.id);
  });

  it('treats the same body with a different key order as the same request', () => {
    const store = createStore();
    expectKind(createCheckout(store, 'k', input(), ctx), 'created');

    expectKind(
      createCheckout(
        store,
        'k',
        { reference: 'PAY-TEST0001', currency: 'EUR', amount: '350.00' },
        ctx,
      ),
      'replayed',
    );

    assert.equal(store.checkouts.size, 1);
  });

  it('rejects the same key with a different body', () => {
    const store = createStore();
    expectKind(createCheckout(store, 'k', input({ amount: '350.00' }), ctx), 'created');
    expectKind(createCheckout(store, 'k', input({ amount: '351.00' }), ctx), 'conflict');
    assert.equal(store.checkouts.size, 1);
  });

  it('creates separate checkouts for different keys', () => {
    const store = createStore();
    expectKind(createCheckout(store, 'k1', input(), ctx), 'created');
    expectKind(createCheckout(store, 'k2', input(), ctx), 'created');
    assert.equal(store.checkouts.size, 2);
  });
});

describe('findByReference', () => {
  it('returns every checkout with that reference and nothing else', () => {
    const store = createStore();
    expectKind(createCheckout(store, 'k1', input({ reference: 'PAY-A' }), ctx), 'created');
    expectKind(createCheckout(store, 'k2', input({ reference: 'PAY-B' }), ctx), 'created');
    assert.equal(store.checkouts.size, 2);

    assert.equal(findByReference(store, 'PAY-A').length, 1);
    assert.equal(findByReference(store, 'PAY-B').length, 1);
    assert.deepEqual(findByReference(store, 'PAY-Z'), []);
  });
});

describe('cancelCheckout (spec 11.2)', () => {
  it('cancels an open checkout once', () => {
    const store = createStore();

    const { checkout } = expectKind(
      createCheckout(store, 'k', input({ reference: 'PAY-CANCEL' }), ctx),
      'created',
    );
    const firstCancel = cancelCheckout(store, checkout.id, new Date('2026-11-01T00:15:00.000Z'));
    assert.equal(firstCancel.kind, 'cancelled');

    const find = findByReference(store, 'PAY-CANCEL');
    assert.equal(find.length, 1);
    assert.ok(find.every((c) => c.status === 'CANCELLED'));

    const secondCancel = cancelCheckout(store, checkout.id, new Date('2026-11-01T00:20:00.000Z'));
    assert.equal(secondCancel.kind, 'not_open');
  });

  it('does not cancel an expired checkout', () => {
    const store = createStore();
    const { checkout } = expectKind(
      createCheckout(store, 'k', input({ reference: 'PAY-EXPIRED' }), ctx),
      'created',
    );

    const firstCancel = cancelCheckout(store, checkout.id, new Date('2026-11-01T00:31:00.000Z'));
    assert.equal(firstCancel.kind, 'not_open');

    const find = findByReference(store, 'PAY-EXPIRED');
    assert.equal(find.length, 1);
    assert.ok(find.every((c) => c.status === 'OPEN'));
  });

  it('still cancels exactly at expiresAt', () => {
    const store = createStore();
    const { checkout } = expectKind(
      createCheckout(store, 'k', input({ reference: 'PAY-CANCEL' }), ctx),
      'created',
    );

    const firstCancel = cancelCheckout(store, checkout.id, new Date('2026-11-01T00:30:00.000Z'));
    assert.equal(firstCancel.kind, 'cancelled');

    const find = findByReference(store, 'PAY-CANCEL');
    assert.equal(find.length, 1);
    assert.ok(find.every((c) => c.status === 'CANCELLED'));
  });

  it('returns not_found for an unknown id', () => {
    const store = createStore();

    expectKind(createCheckout(store, 'k', input({ reference: 'PAY-A' }), ctx), 'created');

    const firstCancel = cancelCheckout(
      store,
      'chk_doesnotexist',
      new Date('2026-11-01T00:30:00.000Z'),
    );
    assert.equal(firstCancel.kind, 'not_found');

    const find = findByReference(store, 'PAY-A');
    assert.equal(find.length, 1);
    assert.ok(find.every((c) => c.status === 'OPEN'));
  });
});

describe('payCheckout (spec 11.3)', () => {
  it('marks an open checkout SUCCEEDED with a payment id', () => {
    const store = createStore();

    const { checkout } = expectKind(
      createCheckout(store, 'k', input({ reference: 'PAY-A' }), ctx),
      'created',
    );

    const pay = payCheckout(store, checkout.id, 'success', NOW);
    assert.equal(pay.kind, 'processed');
    assert.equal(pay.checkout.status, 'SUCCEEDED');
    assert.match(pay.checkout.paymentId ?? '', /^pay_[0-9a-f]{24}$/);
  });

  it('marks an open checkout FAILED without a payment id on decline', () => {
    const store = createStore();

    const { checkout } = expectKind(
      createCheckout(store, 'k', input({ reference: 'PAY-A' }), ctx),
      'created',
    );

    const pay = payCheckout(store, checkout.id, 'decline', NOW);
    assert.equal(pay.kind, 'processed');
    assert.equal(pay.checkout.status, 'FAILED');
    assert.equal(pay.checkout.paymentId, undefined);
  });

  it('does not pay a checkout twice', () => {
    const store = createStore();

    const { checkout } = expectKind(
      createCheckout(store, 'k', input({ reference: 'PAY-REPAY' }), ctx),
      'created',
    );

    const firstPay = payCheckout(store, checkout.id, 'success', NOW);
    assert.equal(firstPay.kind, 'processed');
    assert.equal(firstPay.checkout.status, 'SUCCEEDED');
    assert.match(firstPay.checkout.paymentId ?? '', /^pay_[0-9a-f]{24}$/);

    const secondPay = payCheckout(store, checkout.id, 'success', NOW);
    assert.equal(secondPay.kind, 'not_open');

    const find = findByReference(store, checkout.reference);
    assert.ok(find.every((c) => c.paymentId === firstPay.checkout.paymentId));
  });

  it('does not pay an expired or cancelled checkout', () => {
    const store = createStore();

    const { checkout } = expectKind(
      createCheckout(store, 'k', input({ reference: 'PAY-REPAY' }), ctx),
      'created',
    );

    const expired = payCheckout(
      store,
      checkout.id,
      'success',
      new Date('2026-11-01T00:31:00.000Z'),
    );
    assert.equal(expired.kind, 'not_open');

    const cancel = cancelCheckout(store, checkout.id, NOW);
    assert.equal(cancel.kind, 'cancelled');
    const canceledPay = payCheckout(store, checkout.id, 'success', NOW);
    assert.equal(canceledPay.kind, 'not_open');
  });

  it('returns not_found for an unknown id', () => {
    const store = createStore();
    const unknown = payCheckout(store, 'unknown_id', 'success', NOW);
    assert.equal(unknown.kind, 'not_found');
  });
});

describe('expireCheckouts (spec 11.3)', () => {
  it('expires only open checkouts past expiresAt', () => {
    const store = createStore();

    const { checkout: checkoutA } = expectKind(
      createCheckout(store, 'k1', input({ reference: 'PAY-A' }), ctx),
      'created',
    );

    const { checkout: checkoutB } = expectKind(
      createCheckout(store, 'k2', input({ reference: 'PAY-B' }), ctx),
      'created',
    );
    const cancel = cancelCheckout(store, checkoutB.id, NOW);
    assert.equal(cancel.kind, 'cancelled');

    const { checkout: checkoutC } = expectKind(
      createCheckout(store, 'k3', input({ reference: 'PAY-C' }), ctx),
      'created',
    );
    const pay = payCheckout(store, checkoutC.id, 'success', NOW);
    assert.equal(pay.kind, 'processed');
    assert.equal(pay.checkout.status, 'SUCCEEDED');
    assert.match(pay.checkout.paymentId ?? '', /^pay_[0-9a-f]{24}$/);

    const expired = expireCheckouts(store, new Date('2026-11-01T00:31:00.000Z'));
    assert.deepEqual(
      expired.map((c) => c.id),
      [checkoutA.id],
    );

    assert.equal(checkoutA.status, 'EXPIRED');
    assert.equal(checkoutB.status, 'CANCELLED');
    assert.equal(checkoutC.status, 'SUCCEEDED');
    assert.deepEqual(expireCheckouts(store, new Date('2026-11-01T00:32:00.000Z')), []);
  });

  it('leaves checkouts alone before expiresAt', () => {
    const store = createStore();

    const { checkout: checkoutA } = expectKind(
      createCheckout(store, 'k1', input({ reference: 'PAY-A' }), ctx),
      'created',
    );
    const expired = expireCheckouts(store, new Date('2026-11-01T00:30:00.000Z'));
    assert.deepEqual(expired, []);
    assert.equal(checkoutA.status, 'OPEN');
  });
});

describe('parsePayRequest (spec 11.3)', () => {
  it('fills defaults when only outcome is sent', () => {
    assert.deepEqual(parsePayRequest({ outcome: 'success' }), {
      outcome: 'success',
      duplicateWebhook: false,
      delaySeconds: 0,
      suppressWebhook: false,
    });
  });

  it('keeps options that are sent', () => {
    // TODO: { outcome: 'decline', duplicateWebhook: true, delaySeconds: 15, suppressWebhook: true }
    //       → deepEqual the same object
    assert.deepEqual(
      parsePayRequest({
        outcome: 'decline',
        duplicateWebhook: true,
        delaySeconds: 15,
        suppressWebhook: true,
      }),
      { outcome: 'decline', duplicateWebhook: true, delaySeconds: 15, suppressWebhook: true },
    );
  });

  it('accepts delaySeconds at the limits', () => {
    assert.doesNotThrow(() => parsePayRequest({ outcome: 'success', delaySeconds: 0 }));
    assert.doesNotThrow(() => parsePayRequest({ outcome: 'success', delaySeconds: 120 }));
  });

  it('rejects a missing or unknown outcome', () => {
    expectInvalid({}, /outcome/, parsePayRequest);
    expectInvalid({ outcome: 'maybe' }, /outcome/, parsePayRequest);
  });

  it('rejects invalid options', () => {
    [-1, 121, 1.5, '15'].forEach((second) => {
      expectInvalid({ outcome: 'success', delaySeconds: second }, /delaySeconds/, parsePayRequest);
    });
    expectInvalid(
      { outcome: 'success', duplicateWebhook: 'true' },
      /duplicateWebhook/,
      parsePayRequest,
    );
    expectInvalid({ outcome: 'success', suppressWebhook: 1 }, /suppressWebhook/, parsePayRequest);
  });
});
