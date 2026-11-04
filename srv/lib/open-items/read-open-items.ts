import { S4_OperationalAcctgDocItems, S4_BusinessPartners } from '#cds-models/arportal/mock';
import type { S4_OperationalAcctgDocItem } from '#cds-models/arportal/mock';
import { ItemType } from '#cds-models/arportal';
import type { OpenItem } from '#cds-models/CustomerService';
import { daysOverdue } from './overdue';
import { today } from '../clock';

export const readOpenItems = async () => {
  const docItems = await SELECT.from(S4_OperationalAcctgDocItems).where({
    ClearingAccountingDocument: null,
  });

  const partners = await SELECT.from(S4_BusinessPartners);

  // TODO 1: kamus BusinessPartner → nama (Object.fromEntries + map)
  const bpNames: Record<string, string | null> = Object.fromEntries(
    partners.map((p) => [String(p.BusinessPartner), p.BusinessPartnerFullName ?? null]),
  );

  // TODO 2: petakan docItems ke bentuk OpenItems (tabel di pesan sebelumnya)
  const todayIso = today();
  const rows: OpenItem[] = docItems.map((row) => toOpenItem(row, bpNames, todayIso));

  // TODO 3: return Object.assign(rows, { $count: rows.length })
  return Object.assign(rows, { $count: rows.length });
};

const itemTypeOf = (row: S4_OperationalAcctgDocItem): ItemType => {
  if (row.AccountingDocumentType === 'DZ' && row.InvoiceReference) return ItemType.RESIDUAL;
  if ((row.AmountInTransactionCurrency ?? 0) < 0) return ItemType.CREDIT_MEMO;
  return ItemType.INVOICE;
};

export const toOpenItem = (
  row: S4_OperationalAcctgDocItem,
  bpNames: Record<string, string | null>,
  todayIso: string,
): OpenItem => {
  if (!row.NetDueDate) {
    throw new Error(`Open item without net due date: ${String(row.AccountingDocument)}`);
  }
  const overdue = daysOverdue(row.NetDueDate, todayIso);

  return {
    // Key
    CompanyCode: row.CompanyCode,
    FiscalYear: row.FiscalYear,
    AccountingDocument: row.AccountingDocument,
    LineItem: row.AccountingDocumentItem,

    // BP
    BusinessPartner: row.Customer,
    BusinessPartnerName: row.Customer ? (bpNames[row.Customer] ?? null) : null,

    // Document
    ItemType: itemTypeOf(row),
    BillingDocument: row.BillingDocument,
    Reference: row.DocumentReferenceID,
    InvoiceReference: row.InvoiceReference,
    PostingDate: row.PostingDate,
    DocumentDate: row.DocumentDate,
    NetDueDate: row.NetDueDate,

    // Amount
    Amount: row.AmountInTransactionCurrency,
    Currency: row.TransactionCurrency,

    // Overdue
    DaysOverdue: overdue,
    IsOverdue: overdue > 0,
    DaysOverdueCriticality: overdue > 0 ? 1 : 0,

    // Later
    IsPayable: null,
    NotPayableReason: null,
  };
};
