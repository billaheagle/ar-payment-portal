import type { Ecc_BSID, Ecc_KNA1 } from '#cds-models/arportal/mock';
import { addDays } from '../../dates';
import { toCents } from '../../money';
import type { BusinessPartner, ItemType, OpenItem } from '../types';

const DIGITS_RE = /^\d+$/;
const DATS_RE = /^(\d{4})(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])$/;

export const alphaOut = (value: string): string => {
  const s = value.trim();
  if (!DIGITS_RE.test(s)) return s;

  return s.replace(/^0+/, '') || '0';
};

export const alphaIn = (value: string, length: number = 10): string => {
  const s = value.trim();
  if (!DIGITS_RE.test(s)) return s;
  if (s.length > length)
    throw new Error(`ALPHA input "${value}" exceeds ${String(length)} characters`);

  return s.padStart(length, '0');
};

export const datsToIso = (value: string): string => {
  const m = DATS_RE.exec(value.trim());
  if (m === null) throw new Error(`Invalid DATS date: ${value}`);
  const [, year = '', month = '', day = ''] = m;
  return `${year}-${month}-${day}`;
};

export const signedCents = (value: number | string, indicator: 'S' | 'H'): number => {
  const cents: number = toCents(value);
  return indicator === 'H' && cents !== 0 ? -cents : cents;
};

const itemTypeOf = (row: Ecc_BSID): ItemType => {
  if (row.BLART === 'DZ' && row.REBZG) return 'RESIDUAL';
  if ((row.SHKZG ?? '') === 'H') return 'CREDIT_MEMO';
  return 'INVOICE';
};

export const eccRowToOpenItem = (
  row: Ecc_BSID,
  bpNames: Record<string, string | null>,
): OpenItem => {
  if (!row.ZFBDT) {
    throw new Error(`ECC item without baseline date: ${String(row.BELNR)}`);
  }

  const indicator = row.SHKZG;
  if (indicator !== 'S' && indicator !== 'H') {
    throw new Error(
      `Invalid debit/credit indicator '${String(indicator)}' on ECC item ${String(row.BELNR)}`,
    );
  }

  if (!row.BUKRS) throw new Error(`Invalid Key Company Code (BUKRS) cannot be null`);
  if (!row.GJAHR) throw new Error(`Invalid KEY Fiscal Year (GJAHR) cannot be null`);
  if (!row.BELNR) throw new Error(`Invalid KEY Accounting Document (BELNR) cannot be null`);
  if (!row.BUZEI) throw new Error(`Invalid KEY Line Item (BUZEI) cannot be null`);

  return {
    companyCode: row.BUKRS,
    fiscalYear: row.GJAHR,
    accountingDocument: row.BELNR,
    lineItem: row.BUZEI,

    businessPartner: alphaOut(row.KUNNR ?? ''),
    businessPartnerName: row.KUNNR ? (bpNames[alphaOut(row.KUNNR)] ?? null) : null,
    itemType: itemTypeOf(row),
    billingDocument: row.VBELN ?? null,
    reference: row.XBLNR ?? null,
    invoiceReference: row.REBZG ?? null,
    postingDate: datsToIso(String(row.BUDAT)),
    documentDate: datsToIso(String(row.BLDAT)),
    netDueDate: addDays(datsToIso(row.ZFBDT), row.ZBD1T ?? 0),
    amountCents: signedCents(row.WRBTR ?? 0, indicator),
    currency: row.WAERS ?? '',
  };
};

export const eccRowToBusinessPartner = (row: Ecc_KNA1): BusinessPartner => {
  if (!row.KUNNR) {
    throw new Error('Customer without key in mock S/4 data');
  }

  return {
    businessPartner: alphaOut(row.KUNNR),
    name: row.NAME1 ?? null,
    country: row.LAND1 ?? null,
  };
};
