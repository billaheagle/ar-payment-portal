import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sign, verify } from '../../srv/lib/psp/signature';

const secret = 'whsec_test_123';
const t = '1793000000';
const body = '{"id":"evt_test_1","type":"checkout.succeeded"}';
const nowSec = Number(t);
const validHeader = `t=${t},v1=${sign(secret, t, body)}`;

describe('PSP webhook signature (spec 11.5)', () => {
  describe('sign', () => {
    it('matches the test vector', () => {
      assert.equal(
        sign(secret, t, body),
        '77f943a622ce6d38db6bd9141d4fb707d4658f0194f684e2d7e2b67f328b22fb',
      );
    });
  });

  describe('verify', () => {
    it('accepts a valid signature', () => {
      assert.equal(verify(secret, validHeader, body, nowSec), 'OK');
    });

    it('rejects a different secret', () => {
      assert.equal(verify('whsec_other', validHeader, body, nowSec), 'WEBHOOK_SIGNATURE_INVALID');
    });

    it('rejects a modified body', () => {
      assert.equal(verify(secret, validHeader, `${body} `, nowSec), 'WEBHOOK_SIGNATURE_INVALID');
    });

    it('rejects a missing or empty header', () => {
      assert.equal(verify(secret, undefined, body, nowSec), 'WEBHOOK_SIGNATURE_INVALID');
      assert.equal(verify(secret, '', body, nowSec), 'WEBHOOK_SIGNATURE_INVALID');
    });

    it('rejects a malformed header', () => {
      assert.equal(verify(secret, 'abc', body, nowSec), 'WEBHOOK_SIGNATURE_INVALID');
      assert.equal(verify(secret, `t=${t}`, body, nowSec), 'WEBHOOK_SIGNATURE_INVALID');
    });

    it('rejects a v1 that is not 64 hex characters, without crashing', () => {
      assert.equal(
        verify(secret, `t=${t},v1=abcdef1234`, body, nowSec),
        'WEBHOOK_SIGNATURE_INVALID',
      );
    });

    it('accepts a timestamp exactly 300 seconds old', () => {
      assert.equal(verify(secret, validHeader, body, nowSec + 300), 'OK');
    });

    it('rejects a timestamp 301 seconds old', () => {
      assert.equal(verify(secret, validHeader, body, nowSec + 301), 'WEBHOOK_TIMESTAMP_EXPIRED');
    });

    it('rejects a timestamp 301 seconds in the future', () => {
      assert.equal(verify(secret, validHeader, body, nowSec - 301), 'WEBHOOK_TIMESTAMP_EXPIRED');
    });
  });
});
