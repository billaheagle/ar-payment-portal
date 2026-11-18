import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { visiblePartners, permissionsFor, type UserScope } from '../../srv/lib/authz/scope';

// Same permissions as alice in the seed data
const aliceScope: UserScope = [
  { businessPartner: '1000001', canView: true, canPay: true, canDispute: true },
  { businessPartner: '1000002', canView: true, canPay: false, canDispute: false },
];

describe('user scope (spec 3)', () => {
  describe('visiblePartners', () => {
    it('lists every business partner in the scope', () => {
      assert.deepEqual(visiblePartners(aliceScope), ['1000001', '1000002']);
    });

    it('returns an empty list for an empty scope', () => {
      assert.deepEqual(visiblePartners([]), []);
    });
  });

  describe('permissionsFor', () => {
    it('returns the permissions of a business partner in the scope', () => {
      assert.equal(permissionsFor(aliceScope, '1000001')?.canPay, true);
      assert.equal(permissionsFor(aliceScope, '1000001')?.canDispute, true);
    });

    it('keeps view-only permissions apart', () => {
      assert.equal(permissionsFor(aliceScope, '1000002')?.canPay, false);
      assert.equal(permissionsFor(aliceScope, '1000002')?.canDispute, false);
    });

    it('returns undefined for a business partner outside the scope', () => {
      assert.equal(permissionsFor(aliceScope, '1000003'), undefined);
    });
  });
});
