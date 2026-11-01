import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nextAttemptAt } from '../../srv/lib/jobs/backoff';

const now = new Date('2026-12-08T09:00:00Z');

describe('nextAttemptAt (BR-26)', () => {
  it('waits 10 seconds after the first failure', () => {
    assert.equal(nextAttemptAt(1, now)?.getTime(), now.getTime() + 10_000);
  });

  it('waits 30 seconds after the second failure', () => {
    assert.equal(nextAttemptAt(2, now)?.getTime(), now.getTime() + 30_000);
  });

  it('waits 2 minutes after the third failure', () => {
    assert.equal(nextAttemptAt(3, now)?.getTime(), now.getTime() + 120_000);
  });

  it('waits 10 minutes after the fourth failure', () => {
    assert.equal(nextAttemptAt(4, now)?.getTime(), now.getTime() + 600_000);
  });

  it('waits 30 minutes after the fifth failure', () => {
    assert.equal(nextAttemptAt(5, now)?.getTime(), now.getTime() + 1_800_000);
  });

  it('returns null after the sixth failure (retries exhausted)', () => {
    assert.equal(nextAttemptAt(6, now), null);
  });

  it('keeps returning null beyond the sixth failure', () => {
    assert.equal(nextAttemptAt(7, now), null);
    assert.equal(nextAttemptAt(100, now), null);
  });

  it('throws on zero, negative or fractional attempts', () => {
    assert.throws(() => nextAttemptAt(0, now));
    assert.throws(() => nextAttemptAt(-1, now));
    assert.throws(() => nextAttemptAt(1.5, now));
  });

  it('throws on an invalid date', () => {
    assert.throws(() => nextAttemptAt(1, new Date('Invalid Date')));
  });

  it('does not change the date passed in', () => {
    const input = new Date(now.getTime());
    nextAttemptAt(1, input);
    assert.equal(input.getTime(), now.getTime());
  });
});
