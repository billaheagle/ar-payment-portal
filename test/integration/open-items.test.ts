import cds from '@sap/cds';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { OpenItem } from '#cds-models/CustomerService';
import { setClock, resetClock } from '../../srv/lib/clock';

type UserAuth = { auth: { username: string; password: string } };

const { GET } = cds.test(__dirname + '/../..');
const asUser = (username: string): UserAuth => ({ auth: { username, password: 'test' } });
const alice = asUser('alice@acme.test');

type ODataList = { value: OpenItem[]; '@odata.count'?: number };

const readAll = async (): Promise<OpenItem[]> => {
  const res = await GET('/odata/v4/customer/OpenItems', alice);
  return (res.data as ODataList).value;
};

type HttpError = {
  response?: { status?: number; data?: { error?: { code?: string } } };
};

// Reads OpenItems with the given OData query options
const readWith = async (
  options: string,
  user: UserAuth = alice,
): Promise<{ items: OpenItem[]; count?: number }> => {
  const res = await GET(`/odata/v4/customer/OpenItems?${options}`, user);
  const body = res.data as ODataList;
  return { items: body.value, count: body['@odata.count'] };
};

const documentsOf = (items: OpenItem[]): string[] =>
  items.map((i) => String(i.AccountingDocument)).sort();

