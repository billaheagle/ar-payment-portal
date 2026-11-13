import type { S4_OperationalAcctgDocItem, S4_BusinessPartner } from '#cds-models/arportal/mock';
import type { ItemType, OpenItem, BusinessPartner } from '../types';
import { toCents } from '../../money';

const itemTypeOf = (row: S4_OperationalAcctgDocItem): ItemType => {
  if (row.AccountingDocumentType === 'DZ' && row.InvoiceReference) return 'RESIDUAL';
  if ((row.AmountInTransactionCurrency ?? 0) < 0) return 'CREDIT_MEMO';
  return 'INVOICE';
};

export const s4RowToOpenItem = (
  row: S4_OperationalAcctgDocItem,
  bpNames: Record<string, string | null>,
): OpenItem => {
  if (!row.NetDueDate) {
    throw new Error(`Open item without net due date: ${String(row.AccountingDocument)}`);
  }

  return {
    companyCode: row.CompanyCode ?? '',
    fiscalYear: row.FiscalYear ?? '',
    accountingDocument: row.AccountingDocument ?? '',
    lineItem: row.AccountingDocumentItem ?? '',

    businessPartner: row.Customer ?? '',
    businessPartnerName: row.Customer ? (bpNames[row.Customer] ?? null) : null,
    itemType: itemTypeOf(row),
    billingDocument: row.BillingDocument ?? null,
    reference: row.DocumentReferenceID ?? null,
    invoiceReference: row.InvoiceReference ?? null,
    postingDate: String(row.PostingDate),
    documentDate: String(row.DocumentDate),
    netDueDate: row.NetDueDate,
    amountCents: toCents(String(row.AmountInTransactionCurrency)),
    currency: row.TransactionCurrency ?? '',
  };
};

export const s4RowToBusinessPartner = (row: S4_BusinessPartner): BusinessPartner => {
  if (!row.BusinessPartner) {
    throw new Error('Business partner without key in mock S/4 data');
  }

  return {
    businessPartner: row.BusinessPartner,
    name: row.BusinessPartnerFullName ?? null,
    country: row.Country ?? null,
  };
};
