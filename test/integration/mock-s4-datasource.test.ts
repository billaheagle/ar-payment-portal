import cds from '@sap/cds';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockS4DataSource } from '../../srv/lib/datasource/mock-s4/mock-s4-datasource';
import type { ItemKey } from '../../srv/lib/datasource/types';

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
