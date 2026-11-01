import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { requestHash, type RequestHashItem } from '../../srv/lib/payment/request-hash';

const item2: RequestHashItem = {
  companyCode: '1010',
  fiscalYear: '2026',
  accountingDocument: '1800000002',
  lineItem: '001',
  amountCents: 50000,
};

const item4: RequestHashItem = {
  companyCode: '1010',
  fiscalYear: '2026',
  accountingDocument: '1800000004',
  lineItem: '001',
  amountCents: 15000,
};

describe('requestHash (spec 7.3, BR-12)', () => {
  it('matches the test vector', () => {
    assert.equal(
      requestHash([item2, item4]),
      '085a40be9be1459d8e7d8c60f8782c59b5b22d52725f959705c9cade2ab4b1be',
    );
  });

  it('gives the same hash regardless of item order', () => {
    assert.equal(requestHash([item4, item2]), requestHash([item2, item4]));
  });

  it('changes when an amount differs by 1 cent', () => {
    const changed = { ...item4, amountCents: 15001 };
    assert.notEqual(requestHash([changed]), requestHash([item4]));
  });

  it('changes when the line item differs', () => {
    const changed = { ...item4, lineItem: '002' };
    assert.notEqual(requestHash([changed]), requestHash([item4]));
  });

  it('always returns 64 lowercase hex characters', () => {
    assert.match(requestHash([item2]), /^[0-9a-f]{64}$/);
  });

  it('does not reorder the caller array', () => {
    const input = [item4, item2];
    requestHash(input);

    assert.equal(input[0], item4);
  });
});
