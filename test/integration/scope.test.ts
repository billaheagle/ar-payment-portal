import cds from '@sap/cds';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadScope } from '../../srv/lib/authz/scope';

cds.test(__dirname + '/../..'); // starts CAP with the seeded in-memory database

describe('loadScope (spec 3)', () => {
  it('loads the active assignments of alice with their permissions', async () => {
    const aliceScope = await loadScope('alice@acme.test');
    const sorted = [...aliceScope].sort((a, b) =>
      a.businessPartner.localeCompare(b.businessPartner),
    );

    assert.deepEqual(sorted, [
      { businessPartner: '1000001', canView: true, canPay: true, canDispute: true },
      { businessPartner: '1000002', canView: true, canPay: false, canDispute: false },
    ]);
  });

  it('returns an empty scope for a user without assignments', async () => {
    assert.deepEqual(await loadScope('dave@nobody.test'), []);
  });
});
