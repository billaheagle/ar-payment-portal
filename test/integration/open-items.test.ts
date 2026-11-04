import cds from '@sap/cds';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { OpenItem } from '#cds-models/CustomerService';
import { setClock, resetClock } from '../../srv/lib/clock';

const { GET } = cds.test(__dirname + '/../..');
const alice = { auth: { username: 'alice@acme.test', password: 'test' } };

type ODataList = { value: OpenItem[]; '@odata.count'?: number };

const readAll = async (): Promise<OpenItem[]> => {
  const res = await GET('/odata/v4/customer/OpenItems', alice);
  return (res.data as ODataList).value;
};

const byDocument = (items: OpenItem[], doc: string): OpenItem => {
  const found = items.find((i) => i.AccountingDocument === doc);
  assert.ok(found, `Open item ${doc} not found`);
  return found;
};

describe('OpenItems READ (spec 7.2, 15.2)', () => {
  before(() => {
    setClock(() => new Date('2026-11-01T00:00:00Z'));
  });

  after(() => {
    resetClock();
  });

  it('returns all 9 seeded open items', async () => {
    const items = await readAll();
    assert.equal(items.length, 9);
  });

  it('returns the total in @odata.count when $count=true', async () => {
    const res = await GET('/odata/v4/customer/OpenItems?$count=true', alice);
    assert.equal((res.data as ODataList)['@odata.count'], 9);
  });

  it('marks item 1 as 31 days overdue', async () => {
    const item: OpenItem = byDocument(await readAll(), '1800000001');
    assert.equal(item.DaysOverdue, 31);
    assert.equal(item.IsOverdue, true);
    assert.equal(item.DaysOverdueCriticality, 1);
  });

  it('marks item 2 as not overdue', async () => {
    const item: OpenItem = byDocument(await readAll(), '1800000002');
    assert.equal(item.DaysOverdue, 0);
    assert.equal(item.IsOverdue, false);
    assert.equal(item.DaysOverdueCriticality, 0);
  });

  it('classifies item 4 as a credit memo with a negative amount', async () => {
    const item: OpenItem = byDocument(await readAll(), '1800000004');
    assert.equal(item.ItemType, 'CREDIT_MEMO');
    assert.equal(Number(item.Amount), -150);
  });

  it('maps the business partner name', async () => {
    const items: OpenItem[] = await readAll();
    assert.equal(byDocument(items, '1800000001').BusinessPartnerName, 'ACME GmbH');
    assert.equal(byDocument(items, '1800000008').BusinessPartnerName, 'Globex Inc.');
  });

  it('maps AccountingDocumentItem to LineItem', async () => {
    assert.equal(byDocument(await readAll(), '1800000001').LineItem, '001');
  });
});
