import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { daysOverdue, isOverdue } from '../../srv/lib/open-items/overdue';

describe('overdue (spec 5.10)', () => {
  describe('daysOverdue', () => {
    it('counts days past the net due date', () => {
      assert.equal(daysOverdue('2026-10-01', '2026-11-01'), 31);
    });

    it('is 1 the day after the due date', () => {
      assert.equal(daysOverdue('2026-10-31', '2026-11-01'), 1);
    });

    it('is 0 on the due date itself', () => {
      assert.equal(daysOverdue('2026-11-01', '2026-11-01'), 0);
    });

    it('is 0, not negative, before the due date', () => {
      assert.equal(daysOverdue('2026-11-04', '2026-11-01'), 0);
    });

    it('works across a year boundary', () => {
      assert.equal(daysOverdue('2025-12-31', '2026-01-01'), 1);
    });

    it('counts 29 February in a leap year', () => {
      assert.equal(daysOverdue('2028-02-28', '2028-03-01'), 2);
    });
  });

  describe('isOverdue', () => {
    it('is true when past the due date', () => {
      assert.equal(isOverdue('2026-10-01', '2026-11-01'), true);
    });

    it('is false on the due date', () => {
      assert.equal(isOverdue('2026-11-01', '2026-11-01'), false);
    });

    it('is false before the due date', () => {
      assert.equal(isOverdue('2026-11-04', '2026-11-01'), false);
    });
  });
});
