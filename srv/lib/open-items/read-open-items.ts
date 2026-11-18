import cds from '@sap/cds';
import type { OpenItem as OpenItemRow } from '#cds-models/CustomerService';
import type { ItemType, ItemKey, OpenItem, OpenItemQuery } from '../datasource/types';
import { dataSource } from '../datasource/factory';
import { fromCents } from '../money';
import { today } from '../clock';
import { daysOverdue } from './overdue';
import { toCdsDate } from '../dates';
import type { RequestedQuery } from './to-open-item-query';
import { toRequestedQuery } from './to-open-item-query';
import { loadScope, permissionsFor, type UserScope, visiblePartners } from '../authz/scope';
import { UnsupportedQueryError, type CqnSelect } from '../odata/query';
import { payabilityOf, type Payability } from './payability';
import { blockedKeys } from './blocked-keys';

const readOneOpenItem = async (req: cds.Request, scope: UserScope, todayIso: string) => {
  const allowed = visiblePartners(scope);
  const [raw] = req.params as unknown[];

  const keys = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const { CompanyCode, FiscalYear, AccountingDocument, LineItem } = keys;

  if (
    typeof CompanyCode !== 'string' ||
    typeof FiscalYear !== 'string' ||
    typeof AccountingDocument !== 'string' ||
    typeof LineItem !== 'string'
  )
    return req.reject(400, 'Invalid open item key');

  const key: ItemKey = {
    companyCode: CompanyCode,
    fiscalYear: FiscalYear,
    accountingDocument: AccountingDocument,
    lineItem: LineItem,
  };

  const [item] = await dataSource().getOpenItemsByKeys([key], allowed);
  if (item === undefined) return req.reject(404, 'Open item not found');
  const { disputed, reserved } = await blockedKeys([item]);

  return toOpenItemRow(
    item,
    todayIso,
    payabilityOf(item, permissionsFor(scope, item.businessPartner), disputed, reserved),
  );
};

export const readOpenItems = async (req: cds.Request) => {
  const todayIso = today();
  const scope = await loadScope(req.user.id);
  const allowed = visiblePartners(scope);

  if (req.params.length > 0) {
    return readOneOpenItem(req, scope, todayIso);
  }

  let requested: RequestedQuery;
  try {
    requested = toRequestedQuery(req.query.SELECT as CqnSelect);
  } catch (error) {
    if (error instanceof UnsupportedQueryError) {
      return req.reject({ status: 400, code: 'UNSUPPORTED_QUERY', message: error.message });
    }
    throw error;
  }

  const businessPartners = requested.businessPartners
    ? allowed.filter((bp) => requested.businessPartners?.includes(bp))
    : allowed;

  const query: OpenItemQuery = {
    ...requested,
    businessPartners,
    today: todayIso,
  };

  const { openItems, total } = await dataSource().getOpenItems(query);
  const { disputed, reserved } = await blockedKeys(openItems);

  const rows = openItems.map((item) =>
    toOpenItemRow(
      item,
      todayIso,
      payabilityOf(item, permissionsFor(scope, item.businessPartner), disputed, reserved),
    ),
  );

  return Object.assign(rows, { $count: total });
};

export const ITEM_TYPE_TEXT: Record<ItemType, string> = {
  INVOICE: 'Invoice',
  CREDIT_MEMO: 'Credit Memo',
  RESIDUAL: 'Residual Item',
};

export const toOpenItemRow = (
  item: OpenItem,
  todayIso: string,
  payability: Payability,
): OpenItemRow => {
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
    ItemTypeText: ITEM_TYPE_TEXT[item.itemType],
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

    // Payment
    IsPayable: payability.isPayable,
    NotPayableReason: payability.reason,
  };
};
