import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app';
import type { PspConfig } from '../src/config';
import { createStore } from '../src/store';
import type { Checkout } from '../src/types';

const config: PspConfig = {
  port: 0,
  publicUrl: 'http://localhost:4005',
  apiKey: 'psp_test_key',
  webhookUrl: 'http://localhost:4004/webhooks/psp',
  webhookSecret: 'whsec_test_123',
  checkoutTtlSeconds: 1800,
};

const body = { amount: '350.00', currency: 'EUR', reference: 'PAY-TEST0001' };

interface ErrorBody {
  error: { code: string; message: string };
}

describe('Mock PSP API (spec 11.2)', () => {
  let server: Server;
  let rootUrl = '';
  let baseUrl = '';

  before(async () => {
    server = createApp(config, createStore()).listen(0);
    await once(server, 'listening');
    rootUrl = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
    baseUrl = `${rootUrl}/v1`;
  });

  after(() => {
    // fetch keeps connections alive; without this the test process does not exit
    server.closeAllConnections();
    server.close();
  });

  const request = (
    method: string,
    path: string,
    options: { key?: string; json?: unknown; auth?: boolean } = {},
  ) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(options.auth === false ? {} : { authorization: `Bearer ${config.apiKey}` }),
        ...(options.key ? { 'idempotency-key': options.key } : {}),
      },
      body: options.json === undefined ? undefined : JSON.stringify(options.json),
    });

  it('rejects a request without the API key (401)', async () => {
    const res = await request('GET', '/checkouts/chk_x', { auth: false });
    const { error } = (await res.json()) as ErrorBody;
    assert.equal(res.status, 401);
    assert.equal(error.code, 'UNAUTHORIZED');
  });

  it('requires an Idempotency-Key (400)', async () => {
    const res = await request('POST', '/checkouts', { json: body });
    const { error } = (await res.json()) as ErrorBody;
    assert.equal(res.status, 400);
    assert.equal(error.code, 'IDEMPOTENCY_KEY_REQUIRED');
  });

  it('rejects an invalid body (400)', async () => {
    const res = await request('POST', '/checkouts', {
      json: { ...body, amount: 350 },
      key: 'key-invalid',
    });
    const { error } = (await res.json()) as ErrorBody;
    assert.equal(res.status, 400);
    assert.equal(error.code, 'VALIDATION_FAILED');
    assert.match(error.message, /amount/);
  });

  it('creates a checkout (201)', async () => {
    const res = await request('POST', '/checkouts', {
      json: body,
      key: 'key-create',
    });
    const checkout = (await res.json()) as Checkout;
    assert.equal(res.status, 201);
    assert.match(checkout.id, /^chk_[0-9a-f]{24}$/);
    assert.equal(checkout.status, 'OPEN');
  });

  it('returns the same checkout for the same key and body (200)', async () => {
    const first = await request('POST', '/checkouts', {
      json: body,
      key: 'key-replay',
    });
    const firstCheckout = (await first.json()) as Checkout;
    assert.equal(first.status, 201);

    const second = await request('POST', '/checkouts', {
      json: body,
      key: 'key-replay',
    });
    const secondCheckout = (await second.json()) as Checkout;
    assert.equal(second.status, 200);
    assert.equal(secondCheckout.id, firstCheckout.id);
  });

  it('rejects the same key with a different body (409 IDEMPOTENCY_KEY_REUSED)', async () => {
    const first = await request('POST', '/checkouts', {
      json: body,
      key: 'key-reused',
    });
    assert.equal(first.status, 201);

    const second = await request('POST', '/checkouts', {
      json: { ...body, amount: '351.00' },
      key: 'key-reused',
    });
    const { error } = (await second.json()) as ErrorBody;
    assert.equal(second.status, 409);
    assert.equal(error.code, 'IDEMPOTENCY_KEY_REUSED');
  });

  it('reads a checkout by id', async () => {
    const created = await request('POST', '/checkouts', {
      json: body,
      key: 'key-read',
    });
    const createdCheckout = (await created.json()) as Checkout;
    assert.equal(created.status, 201);

    const fetched = await request('GET', `/checkouts/${createdCheckout.id}`);
    const fetchedCheckout = (await fetched.json()) as Checkout;
    assert.equal(fetched.status, 200);
    assert.equal(fetchedCheckout.id, createdCheckout.id);
  });

  it('finds checkouts by reference', async () => {
    const created = await request('POST', '/checkouts', {
      json: { ...body, reference: 'PAY-FIND0001' },
      key: 'key-reference',
    });
    const createdCheckout = (await created.json()) as Checkout;
    assert.equal(created.status, 201);

    const fetched = await request('GET', `/checkouts?reference=PAY-FIND0001`);
    const { data } = (await fetched.json()) as { data: Checkout[] };

    assert.equal(fetched.status, 200);
    assert.equal(data.length, 1);
    assert.ok(data.every((c) => c.id === createdCheckout.id));

    const res = await request('GET', '/checkouts');
    const { error } = (await res.json()) as ErrorBody;
    assert.equal(res.status, 400);
    assert.equal(error.code, 'VALIDATION_FAILED');
    assert.match(error.message, /reference/);
  });

  it('cancels an open checkout once, then 409 CHECKOUT_NOT_OPEN', async () => {
    const created = await request('POST', '/checkouts', {
      json: body,
      key: 'key-cancel',
    });
    const createdCheckout = (await created.json()) as Checkout;
    assert.equal(created.status, 201);

    const first = await request('POST', `/checkouts/${createdCheckout.id}/cancel`);
    const canceledCheckout = (await first.json()) as Checkout;
    assert.equal(first.status, 200);
    assert.equal(canceledCheckout.status, 'CANCELLED');
    assert.equal(canceledCheckout.id, createdCheckout.id);

    const second = await request('POST', `/checkouts/${createdCheckout.id}/cancel`);
    const { error } = (await second.json()) as ErrorBody;
    assert.equal(second.status, 409);
    assert.equal(error.code, 'CHECKOUT_NOT_OPEN');
    assert.match(error.message, /not open/);
  });

  it('returns 404 for an unknown checkout', async () => {
    const read = await request('GET', '/checkouts/chk_doesnotexist');
    assert.equal(read.status, 404);

    const res = await request('POST', '/checkouts/chk_doesnotexist/cancel');
    const { error } = (await res.json()) as ErrorBody;
    assert.equal(res.status, 404);
    assert.equal(error.code, 'CHECKOUT_NOT_FOUND');
    assert.match(error.message, /not found/);
  });

  describe('checkout page and pay (spec 11.3)', () => {
    const createOpenCheckout = async (key: string): Promise<Checkout> => {
      const res = await request('POST', '/checkouts', { json: body, key });
      assert.equal(res.status, 201);
      return (await res.json()) as Checkout;
    };

    // Browser routes: no API key, no /v1 prefix
    const page = (id: string) => fetch(`${rootUrl}/checkout/${id}`);
    const pay = (id: string, json: unknown) =>
      fetch(`${rootUrl}/checkout/${id}/pay`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(json),
      });

    it('serves the checkout page as HTML without an API key', async () => {
      const checkout = await createOpenCheckout('key-page');
      const res = await page(checkout.id);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') ?? '', /text\/html/);

      const html = await res.text();
      assert.ok(html.includes(`id="pay-success"`));
    });

    it('returns 404 for an unknown checkout page', async () => {
      const res = await page('chk_doesnotexist');
      assert.equal(res.status, 404);
    });

    it('pays an open checkout once', async () => {
      const checkout = await createOpenCheckout('key-pay');
      const firstPay = await pay(checkout.id, { outcome: 'success' });
      assert.equal(firstPay.status, 200);

      const data = (await firstPay.json()) as Checkout;
      assert.equal(data.status, 'SUCCEEDED');
      assert.match(data.paymentId ?? '', /^pay_[0-9a-f]{24}$/);

      const secondPay = await pay(checkout.id, { outcome: 'success' });
      assert.equal(secondPay.status, 409);
      const { error } = (await secondPay.json()) as ErrorBody;
      assert.equal(error.code, 'CHECKOUT_NOT_OPEN');

      const res = await page(checkout.id);
      const html = await res.text();
      assert.ok(html.includes('Checkout is no longer open'));
    });

    it('rejects an invalid pay request (400)', async () => {
      const checkout = await createOpenCheckout('key-pay-invalid');
      const payment = await pay(checkout.id, { outcome: 'maybe' });
      assert.equal(payment.status, 400);
      const { error } = (await payment.json()) as ErrorBody;
      assert.equal(error.code, 'VALIDATION_FAILED');
    });

    it('serves the widget with the PSP origin filled in', async () => {
      const res = await fetch(`${rootUrl}/widget.js`);
      assert.equal(res.status, 200);

      assert.match(res.headers.get('content-type') ?? '', /javascript/);

      const text = await res.text();
      assert.ok(text.includes('http://localhost:4005'));
      assert.ok(!text.includes('__PSP_ORIGIN__'));
    });

    it('serves the demo page', async () => {
      const res = await fetch(`${rootUrl}/demo`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') ?? '', /text\/html/);

      const text = await res.text();
      assert.ok(text.includes('/widget.js'));
    });
  });
});
