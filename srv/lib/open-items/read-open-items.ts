import cds from '@sap/cds';
import { UserAssignments } from '#cds-models/arportal';
import type { OpenItem as OpenItemRow } from '#cds-models/CustomerService';
import type { OpenItem, OpenItemQuery } from '../datasource/types';
import { dataSource } from '../datasource/factory';
import { fromCents } from '../money';
import { today } from '../clock';
import { daysOverdue } from './overdue';
import { toCdsDate } from '../dates';
import type { CqnSelect, RequestedQuery } from './to-open-item-query';
import { toRequestedQuery, UnsupportedQueryError } from './to-open-item-query';

const { SELECT } = cds.ql;

const activeBusinessPartners = async (): Promise<string[]> => {
  const rows = await SELECT.distinct
    .from(UserAssignments)
    .columns('BusinessPartner')
    .where({ IsActive: true });

  return rows.map((r) => String(r.BusinessPartner));
};

export const readOpenItems = async (req: cds.Request) => {
  let requested: RequestedQuery;
  try {
    requested = toRequestedQuery(req.query.SELECT as CqnSelect);
  } catch (error) {
    if (error instanceof UnsupportedQueryError) {
      return req.reject({ status: 400, code: 'UNSUPPORTED_QUERY', message: error.message });
    }
    throw error;
  }

  const allowed = await activeBusinessPartners();
  const businessPartners = requested.businessPartners
    ? allowed.filter((bp) => requested.businessPartners?.includes(bp))
    : allowed;

  const todayIso = today();

  const query: OpenItemQuery = {
    ...requested,
    businessPartners,
    today: todayIso,
  };

  const { openItems, total } = await dataSource().getOpenItems(query);
  const rows = openItems.map((item) => toOpenItemRow(item, todayIso));

  return Object.assign(rows, { $count: total });
};

export const toOpenItemRow = (item: OpenItem, todayIso: string): OpenItemRow => {
  const overdue = daysOverdue(item.netDueDate, todayIso);

  return {
    // Key
    CompanyCode: item.companyCode,
    FiscalYear: item.fiscalYear,
    AccountingDocument: item.accountingDocument,
    LineItem: item.lineItem,

    // BP
    BusinessPartner: item.businessPartner,
    BusinessPartnerName: item.businessPartnerName,

    // Document
    ItemType: item.itemType,
    BillingDocument: item.billingDocument,
    Reference: item.reference,
    InvoiceReference: item.invoiceReference,

    // Date
    PostingDate: toCdsDate(item.postingDate),
    DocumentDate: toCdsDate(item.documentDate),
    NetDueDate: toCdsDate(item.netDueDate),

    // Amount
    Amount: Number(fromCents(item.amountCents)),
    Currency: item.currency,

    // Portal
    DaysOverdue: overdue,
    IsOverdue: overdue > 0,
    DaysOverdueCriticality: overdue > 0 ? 1 : 0,

    // Later
    IsPayable: null,
    NotPayableReason: null,
  };
};
