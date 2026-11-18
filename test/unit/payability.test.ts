import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { payabilityOf } from '../../srv/lib/open-items/payability';
import type { PartnerPermission } from '../../srv/lib/authz/scope';
import type { OpenItem } from '../../srv/lib/datasource/types';

// Item 1 of the seed data in its domain shape; each test changes only what it needs
const baseItem = (overrides: Partial<OpenItem> = {}): OpenItem => ({
  companyCode: '1010',
  fiscalYear: '2026',
  accountingDocument: '1800000001',
  lineItem: '001',
  businessPartner: '1000001',
  businessPartnerName: 'ACME GmbH',
  itemType: 'INVOICE',
  billingDocument: '90000001',
  reference: 'INV-2026-0001',
  invoiceReference: null,
  postingDate: '2026-09-01',
  documentDate: '2026-09-01',
  netDueDate: '2026-10-01',
  amountCents: 120000,
  currency: 'EUR',
  ...overrides,
});

const canPay: PartnerPermission = {
  businessPartner: '1000001',
  canView: true,
  canPay: true,
  canDispute: true,
};
const viewOnly: PartnerPermission = {
  businessPartner: '1000001',
  canView: true,
  canPay: false,
  canDispute: false,
};

const KEY = '1010|2026|1800000001|001';
const none = new Set<string>();

describe('payabilityOf (spec 5.10)', () => {
  it('allows paying an item without any blocking reason', () => {
    assert.deepEqual(payabilityOf(baseItem(), canPay, none, none), {
      isPayable: true,
      reason: null,
    });
  });

  it('blocks an item when the user cannot pay for its business partner', () => {
    assert.deepEqual(payabilityOf(baseItem(), viewOnly, none, none), {
      isPayable: false,
      reason: 'NO_PAY_PERMISSION',
    });
  });

  it('blocks an item when the business partner is outside the scope', () => {
    assert.deepEqual(payabilityOf(baseItem(), undefined, none, none), {
      isPayable: false,
      reason: 'NO_PAY_PERMISSION',
    });
  });

  it('blocks an item with an open dispute', () => {
    assert.deepEqual(payabilityOf(baseItem(), canPay, new Set([KEY]), none), {
      isPayable: false,
      reason: 'IN_DISPUTE',
    });
  });

  it('blocks an item reserved by a pending payment', () => {
    assert.deepEqual(payabilityOf(baseItem(), canPay, none, new Set([KEY])), {
      isPayable: false,
      reason: 'PAYMENT_PENDING',
    });
  });

  it('reports the missing permission first when several reasons apply', () => {
    assert.deepEqual(payabilityOf(baseItem(), viewOnly, new Set([KEY]), new Set([KEY])), {
      isPayable: false,
      reason: 'NO_PAY_PERMISSION',
    });
  });

  it('reports the dispute before the pending payment', () => {
    assert.deepEqual(payabilityOf(baseItem(), canPay, new Set([KEY]), new Set([KEY])), {
      isPayable: false,
      reason: 'IN_DISPUTE',
    });
  });
});
