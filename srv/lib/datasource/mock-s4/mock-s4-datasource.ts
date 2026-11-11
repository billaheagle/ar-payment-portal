import cds from '@sap/cds';
import { S4_OperationalAcctgDocItems, S4_BusinessPartners } from '#cds-models/arportal/mock';
import type { ArDataSource } from '../ar-datasource';
import type { BusinessPartner, ItemKey, OpenItem, OpenItemQuery, OrderByField } from '../types';
import { s4RowToBusinessPartner, s4RowToOpenItem } from './mock-s4-mapper';
import { bpNameMap, keyOf, unique } from '../shared';

const { SELECT } = cds.ql;

const ORDER_COLUMN: Record<OrderByField, string> = {
  NetDueDate: 'NetDueDate',
  PostingDate: 'PostingDate',
  Amount: 'AmountInTransactionCurrency',
  AccountingDocument: 'AccountingDocument',
};

const buildWhere = (query: OpenItemQuery) => {
  const where: Record<string, unknown> = {};
  if (query.companyCode) where.CompanyCode = query.companyCode;
  if (query.currency) where.TransactionCurrency = query.currency;

  if (query.overdue === true) where.NetDueDate = { '<': query.today };
  if (query.overdue === false) where.NetDueDate = { '>=': query.today };

  switch (query.itemType) {
    case 'RESIDUAL':
      where.AccountingDocumentType = 'DZ';
      where.InvoiceReference = { '!=': null };
      break;
    case 'CREDIT_MEMO':
      where.AmountInTransactionCurrency = { '<': 0 };
      break;
    case 'INVOICE':
      where.AmountInTransactionCurrency = { '>=': 0 };
      break; // "not residual" needs OR, added as NOT_RESIDUAL in getOpenItems

    default:
      break;
  }

  return where;
};

// Inverse of the RESIDUAL rule in itemTypeOf (spec 10.3); keep in sync with mock-s4-mapper.ts
const NOT_RESIDUAL = cds.parse.expr(
  `AccountingDocumentType != 'DZ' or AccountingDocumentType is null or InvoiceReference is null`,
);

export class MockS4DataSource implements ArDataSource {
  readonly name = 'mock-s4';

  async getBusinessPartners(ids: string[]): Promise<BusinessPartner[]> {
    if (ids.length === 0) return [];
    const rows = await SELECT.from(S4_BusinessPartners).where({
      BusinessPartner: { in: ids },
    });

    return rows.map((row) => s4RowToBusinessPartner(row));
  }

  async getOpenItems(query: OpenItemQuery): Promise<{ openItems: OpenItem[]; total: number }> {
    if (query.businessPartners.length === 0) return { openItems: [], total: 0 };

    const where: Record<string, unknown> = {
      ...buildWhere(query),
      // Mandatory conditions last, so optional filters can never override the scope
      ClearingAccountingDocument: null,
      Customer: { in: query.businessPartners },
    };

    let dataQuery = SELECT.from(S4_OperationalAcctgDocItems).where(where);
    let countQuery = SELECT.one
      .from(S4_OperationalAcctgDocItems)
      .columns('count(*) as total')
      .where(where);

    if (query.itemType === 'INVOICE') {
      dataQuery = dataQuery.where(NOT_RESIDUAL);
      countQuery = countQuery.where(NOT_RESIDUAL);
    }

    const sorts = query.orderBy.map((o) => `${ORDER_COLUMN[o.field]} ${o.direction}`);

    const [partners, rows, counted] = await Promise.all([
      this.getBusinessPartners(query.businessPartners),
      dataQuery
        .orderBy(
          ...sorts,
          // Item key as a tie-breaker so paging is stable when sort values are equal
          'CompanyCode asc',
          'FiscalYear asc',
          'AccountingDocument asc',
          'AccountingDocumentItem asc',
        )
        .limit(query.top, query.skip),
      countQuery,
    ]);

    const bpNames: Record<string, string | null> = bpNameMap(partners);

    return {
      openItems: rows.map((row) => s4RowToOpenItem(row, bpNames)),
      // count(*) may come back as a string (e.g. bigint on PostgreSQL)
      total: Number((counted as { total: number | string } | undefined)?.total ?? 0),
    };
  }

  async getOpenItemsByKeys(itemKeys: ItemKey[], businessPartners: string[]): Promise<OpenItem[]> {
    if (itemKeys.length === 0 || businessPartners.length === 0) return [];

    const wanted = new Set(
      itemKeys.map((k) => keyOf(k.companyCode, k.fiscalYear, k.accountingDocument, k.lineItem)),
    );

    const [partners, rows] = await Promise.all([
      this.getBusinessPartners(businessPartners),
      SELECT.from(S4_OperationalAcctgDocItems).where({
        ClearingAccountingDocument: null,
        Customer: { in: businessPartners },
        AccountingDocument: { in: unique(itemKeys.map((k) => k.accountingDocument)) },
      }),
    ]);

    const matching = rows.filter((row) =>
      wanted.has(
        keyOf(
          String(row.CompanyCode),
          String(row.FiscalYear),
          String(row.AccountingDocument),
          String(row.AccountingDocumentItem),
        ),
      ),
    );

    const bpNames: Record<string, string | null> = bpNameMap(partners);

    return matching.map((row) => s4RowToOpenItem(row, bpNames));
  }
}
