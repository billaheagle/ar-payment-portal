import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { now, setClock, resetClock, today } from '../../srv/lib/clock';

describe('clock (BR-32)', () => {
  afterEach(() => {
    resetClock();
  });

  it('uses the real time by default', () => {
    const diff = Math.abs(now().getTime() - Date.now());
    assert.ok(diff < 50);
  });

  it('today() follows setClock', () => {
    const fixed = new Date('2026-11-01T16:30:00Z');
    setClock(() => fixed);
    assert.equal(today(), '2026-11-01');
  });

  it('today() is in UTC, not local time', () => {
    const fixed = new Date('2026-10-31T19:00:00Z');
    setClock(() => fixed);
    assert.equal(today(), '2026-10-31');
  });

  it('a fixed clock returns the same instant every call', () => {
    const fixed = new Date('2026-11-01T16:30:00Z');
    setClock(() => fixed);

    assert.equal(now().getTime(), fixed.getTime());
    assert.equal(now().getTime(), fixed.getTime());
  });

  it('resetClock() returns to the real time', () => {
    const fixed = new Date('2026-10-31T19:00:00Z');
    setClock(() => fixed);
    assert.equal(now().getTime(), fixed.getTime());

    resetClock();
    const diff = Math.abs(now().getTime() - Date.now());
    assert.ok(diff < 50);
  });
});
