import cds from '@sap/cds';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Payments as PaymentTable, PaymentItems as PaymentItemTable } from '#cds-models/arportal';

type UserAuth = { auth: { username: string; password: string } };
type ODataList<T> = { value: T[] };
type HttpError = { response?: { status?: number } };
type Row = { ID?: string; BusinessPartner?: string };

const { GET } = cds.test(__dirname + '/../..');
const { INSERT, DELETE } = cds.ql;

const asUser = (username: string): UserAuth => ({ auth: { username, password: 'test' } });
const alice = asUser('alice@acme.test');
const bob = asUser('bob@globex.test');
const dave = asUser('dave@nobody.test');

const list = async (path: string, user: UserAuth): Promise<Row[]> => {
  const res = await GET(`/odata/v4/customer/${path}`, user);
  return (res.data as ODataList<Row>).value;
};

const expect404 = async (path: string, user: UserAuth): Promise<void> => {
  await assert.rejects(GET(`/odata/v4/customer/${path}`, user), (err: HttpError) => {
    assert.equal(err.response?.status, 404);
    return true;
  });
};

describe('scope on portal tables (spec 3, BR-11)', () => {
  describe('Disputes', () => {
    it('shows alice the dispute of ACME', async () => {
      const disputes = await list('Disputes', alice);
      assert.equal(disputes.length, 1);
      assert.equal(disputes[0]?.BusinessPartner, '1000001');
    });

    it('shows bob no dispute', async () => {
      const disputes = await list('Disputes', bob);
      assert.deepEqual(disputes, []);
    });

    it('shows dave no dispute', async () => {
      const disputes = await list('Disputes', dave);
      assert.deepEqual(disputes, []);
    });

    it('returns 404 when bob opens the dispute of ACME by key', async () => {
      const [dispute] = await list('Disputes', alice);
      assert.ok(dispute?.ID, 'alice should see the seeded dispute');
      await expect404(`Disputes(${dispute.ID})`, bob);
    });

    it('lets alice open the dispute of ACME by key', async () => {
      const [dispute] = await list('Disputes', alice);
      assert.ok(dispute?.ID);
      const res = await GET(`/odata/v4/customer/Disputes(${dispute.ID})`, alice);
      assert.equal(res.status, 200);
    });
  });

  describe('Payments and PaymentItems', () => {
    const paymentId = randomUUID();

    before(async () => {
      await INSERT.into(PaymentTable).entries({
        ID: paymentId,
        PaymentReference: 'PAY-TEST0001',
        BusinessPartner: '1000001',
        CompanyCode: '1010',
        Currency_code: 'EUR',
        TotalAmount: 850.5,
        IdempotencyKey: randomUUID(),
        RequestHash: 'x'.repeat(64),
        createdBy: 'alice@acme.test',
      });
      await INSERT.into(PaymentItemTable).entries({
        ID: randomUUID(),
        Payment_ID: paymentId,
        CompanyCode: '1010',
        FiscalYear: '2026',
        AccountingDocument: '1800000002',
        LineItem: '001',
        ItemType: 'INVOICE',
        OpenAmount: 850.5,
        PaidAmount: 850.5,
        IsPartial: false,
      });
    });

    after(async () => {
      await DELETE.from(PaymentItemTable).where({ Payment_ID: paymentId });
      await DELETE.from(PaymentTable).where({ ID: paymentId });
    });

    it('shows alice the payment of ACME', async () => {
      const payments = await list('Payments', alice);
      assert.equal(payments.length, 1);
      assert.equal(payments[0]?.ID, paymentId);
    });

    it('shows bob no payment', async () => {
      const payments = await list('Payments', bob);
      assert.deepEqual(payments, []);
    });

    it('returns 404 when bob opens the payment of ACME by key', async () => {
      await expect404(`Payments(${paymentId})`, bob);
    });

    it('lets alice open her payment by key', async () => {
      const res = await GET(`/odata/v4/customer/Payments(${paymentId})`, alice);
      assert.equal(res.status, 200);
    });

    it('shows alice the items of her payment', async () => {
      const paymentItems = await list('PaymentItems', alice);
      assert.equal(paymentItems.length, 1);
    });

    it('shows bob no payment items, through the parent payment', async () => {
      const paymentItems = await list('PaymentItems', bob);
      assert.deepEqual(paymentItems, []);
    });
  });
});
