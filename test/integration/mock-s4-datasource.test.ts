import cds from '@sap/cds';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockS4DataSource } from '../../srv/lib/datasource/mock-s4/mock-s4-datasource';
import type { ItemKey, OpenItemQuery } from '../../srv/lib/datasource/types';
import { S4_OperationalAcctgDocItems } from '#cds-models/arportal/mock';
import type { S4_OperationalAcctgDocItem } from '#cds-models/arportal/mock';

const { INSERT, DELETE } = cds.ql;

cds.test(__dirname + '/../..');

const key = (accountingDocument: string, companyCode = '1010'): ItemKey => ({
  companyCode,
  fiscalYear: '2026',
  accountingDocument,
  lineItem: '001',
});

describe('MockS4DataSource.getOpenItemsByKeys (spec 10.1)', () => {
  const ds = new MockS4DataSource();

  it('returns the requested items within the allowed business partners', async () => {
    const items = await ds.getOpenItemsByKeys([key('1800000002'), key('1800000004')], ['1000001']);
    assert.equal(items.length, 2);
    assert.deepEqual(items.map((i) => i.accountingDocument).sort(), ['1800000002', '1800000004']);
  });

  it('does not return items of a business partner outside the scope', async () => {
    const items = await ds.getOpenItemsByKeys([key('1800000008', '1710')], ['1000001']);
    assert.equal(items.length, 0);
  });

  it('returns nothing for a key that does not exist', async () => {
    const items = await ds.getOpenItemsByKeys([key('1899999999')], ['1000001']);
    assert.equal(items.length, 0);
  });

  it('returns nothing for an empty key list or an empty business partner list', async () => {
    const itemsNoKey = await ds.getOpenItemsByKeys([], ['1000001']);
    assert.equal(itemsNoKey.length, 0);

    const itemsNoBP = await ds.getOpenItemsByKeys([key('1800000002')], []);
    assert.equal(itemsNoBP.length, 0);
  });
});

// Query dasar: semua BP seed, tanggal spesifikasi 15, cukup besar untuk semua item
const baseQuery = (overrides: Partial<OpenItemQuery> = {}): OpenItemQuery => ({
  businessPartners: ['1000001', '1000002', '1000003'],
  today: '2026-11-01',
  orderBy: [{ field: 'NetDueDate', direction: 'asc' }],
  top: 100,
  skip: 0,
  ...overrides,
});

const documentsOf = (items: { accountingDocument: string }[]): string[] =>
  items.map((i) => i.accountingDocument).sort();

describe('MockS4DataSource.getOpenItems (spec 10.2)', () => {
  const ds = new MockS4DataSource();

  it('returns all seeded items without filters', async () => {
    const { openItems, total } = await ds.getOpenItems(baseQuery());
    assert.equal(openItems.length, 9);
    assert.equal(total, 9);
  });

  it('filters by company code', async () => {
    const { openItems, total } = await ds.getOpenItems(
      baseQuery({
        companyCode: '1710',
      }),
    );
    assert.equal(openItems.length, 3);
    assert.equal(total, 3);
    assert.deepEqual(documentsOf(openItems), ['1800000006', '1800000008', '1800000009']);
  });

  it('filters credit memos', async () => {
    const { openItems, total } = await ds.getOpenItems(
      baseQuery({
        itemType: 'CREDIT_MEMO',
      }),
    );
    assert.equal(openItems.length, 2);
    assert.equal(total, 2);
    assert.deepEqual(documentsOf(openItems), ['1800000004', '1800000009']);
  });

  it('filters overdue items', async () => {
    const { openItems, total } = await ds.getOpenItems(
      baseQuery({
        overdue: true,
      }),
    );
    assert.equal(openItems.length, 4);
    assert.equal(total, 4);
    assert.deepEqual(documentsOf(openItems), [
      '1800000001',
      '1800000004',
      '1800000008',
      '1800000009',
    ]);
  });

  it('filters items that are not overdue', async () => {
    const { openItems, total } = await ds.getOpenItems(
      baseQuery({
        overdue: false,
      }),
    );
    assert.equal(openItems.length, 5);
    assert.equal(total, 5);
    assert.deepEqual(documentsOf(openItems), [
      '1800000002',
      '1800000003',
      '1800000005',
      '1800000006',
      '1800000007',
    ]);
  });

  it('pages the result but keeps the full total', async () => {
    const { openItems, total } = await ds.getOpenItems(
      baseQuery({
        top: 3,
        skip: 3,
      }),
    );
    assert.equal(openItems.length, 3);
    assert.equal(total, 9);
  });

  it('sorts by net due date with the item key as a tie-breaker', async () => {
    const { openItems, total } = await ds.getOpenItems(
      baseQuery({
        top: 2,
      }),
    );
    assert.equal(openItems.length, 2);
    assert.equal(total, 9);
    assert.equal(openItems[0]?.accountingDocument, '1800000001');
    assert.equal(openItems[1]?.accountingDocument, '1800000009');
    assert.deepEqual(documentsOf(openItems), ['1800000001', '1800000009']);
  });

  it('returns nothing for an empty business partner list', async () => {
    const { openItems, total } = await ds.getOpenItems(
      baseQuery({
        businessPartners: [],
      }),
    );
    assert.equal(openItems.length, 0);
    assert.equal(total, 0);
    assert.deepEqual(documentsOf(openItems), []);
  });

  describe('with a residual item', () => {
    const residual: S4_OperationalAcctgDocItem = {
      CompanyCode: '1010',
      FiscalYear: '2026',
      AccountingDocument: '1400000001',
      AccountingDocumentItem: '001',
      Customer: '1000001',
      AccountingDocumentType: 'DZ',
      InvoiceReference: '1800000002',
      PostingDate: '2026-10-20',
      DocumentDate: '2026-10-20',
      NetDueDate: '2026-11-19',
      AmountInTransactionCurrency: 350.5,
      TransactionCurrency: 'EUR',
      ClearingAccountingDocument: null,
    };

    before(async () => {
      await INSERT.into(S4_OperationalAcctgDocItems).entries(residual);
    });

    after(async () => {
      await DELETE.from(S4_OperationalAcctgDocItems).where({
        AccountingDocument: residual.AccountingDocument,
      });
    });

    it('finds the residual item with the RESIDUAL filter', async () => {
      const { openItems, total } = await ds.getOpenItems(
        baseQuery({
          itemType: 'RESIDUAL',
        }),
      );

      assert.equal(openItems.length, 1);
      assert.equal(total, 1);
      assert.deepEqual(documentsOf(openItems), ['1400000001']);
    });

    it('excludes the residual item from the INVOICE filter', async () => {
      const { openItems, total } = await ds.getOpenItems(
        baseQuery({
          itemType: 'INVOICE',
        }),
      );

      assert.equal(openItems.length, 7);
      assert.equal(total, 7);
      assert.ok(!documentsOf(openItems).includes('1400000001'));
    });
  });
});
