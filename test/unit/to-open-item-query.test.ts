import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  toRequestedQuery,
  UnsupportedQueryError,
  type CqnSelect,
} from '../../srv/lib/open-items/to-open-item-query';

// CAP appends the entity key as implicit sort entries; copied from the logged CQN
const IMPLICIT_ORDER: NonNullable<CqnSelect['orderBy']> = [
  { ref: ['CompanyCode'], sort: 'asc', implicit: true },
  { ref: ['FiscalYear'], sort: 'asc', implicit: true },
  { ref: ['AccountingDocument'], sort: 'asc', implicit: true },
  { ref: ['LineItem'], sort: 'asc', implicit: true },
];

describe('toRequestedQuery (spec 9.3)', () => {
  describe('defaults', () => {
    it('uses the default page and sort order when nothing is requested', () => {
      const q = toRequestedQuery({});
      assert.equal(q.top, 30);
      assert.equal(q.skip, 0);
      assert.deepEqual(q.orderBy, [{ field: 'NetDueDate', direction: 'asc' }]);
    });
  });

  describe('$search', () => {
    it('rejects $search', () => {
      assert.throws(() => toRequestedQuery({ search: [{ val: 'INV' }] }), UnsupportedQueryError);
    });
  });

  describe('$top and $skip', () => {
    it('reads rows and offset', () => {
      const q = toRequestedQuery({ limit: { rows: { val: 3 }, offset: { val: 3 } } });
      assert.equal(q.top, 3);
      assert.equal(q.skip, 3);
    });

    it('treats a missing offset as zero', () => {
      const q = toRequestedQuery({ limit: { rows: { val: 30 } } });
      assert.equal(q.skip, 0);
    });

    it('rejects a negative $top', () => {
      assert.throws(
        () => toRequestedQuery({ limit: { rows: { val: -1 } } }),
        UnsupportedQueryError,
      );
    });

    it('rejects a fractional $top', () => {
      assert.throws(
        () => toRequestedQuery({ limit: { rows: { val: 2.5 } } }),
        UnsupportedQueryError,
      );
    });

    it('rejects a $top given as text', () => {
      assert.throws(
        () => toRequestedQuery({ limit: { rows: { val: '3' } } }),
        UnsupportedQueryError,
      );
    });

    it('rejects an invalid $skip', () => {
      assert.throws(
        () => toRequestedQuery({ limit: { rows: { val: 3 }, offset: { val: -3 } } }),
        /\$skip/,
      );
    });
  });

  describe('$orderby', () => {
    it('ignores the implicit key order added by CAP', () => {
      const q = toRequestedQuery({ orderBy: IMPLICIT_ORDER });
      assert.deepEqual(q.orderBy, [{ field: 'NetDueDate', direction: 'asc' }]);
    });

    it('reads the requested fields and directions (logged URL 6)', () => {
      const q = toRequestedQuery({
        orderBy: [{ ref: ['Amount'], sort: 'desc' }, { ref: ['NetDueDate'] }, ...IMPLICIT_ORDER],
      });
      assert.deepEqual(q.orderBy, [
        { field: 'Amount', direction: 'desc' },
        { field: 'NetDueDate', direction: 'asc' },
      ]);
    });

    it('rejects a field that cannot be sorted', () => {
      assert.throws(() => toRequestedQuery({ orderBy: [{ ref: ['Reference'] }] }), /Sorting by/);
    });

    it('rejects a path instead of a single field', () => {
      assert.throws(
        () => toRequestedQuery({ orderBy: [{ ref: ['to_BP', 'Name'] }] }),
        UnsupportedQueryError,
      );
    });

    it('rejects an unknown sort direction', () => {
      assert.throws(
        () => toRequestedQuery({ orderBy: [{ ref: ['Amount'], sort: 'sideways' }] }),
        /sort direction/,
      );
    });
  });

  describe('$filter', () => {
    // CQN copied from the logged requests
    const companyCode1710 = [{ ref: ['CompanyCode'] }, '=', { val: '1710' }];
    const companyCode1010AndOverdue = [
      { ref: ['CompanyCode'] },
      '=',
      { val: '1010' },
      'and',
      { ref: ['IsOverdue'] },
      '=',
      { val: true },
    ];
    const twoBusinessPartners = {
      xpr: [
        { ref: ['BusinessPartner'] },
        '=',
        { val: '1000001' },
        'or',
        { ref: ['BusinessPartner'] },
        '=',
        { val: '1000002' },
      ],
    };

    it('returns no filters without a where clause', () => {
      const query = toRequestedQuery({});
      assert.equal(query.companyCode, undefined);
      assert.equal(query.itemType, undefined);
      assert.equal(query.currency, undefined);
      assert.equal(query.overdue, undefined);
      assert.equal(query.businessPartners, undefined);
    });

    it('reads a single condition (URL 2)', () => {
      const query = toRequestedQuery({
        where: companyCode1710,
      });

      assert.equal(query.companyCode, '1710');
    });

    it('reads conditions joined with and (URL 3)', () => {
      const query = toRequestedQuery({
        where: companyCode1010AndOverdue,
      });

      assert.equal(query.companyCode, '1010');
      assert.equal(query.overdue, true);
    });

    it('reads business partners joined with or (URL 4)', () => {
      const query = toRequestedQuery({
        where: [twoBusinessPartners],
      });

      assert.deepEqual(query.businessPartners, ['1000001', '1000002']);
    });

    it('reads a condition and an or-group together (URL 5)', () => {
      const query = toRequestedQuery({
        where: [...companyCode1710, 'and', twoBusinessPartners],
      });
      assert.equal(query.companyCode, '1710');
      assert.deepEqual(query.businessPartners, ['1000001', '1000002']);
    });

    it('reads an or-group without parentheses', () => {
      const query = toRequestedQuery({
        where: twoBusinessPartners.xpr,
      });
      assert.deepEqual(query.businessPartners, ['1000001', '1000002']);
    });

    it('reads a valid item type', () => {
      const query = toRequestedQuery({
        where: [{ ref: ['ItemType'] }, '=', { val: 'CREDIT_MEMO' }],
      });
      assert.equal(query.itemType, 'CREDIT_MEMO');
    });

    it('rejects an unknown item type', () => {
      assert.throws(() =>
        toRequestedQuery({
          where: [{ ref: ['ItemType'] }, '=', { val: 'BANANA' }],
        }),
      );
    });

    it('rejects a field that cannot be filtered', () => {
      assert.throws(() =>
        toRequestedQuery({
          where: [{ ref: ['Reference'] }, '=', { val: '' }],
        }),
      );
    });

    it('rejects an operator other than =', () => {
      assert.throws(() =>
        toRequestedQuery({
          where: [{ ref: ['CompanyCode'] }, '!=', { val: '1710' }],
        }),
      );
    });

    it('rejects a function such as startswith', () => {
      assert.throws(() =>
        toRequestedQuery({
          where: [{ func: 'startswith', args: [{ ref: ['CompanyCode'] }, { val: '123' }] }],
        }),
      );
    });

    it('rejects an or-group that mixes fields', () => {
      assert.throws(() =>
        toRequestedQuery({
          where: [
            { ref: ['BusinessPartner'] },
            '=',
            { val: '1000001' },
            'or',
            { ref: ['CompanyCode'] },
            '=',
            { val: '1000002' },
          ],
        }),
      );
    });

    it('rejects IsOverdue given as text', () => {
      assert.throws(() =>
        toRequestedQuery({
          where: [{ ref: ['IsOverdue'] }, '=', { val: 'true' }],
        }),
      );
    });

    it('rejects the same field twice', () => {
      assert.throws(() =>
        toRequestedQuery({
          where: [
            { ref: ['CompanyCode'] },
            '=',
            { val: '1010' },
            'and',
            { ref: ['CompanyCode'] },
            '=',
            { val: '1710' },
          ],
        }),
      );
    });
  });
});
