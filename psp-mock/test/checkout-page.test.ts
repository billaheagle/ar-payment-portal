import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, renderCheckoutPage } from '../src/checkout-page';
import type { Checkout } from '../src/types';

const checkout = (overrides: Partial<Checkout> = {}): Checkout => ({
  id: 'chk_0123456789abcdef01234567',
  status: 'OPEN',
  url: 'http://localhost:4005/checkout/chk_0123456789abcdef01234567',
  amount: '350.00',
  currency: 'EUR',
  reference: 'PAY-TEST0001',
  expiresAt: '2026-11-01T00:30:00.000Z',
  ...overrides,
});

describe('escapeHtml', () => {
  it('escapes the five HTML special characters', () => {
    assert.equal(
      escapeHtml(`<b>"Tom" & 'Jerry'</b>`),
      '&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;',
    );
  });

  it('escapes & first so entities are not escaped twice', () => {
    assert.equal(escapeHtml('<b>'), '&lt;b&gt;');
  });

  it('leaves plain text unchanged', () => {
    assert.equal(escapeHtml('PAY-TEST0001'), 'PAY-TEST0001');
  });
});

describe('renderCheckoutPage (spec 11.3)', () => {
  it('shows amount, currency and reference', () => {
    const html = renderCheckoutPage(checkout(), true, true);
    assert.ok(html.includes('350.00 EUR'));
    assert.ok(html.includes('PAY-TEST0001'));
  });

  it('escapes the reference', () => {
    const html = renderCheckoutPage(
      checkout({
        reference: '<script>alert(1)</script>',
      }),
      true,
      true,
    );

    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  });

  it('shows pay buttons and test options while open', () => {
    const html = renderCheckoutPage(checkout(), true, true);
    assert.ok(html.includes(`id="pay-success"`));
    assert.ok(html.includes(`id="pay-decline"`));
    assert.ok(html.includes('Send webhook twice'));
  });

  it('shows "no longer open" instead of the buttons when closed', () => {
    const html = renderCheckoutPage(checkout(), false, true);
    assert.ok(html.includes('Checkout is no longer open'));
    assert.ok(!html.includes(`id="pay-success"`));
  });

  it('adds a close button only when embedded', () => {
    const htmlEmbedded = renderCheckoutPage(checkout(), false, true);
    assert.ok(htmlEmbedded.includes(`id="close"`));

    const htmlNotEmbedded = renderCheckoutPage(checkout(), false, false);
    assert.ok(!htmlNotEmbedded.includes(`id="close"`));
  });
});
