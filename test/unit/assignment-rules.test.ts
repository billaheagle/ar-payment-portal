import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkAssignment, normalizeUserId } from '../../srv/lib/authz/assignment-rules';
import type { AssignmentInput } from '../../srv/lib/authz/assignment-rules';
import { AppError } from '../../srv/lib/errors';

const valid = (overrides: Partial<AssignmentInput> = {}): AssignmentInput => ({
  UserId: 'alice@acme.test',
  BusinessPartner: '1000003',
  CanView: true,
  CanPay: false,
  CanDispute: false,
  ...overrides,
});

describe('assignment rules (BR-01, BR-02)', () => {
  it('normalises the user ID (BR-01)', () => {
    assert.equal(normalizeUserId(' Alice@ACME.test '), 'alice@acme.test');
  });

  it('accepts a valid assignment', () => {
    assert.doesNotThrow(() => {
      checkAssignment(valid());
    });
  });

  it('rejects an empty user ID', () => {
    assert.throws(
      () => {
        checkAssignment(valid({ UserId: '   ' }));
      },
      (err) => err instanceof AppError && err.target === 'UserId',
    );
    assert.throws(
      () => {
        checkAssignment(valid({ UserId: null }));
      },
      (err) => err instanceof AppError && err.target === 'UserId',
    );
    assert.throws(
      () => {
        checkAssignment(valid({ UserId: undefined }));
      },
      (err) => err instanceof AppError && err.target === 'UserId',
    );
  });

  it('rejects business partners that are not 1–10 digits without leading zero (BR-01)', () => {
    const invalidPartners = ['01000003', '0', '12345678901', '10A', ''];
    invalidPartners.forEach((invalidPartner) => {
      assert.throws(
        () => {
          checkAssignment(valid({ BusinessPartner: invalidPartner }));
        },
        (err) => err instanceof AppError && err.target === 'BusinessPartner',
      );
    });
  });

  it('requires CanView when CanPay or CanDispute is set (BR-02)', () => {
    assert.throws(
      () => {
        checkAssignment(valid({ CanPay: true, CanView: false }));
      },
      (err) => err instanceof AppError && err.target === 'CanView',
    );
    assert.throws(
      () => {
        checkAssignment(valid({ CanPay: true, CanView: null }));
      },
      (err) => err instanceof AppError && err.target === 'CanView',
    );
    assert.throws(
      () => {
        checkAssignment(valid({ CanPay: true, CanView: undefined }));
      },
      (err) => err instanceof AppError && err.target === 'CanView',
    );

    assert.throws(
      () => {
        checkAssignment(valid({ CanDispute: true, CanView: false }));
      },
      (err) => err instanceof AppError && err.target === 'CanView',
    );
  });
});
