import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  alphaOut,
  alphaIn,
  datsToIso,
  signedCents,
  eccRowToOpenItem,
  eccRowToBusinessPartner,
} from '../../srv/lib/datasource/mock-ecc/mock-ecc-mapper';
import type { Ecc_BSID } from '#cds-models/arportal/mock';

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

const baseRow = (overrides: Partial<Ecc_BSID> = {}): Ecc_BSID => ({
  BUKRS: '1010',
  GJAHR: '2026',
  BELNR: '1800000001',
  BUZEI: '001',
  KUNNR: '0001000001',
  BLART: 'RV',
  VBELN: '90000001',
  XBLNR: 'INV-2026-0001',
  REBZG: null,
  BUDAT: '20260901',
  BLDAT: '20260901',
  ZFBDT: '20260901',
  ZBD1T: 30,
  WRBTR: 1200,
  SHKZG: 'S',
  WAERS: 'EUR',
  AUGBL: null,
  AUGDT: null,
  ...overrides,
});

const bpNames = { '1000001': 'ACME GmbH' };

describe('eccRowToOpenItem (spec 10.3)', () => {
  it('maps ECC columns to the unified open item', () => {
    const item = eccRowToOpenItem(baseRow(), bpNames);
    assert.equal(item.companyCode, '1010');
    assert.equal(item.lineItem, '001');
    assert.equal(item.businessPartner, '1000001'); // alphaOut
    assert.equal(item.businessPartnerName, 'ACME GmbH');
    assert.equal(item.reference, 'INV-2026-0001');
    assert.equal(item.postingDate, '2026-09-01'); // datsToIso
    assert.equal(item.currency, 'EUR');
  });

  it('computes the net due date from baseline date plus net days', () => {
    const item = eccRowToOpenItem(baseRow(), bpNames);
    assert.equal(item.netDueDate, '2026-10-01');
  });

  it('computes a net due date across the year boundary', () => {
    const item = eccRowToOpenItem(
      baseRow({
        ZFBDT: '20261215',
      }),
      bpNames,
    );
    assert.equal(item.netDueDate, '2027-01-14');
  });

  it('treats missing net days as zero', () => {
    const item = eccRowToOpenItem(
      baseRow({
        ZBD1T: null,
      }),
      bpNames,
    );
    assert.equal(item.netDueDate, datsToIso(String(baseRow().ZFBDT)));
  });

  it('turns a debit into a positive amount in cents', () => {
    const item = eccRowToOpenItem(baseRow(), bpNames);
    assert.equal(item.itemType, 'INVOICE');
    assert.equal(item.amountCents, 120000);
  });

  it('turns a credit into a negative credit memo', () => {
    const item = eccRowToOpenItem(
      baseRow({
        SHKZG: 'H',
        WRBTR: 150,
        ZBD1T: 0,
      }),
      bpNames,
    );
    assert.equal(item.itemType, 'CREDIT_MEMO');
    assert.equal(item.amountCents, -15000);
  });

  it('classifies a DZ document with an invoice reference as residual', () => {
    // TODO: BLART 'DZ', REBZG '1800000002' → itemType 'RESIDUAL'
    const item = eccRowToOpenItem(
      baseRow({
        BLART: 'DZ',
        REBZG: '1800000002',
      }),
      bpNames,
    );
    assert.equal(item.itemType, 'RESIDUAL');
  });

  it('throws on an unknown debit/credit indicator', () => {
    assert.throws(
      () => eccRowToOpenItem(baseRow({ SHKZG: 'X' }), bpNames),
      /debit\/credit indicator/,
    );
  });

  it('throws when the baseline date is missing', () => {
    assert.throws(() => eccRowToOpenItem(baseRow({ ZFBDT: null }), bpNames), /baseline date/);
  });
});

describe('eccRowToBusinessPartner (spec 10.3)', () => {
  it('removes the leading zeros from the customer number', () => {
    const bp = eccRowToBusinessPartner({ KUNNR: '0001000001', NAME1: 'ACME GmbH', LAND1: 'DE' });
    assert.deepEqual(bp, { businessPartner: '1000001', name: 'ACME GmbH', country: 'DE' });
  });

  it('throws when the key is missing', () => {
    assert.throws(() => eccRowToBusinessPartner({}), /without key/);
  });
});
