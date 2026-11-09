export type ItemType = 'INVOICE' | 'CREDIT_MEMO' | 'RESIDUAL';
export type OrderByField = 'NetDueDate' | 'PostingDate' | 'Amount' | 'AccountingDocument';
export type OrderByDirection = 'asc' | 'desc';

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
