import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { S4_OperationalAcctgDocItem } from '#cds-models/arportal/mock';
import {
  s4RowToOpenItem,
  s4RowToBusinessPartner,
} from '../../srv/lib/datasource/mock-s4/mock-s4-mapper';

const baseRow = (
  overrides: Partial<S4_OperationalAcctgDocItem> = {},
): S4_OperationalAcctgDocItem => ({
  CompanyCode: '1010',
  FiscalYear: '2026',
  AccountingDocument: '1800000001',
  AccountingDocumentItem: '001',
  Customer: '1000001',
  AccountingDocumentType: 'RV',
  BillingDocument: '90000001',
  DocumentReferenceID: 'INV-2026-0001',
  InvoiceReference: null,
  PostingDate: '2026-09-01',
  DocumentDate: '2026-09-01',
  NetDueDate: '2026-10-01',
  AmountInTransactionCurrency: 1200,
  TransactionCurrency: 'EUR',
  ClearingAccountingDocument: null,
  ClearingDate: null,
  ...overrides,
});

const bpNames = { '1000001': 'ACME GmbH' };

describe('mock S/4 mapper (spec 10.3)', () => {
  describe('s4RowToOpenItem', () => {
    it('maps S/4 columns to the unified open item', () => {
      const item = s4RowToOpenItem(baseRow(), bpNames);
      assert.equal(item.companyCode, '1010');
      assert.equal(item.lineItem, '001');
      assert.equal(item.businessPartner, '1000001');
      assert.equal(item.businessPartnerName, 'ACME GmbH');
      assert.equal(item.reference, 'INV-2026-0001');
      assert.equal(item.netDueDate, '2026-10-01');
      assert.equal(item.currency, 'EUR');
    });

    it('classifies a positive amount as an invoice in cents', () => {
      const item = s4RowToOpenItem(baseRow(), bpNames);
      assert.equal(item.itemType, 'INVOICE');
      assert.equal(item.amountCents, 120000);
    });

    it('classifies a negative amount as a credit memo', () => {
      const item = s4RowToOpenItem(baseRow({ AmountInTransactionCurrency: -150 }), bpNames);
      assert.equal(item.itemType, 'CREDIT_MEMO');
      assert.equal(item.amountCents, -15000);
    });

    it('classifies a DZ document with an invoice reference as residual', () => {
      const item = s4RowToOpenItem(
        baseRow({ AccountingDocumentType: 'DZ', InvoiceReference: '1800000002' }),
        bpNames,
      );
      assert.equal(item.itemType, 'RESIDUAL');
    });

    it('converts an amount with cents without floating-point errors', () => {
      const item = s4RowToOpenItem(baseRow({ AmountInTransactionCurrency: 850.5 }), bpNames);
      assert.equal(item.amountCents, 85050);
    });

    it('returns a null name for an unknown business partner', () => {
      const item = s4RowToOpenItem(baseRow({ Customer: '9999999' }), bpNames);
      assert.equal(item.businessPartnerName, null);
    });

    it('throws when the net due date is missing', () => {
      assert.throws(() => s4RowToOpenItem(baseRow({ NetDueDate: null }), bpNames));
    });
  });

  describe('s4RowToBusinessPartner', () => {
    it('maps a business partner row', () => {
      assert.deepEqual(
        s4RowToBusinessPartner({
          BusinessPartner: '1000001',
          BusinessPartnerFullName: 'ACME GmbH',
          Country: 'DE',
        }),
        { businessPartner: '1000001', name: 'ACME GmbH', country: 'DE' },
      );
    });

    it('keeps a missing name and country as null', () => {
      assert.deepEqual(
        s4RowToBusinessPartner({
          BusinessPartner: '1000001',
        }),
        { businessPartner: '1000001', name: null, country: null },
      );
    });

    it('throws when the key is missing', () => {
      assert.throws(() => s4RowToBusinessPartner({}), /without key/);
    });
  });
});