// The request must fail with 400 and the UNSUPPORTED_QUERY code
const expectUnsupported = async (options: string): Promise<void> => {
  await assert.rejects(GET(`/odata/v4/customer/OpenItems?${options}`, alice), (err: HttpError) => {
    assert.equal(err.response?.status, 400);
    assert.equal(err.response.data?.error?.code, 'UNSUPPORTED_QUERY');
    return true;
  });
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

  it("returns the open items of the user's business partners", async () => {
    const items = await readAll();
    assert.equal(items.length, 7);
  });

  it('returns the total in @odata.count when $count=true', async () => {
    const res = await GET('/odata/v4/customer/OpenItems?$count=true', alice);
    assert.equal((res.data as ODataList)['@odata.count'], 7);
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
    assert.equal(item.ItemTypeText, 'Credit Memo');
    assert.equal(Number(item.Amount), -150);
  });

  it('returns a readable text for every item type', async () => {
    const items = await readAll();
    assert.equal(byDocument(items, '1800000001').ItemTypeText, 'Invoice');
    assert.equal(byDocument(items, '1800000004').ItemTypeText, 'Credit Memo');
  });

  it('maps the business partner name', async () => {
    const items: OpenItem[] = await readAll();
    assert.equal(byDocument(items, '1800000001').BusinessPartnerName, 'ACME GmbH');
    assert.equal(byDocument(items, '1800000007').BusinessPartnerName, 'ACME Logistics GmbH');
  });

  it('maps AccountingDocumentItem to LineItem', async () => {
    assert.equal(byDocument(await readAll(), '1800000001').LineItem, '001');
  });

  describe('OData query options (spec 9.3)', () => {
    it('filters by company code', async () => {
      const { items } = await readWith("$filter=CompanyCode eq '1710'");
      assert.deepEqual(documentsOf(items), ['1800000006']);
    });

    it('filters overdue items', async () => {
      const { items } = await readWith('$filter=IsOverdue eq true');
      assert.deepEqual(documentsOf(items), ['1800000001', '1800000004']);
    });

    it('filters credit memos', async () => {
      const { items } = await readWith("$filter=ItemType eq 'CREDIT_MEMO'");
      assert.deepEqual(documentsOf(items), ['1800000004']);
    });

    it('does not widen the scope with a business partner filter', async () => {
      const { items } = await readWith("$filter=BusinessPartner eq '1000003'");
      assert.deepEqual(documentsOf(items), []);
    });

    it('filters by several business partners joined with or', async () => {
      const { items } = await readWith(
        "$filter=BusinessPartner eq '1000001' or BusinessPartner eq '1000002'",
      );
      assert.deepEqual(documentsOf(items), [
        '1800000001',
        '1800000002',
        '1800000003',
        '1800000004',
        '1800000005',
        '1800000006',
        '1800000007',
      ]);
    });

    it('combines a filter with an or-group', async () => {
      const { items } = await readWith(
        "$filter=CompanyCode eq '1010' and (BusinessPartner eq '1000001' or BusinessPartner eq '1000002')",
      );
      assert.deepEqual(documentsOf(items), [
        '1800000001',
        '1800000002',
        '1800000003',
        '1800000004',
        '1800000005',
        '1800000007',
      ]);
    });

    it('pages the result and returns the full count', async () => {
      const { items, count } = await readWith('$top=3&$skip=3&$count=true');
      assert.equal(items.length, 3);
      assert.equal(count, 7);
    });

    it('sorts by amount descending', async () => {
      const { items } = await readWith('$orderby=Amount desc&$top=1');
      assert.equal(items.length, 1);

      const [first] = items;
      assert.ok(first);
      assert.equal(first.AccountingDocument, '1800000003');
      assert.equal(Number(first.Amount), 2000);
      assert.equal(first.Currency, 'EUR');
    });

    it('still filters by the item type code', async () => {
      const { items } = await readWith("$filter=ItemType eq 'CREDIT_MEMO'");
      assert.deepEqual(documentsOf(items), ['1800000004']);
      assert.ok(items.every((i) => i.ItemTypeText === 'Credit Memo'));
    });

    it('rejects $search with 400', async () => {
      await expectUnsupported('$search=INV');
    });

    it('rejects a filter on an unsupported field', async () => {
      await expectUnsupported("$filter=Reference eq 'INV-2026-0001'");
    });

    it('rejects an operator other than eq', async () => {
      await expectUnsupported("$filter=CompanyCode ne '1010'");
    });
  });

  describe('single open item by key (spec 7.2)', () => {
    // OData key URL for one open item
    const keyUrl = (accountingDocument: string, companyCode = '1010'): string =>
      `/odata/v4/customer/OpenItems(CompanyCode='${companyCode}',FiscalYear='2026',` +
      `AccountingDocument='${accountingDocument}',LineItem='001')`;

    it('returns one open item, not a list', async () => {
      const res = await GET(keyUrl('1800000001'), alice);
      const item = res.data as OpenItem;

      assert.equal(res.status, 200);
      assert.equal(item.AccountingDocument, '1800000001');
      assert.equal(item.LineItem, '001');
      assert.equal(item.DaysOverdue, 31);
      assert.equal('value' in (res.data as object), false);
    });

    it('returns 404 for an item that does not exist', async () => {
      await assert.rejects(GET(keyUrl('1899999999'), alice), (err: HttpError) => {
        assert.equal(err.response?.status, 404);
        return true;
      });
    });

    it('finds an item in another company code', async () => {
      const res = await GET(keyUrl('1800000006', '1710'), alice);
      const item = res.data as OpenItem;

      assert.equal(res.status, 200);
      assert.equal(item.AccountingDocument, '1800000006');
      assert.equal(item.BusinessPartner, '1000001');
    });

    it('returns 404 for an item of another customer', async () => {
      await assert.rejects(GET(keyUrl('1800000008', '1710'), alice), (err: HttpError) => {
        assert.equal(err.response?.status, 404);
        return true;
      });
    });
  });
});

describe('scope per user (spec 3, BR-11)', () => {
  it('shows carol only the items of ACME GmbH', async () => {
    const { items } = await readWith('', asUser('carol@acme.test'));
    assert.deepEqual(documentsOf(items), [
      '1800000001',
      '1800000002',
      '1800000003',
      '1800000004',
      '1800000005',
      '1800000006',
    ]);
  });

  it('shows bob only the items of Globex', async () => {
    const { items } = await readWith('', asUser('bob@globex.test'));
    assert.deepEqual(documentsOf(items), ['1800000008', '1800000009']);
    assert.equal(byDocument(items, '1800000008').BusinessPartnerName, 'Globex Inc.');
    assert.equal(byDocument(items, '1800000009').BusinessPartnerName, 'Globex Inc.');
  });

  it('shows dave nothing because he has no assignment', async () => {
    const { items, count } = await readWith('$count=true', asUser('dave@nobody.test'));
    assert.deepEqual(documentsOf(items), []);
    assert.equal(count, 0);
  });
});
