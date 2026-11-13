import cds from '@sap/cds';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Ecc_BSIDs } from '#cds-models/arportal/mock';
import type { Ecc_BSID } from '#cds-models/arportal/mock';
import { MockEccDataSource } from '../../srv/lib/datasource/mock-ecc/mock-ecc-datasource';
import type { ItemKey, OpenItemQuery } from '../../srv/lib/datasource/types';

cds.test(__dirname + '/../..');
const { INSERT, DELETE } = cds.ql;

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

const key = (accountingDocument: string, companyCode = '1010'): ItemKey => ({
  companyCode,
  fiscalYear: '2026',
  accountingDocument,
  lineItem: '001',
});

// Expected results are the SAME as for the mock S/4 tests: both data sources must agree.
describe('MockEccDataSource (spec 10.1–10.3)', () => {
  const ds = new MockEccDataSource();

  describe('getOpenItems', () => {
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
      const residual: Ecc_BSID = {
        BUKRS: '1010',
        GJAHR: '2026',
        BELNR: '1400000001',
        BUZEI: '001',
        KUNNR: '0001000001',
        BLART: 'DZ',
        REBZG: '1800000002',
        BUDAT: '20261020',
        BLDAT: '20261020',
        ZFBDT: '20261020',
        ZBD1T: 30,
        WRBTR: 350.5,
        SHKZG: 'S',
        WAERS: 'EUR',
        AUGBL: null,
      };

      before(async () => {
        await INSERT.into(Ecc_BSIDs).entries(residual);
      });

      after(async () => {
        await DELETE.from(Ecc_BSIDs).where({ BELNR: residual.BELNR });
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
        assert.deepEqual(documentsOf(openItems), [
          '1800000001',
          '1800000002',
          '1800000003',
          '1800000005',
          '1800000006',
          '1800000007',
          '1800000008',
        ]);
      });
    });
  });

  describe('getOpenItemsByKeys', () => {
    it('returns the requested items within the allowed business partners', async () => {
      const items = await ds.getOpenItemsByKeys(
        [key('1800000002'), key('1800000004')],
        ['1000001'],
      );
      assert.equal(items.length, 2);
      assert.deepEqual(documentsOf(items), ['1800000002', '1800000004']);
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

  describe('getBusinessPartners', () => {
    it('finds partners by their number without leading zeros', async () => {
      const partners = await ds.getBusinessPartners(['1000001']);
      assert.deepEqual(partners, [
        { businessPartner: '1000001', name: 'ACME GmbH', country: 'DE' },
      ]);
    });
  });
});
