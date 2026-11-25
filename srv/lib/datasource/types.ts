export const ITEM_TYPES = ['INVOICE', 'CREDIT_MEMO', 'RESIDUAL'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ORDER_BY_FIELDS = [
  'NetDueDate',
  'PostingDate',
  'Amount',
  'AccountingDocument',
] as const;
export type OrderByField = (typeof ORDER_BY_FIELDS)[number];

export const ORDER_BY_DIRECTIONS = ['asc', 'desc'] as const;
export type OrderByDirection = (typeof ORDER_BY_DIRECTIONS)[number];

export const NOT_PAYABLE_REASONS = ['IN_DISPUTE', 'PAYMENT_PENDING', 'NO_PAY_PERMISSION'] as const;
export type NotPayableReason = (typeof NOT_PAYABLE_REASONS)[number];

export interface ItemKey {
  companyCode: string;
  fiscalYear: string;
  accountingDocument: string;
  lineItem: string;
}

export interface OpenItem extends ItemKey {
  businessPartner: string;
  businessPartnerName: string | null;
  itemType: ItemType;
  billingDocument: string | null;
  reference: string | null;
  invoiceReference: string | null;
  postingDate: string;
  documentDate: string;
  netDueDate: string;
  amountCents: number;
  currency: string;
}

export interface BusinessPartner {
  businessPartner: string;
  name: string | null;
  country: string | null;
}

export interface OrderBy {
  field: OrderByField;
  direction: OrderByDirection;
}

export interface OpenItemQuery {
  businessPartners: string[];
  companyCode?: string;
  itemType?: ItemType;
  currency?: string;
  overdue?: boolean;
  today: string;
  orderBy: OrderBy[];
  top: number;
  skip: number;
}
