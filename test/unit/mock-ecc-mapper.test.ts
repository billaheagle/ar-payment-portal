import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  alphaOut,
  alphaIn,
  datsToIso,
  addDays,
  signedCents,
} from '../../srv/lib/datasource/mock-ecc/mock-ecc-mapper';

describe('mock ECC mapper (spec 10.3)', () => {
  describe('alphaOut', () => {
    it('removes leading zeros from a numeric value', () => {
      assert.equal(alphaOut('0001000001'), '1000001');
    });

    it('keeps a single zero when the value is all zeros', () => {
      assert.equal(alphaOut('0000000000'), '0');
    });

    it('returns an empty string unchanged', () => {
      assert.equal(alphaOut(''), '');
    });

    it('returns non-numeric values unchanged', () => {
      assert.equal(alphaOut('00ABC'), '00ABC');
      assert.equal(alphaOut('0x1A'), '0x1A');
      assert.equal(alphaOut('0012.5'), '0012.5');
    });

    it('keeps every digit of a long value (no Number precision loss)', () => {
      assert.equal(alphaOut('000000000000123456789012345678'), '123456789012345678');
    });
  });

  describe('alphaIn', () => {
    it('pads a numeric value to 10 characters by default', () => {
      assert.equal(alphaIn('1000001'), '0001000001');
    });

    it('pads to a custom length', () => {
      assert.equal(alphaIn('123', 18), '000000000000000123');
    });

    it('keeps a value that already has the full length', () => {
      assert.equal(alphaIn('0001000001'), '0001000001');
    });

    it('returns non-numeric values unchanged', () => {
      assert.equal(alphaIn('ABC123'), 'ABC123');
      assert.equal(alphaIn('1e3'), '1e3');
      assert.equal(alphaIn('12.5'), '12.5');
    });

    it('throws when a numeric value is longer than the length', () => {
      assert.throws(() => alphaIn('12345678901'));
    });
  });

  describe('datsToIso', () => {
    it('converts YYYYMMDD to YYYY-MM-DD', () => {
      assert.equal(datsToIso('20261001'), '2026-10-01');
    });

    it('throws on an invalid DATS value', () => {
      assert.throws(() => datsToIso('2026101'));
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

  describe('signedCents', () => {
    it('returns negative cents for credit indicator H', () => {
      assert.equal(signedCents('150.00', 'H'), -15000);
    });

    it('returns positive cents for debit indicator S', () => {
      assert.equal(signedCents('1200.00', 'S'), 120000);
    });

    it('returns 0, not -0, for a zero amount with H', () => {
      assert.equal(signedCents('0.00', 'H'), 0);
    });
  });
});
