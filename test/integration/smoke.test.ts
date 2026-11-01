import cds from '@sap/cds';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const { GET } = cds.test(__dirname + '/../..');

const alice = { auth: { username: 'alice@acme.test', password: 'test' } };
const admin = { auth: { username: 'admin@portal.test', password: 'test' } };

type HttpError = { response?: { status?: number } };
const hasStatus = (status: number) => (err: HttpError) => err.response?.status === status;

describe('CustomerService smoke test', () => {
  it('serves $metadata to a CustomerUser', async () => {
    const res = await GET('/odata/v4/customer/$metadata', alice);
    assert.equal(res.status, 200);
  });

  it('rejects anonymous access with 401', async () => {
    await assert.rejects(GET('/odata/v4/customer/$metadata'), hasStatus(401));
  });

  it('rejects a user without the CustomerUser role with 403', async () => {
    await assert.rejects(GET('/odata/v4/customer/$metadata', admin), hasStatus(403));
  });

  it('returns the seeded dispute', async () => {
    const res = await GET('/odata/v4/customer/Disputes', alice);
    const body = res.data as { value: unknown[] };
    assert.equal(body.value.length, 1);
  });
});
