import cds from '@sap/cds';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { BusinessPartner } from '#cds-models/CustomerService';

type UserAuth = { auth: { username: string; password: string } };
type ODataList = { value: BusinessPartner[]; '@odata.count'?: number };
type HttpError = { response?: { status?: number } };

const { GET } = cds.test(__dirname + '/../..');

const asUser = (username: string): UserAuth => ({ auth: { username, password: 'test' } });
const alice = asUser('alice@acme.test');

const readPartners = async (
  options = '',
  user: UserAuth = alice,
): Promise<{ partners: BusinessPartner[]; count?: number }> => {
  const res = await GET(`/odata/v4/customer/BusinessPartners?${options}`, user);
  const body = res.data as ODataList;
  return { partners: body.value, count: body['@odata.count'] };
};

describe('BusinessPartners READ (spec 3, 5.9)', () => {
  it("returns alice's business partners with her permissions", async () => {
    const { partners } = await readPartners();
    assert.deepEqual(partners, [
      {
        BusinessPartner: '1000001',
        Name: 'ACME GmbH',
        Country: 'DE',
        CanPay: true,
        CanDispute: true,
      },
      {
        BusinessPartner: '1000002',
        Name: 'ACME Logistics GmbH',
        Country: 'DE',
        CanPay: false,
        CanDispute: false,
      },
    ]);
  });

  it('returns only Globex for bob', async () => {
    const { partners } = await readPartners('', asUser('bob@globex.test'));
    assert.deepEqual(partners, [
      {
        BusinessPartner: '1000003',
        Name: 'Globex Inc.',
        Country: 'US',
        CanPay: true,
        CanDispute: false,
      },
    ]);
  });

  it('returns nothing for dave', async () => {
    const { partners, count } = await readPartners('$count=true', asUser('dave@nobody.test'));
    assert.deepEqual(partners, []);
    assert.equal(count, 0);
  });

  it('pages the result and keeps the full count', async () => {
    const { partners, count } = await readPartners('$top=1&$count=true');
    assert.deepEqual(partners, [
      {
        BusinessPartner: '1000001',
        Name: 'ACME GmbH',
        Country: 'DE',
        CanPay: true,
        CanDispute: true,
      },
    ]);
    assert.equal(count, 2);
  });

  describe('single business partner by key', () => {
    it('returns one business partner, not a list', async () => {
      const res = await GET("/odata/v4/customer/BusinessPartners('1000001')", alice);
      const item = res.data as BusinessPartner;
      assert.equal(item.BusinessPartner, '1000001');
      assert.equal(item.Name, 'ACME GmbH');
      assert.equal(item.CanPay, true);
      assert.equal('value' in (res.data as object), false);
    });

    it('returns 404 for a business partner outside the scope', async () => {
      await assert.rejects(
        GET("/odata/v4/customer/BusinessPartners('1000003')", alice),
        (err: HttpError) => {
          assert.equal(err.response?.status, 404);
          return true;
        },
      );
    });
  });
});
