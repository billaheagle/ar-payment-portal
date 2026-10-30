import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toCents, fromCents } from '../../srv/lib/money';

describe('money (BR-31)', () => {
    it('toCents converts valid amounts', () => {
        assert.equal(toCents('850.50'), 85050);
        assert.equal(toCents('1.15'), 115);
        assert.equal(toCents('0.5'), 50);
        assert.equal(toCents(500), 50000);
        assert.equal(toCents('-150.00'), -15000);
    });

    it('toCents rejects invalid amounts', () => {
        assert.throws(() => toCents('10.005'));
        assert.throws(() => toCents('abc'));
    });

    it('fromCents formats with two decimals', () => {
        assert.equal(fromCents(85050), '850.50');
        assert.equal(fromCents(50), '0.50');
        assert.throws(() => fromCents(850.5));
        // 120000, -15000
    });

    it('round-trips', () => {
        assert.equal(fromCents(toCents('999.99')), '999.99');
    });
});