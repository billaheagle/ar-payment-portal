import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isoToUtcMillis, daysBetween, addDays } from '../../srv/lib/dates';

describe('dates', () => {
  describe('isoToUtcMillis', () => {
    it('returns UTC midnight in milliseconds', () => {
      assert.equal(isoToUtcMillis('2026-10-01'), Date.UTC(2026, 9, 1));
    });

    it('throws on a non-ISO date', () => {
      assert.throws(() => isoToUtcMillis('2026/10/01'));
      assert.throws(() => isoToUtcMillis('20261001'));
    });
  });

  describe('daysBetween', () => {
    it('counts days forward', () => {
      assert.equal(daysBetween('2026-10-01', '2026-11-01'), 31);
    });

    it('is negative when "to" is before "from"', () => {
      assert.equal(daysBetween('2026-11-01', '2026-10-01'), -31);
    });

    it('is zero for the same date', () => {
      assert.equal(daysBetween('2026-11-01', '2026-11-01'), 0);
    });

    it('is not affected by daylight saving time', () => {
      assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
    });
  });

  describe('addDays', () => {
    it('adds days within the same year', () => {
      assert.equal(addDays('2026-10-05', 30), '2026-11-04');
    });

    it('rolls over to the next year', () => {
      assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    });

    it('handles a leap year', () => {
      assert.equal(addDays('2028-02-28', 1), '2028-02-29');
    });

    it('is not affected by daylight saving time', () => {
      assert.equal(addDays('2026-03-28', 2), '2026-03-30');
    });

    it('supports negative days', () => {
      assert.equal(addDays('2026-11-04', -30), '2026-10-05');
    });

    it('throws on fractional days', () => {
      assert.throws(() => addDays('2026-03-28', 1.5));
    });

    it('throws on a non-ISO date', () => {
      assert.throws(() => addDays('2026/03/28', 1));
    });
  });
});
