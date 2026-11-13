export const ITEM_TYPE = ['INVOICE', 'CREDIT_MEMO', 'RESIDUAL'] as const;
export type ItemType = (typeof ITEM_TYPE)[number];

export const ORDER_BY_FIELDS = [
  'NetDueDate',
  'PostingDate',
  'Amount',
  'AccountingDocument',
] as const;
export type OrderByField = (typeof ORDER_BY_FIELDS)[number];

export const ORDER_BY_DIRECTION = ['asc', 'desc'] as const;
export type OrderByDirection = (typeof ORDER_BY_DIRECTION)[number];

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
