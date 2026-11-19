import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppError, ERROR_STATUS } from '../../srv/lib/errors';

const messageKeys = (): string[] =>
  readFileSync(join(__dirname, '../../_i18n/messages.properties'), 'utf8')
    .split('\n')
    .filter((v) => v.trim() !== '' && !v.startsWith('#'))
    .map((v) => (v.split('=')[0] ?? '').trim())
    .sort();

describe('error catalog (spec 14.1)', () => {
  it('has a message for every code and no message without a code', () => {
    assert.deepEqual(messageKeys(), Object.keys(ERROR_STATUS).sort());
  });

  it('keeps code, args and target on AppError', () => {
    const err = new AppError('ITEM_DUPLICATE', ['1010', '1800000001'], 'items/1');
    assert.equal(err.code, 'ITEM_DUPLICATE');
    assert.deepEqual(err.args, ['1010', '1800000001']);
    assert.equal(err.target, 'items/1');
    assert.ok(err instanceof Error);
  });
});
