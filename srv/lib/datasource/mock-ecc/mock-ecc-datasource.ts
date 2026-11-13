import cds from '@sap/cds';
import { Ecc_KNA1s, Ecc_BSIDs } from '#cds-models/arportal/mock';
import type { ArDataSource } from '../ar-datasource';
import type {
  BusinessPartner,
  ItemKey,
  OpenItem,
  OpenItemQuery,
  OrderBy,
  OrderByField,
} from '../types';
import { eccRowToOpenItem, eccRowToBusinessPartner, alphaIn } from './mock-ecc-mapper';
import { bpNameMap, keyOf, unique } from '../shared';

const { SELECT } = cds.ql;

const buildWhere = (query: OpenItemQuery) => {
  const where: Record<string, unknown> = {};
  if (query.companyCode) where.BUKRS = query.companyCode;
  if (query.currency) where.WAERS = query.currency;

  switch (query.itemType) {
    case 'RESIDUAL':
      where.BLART = 'DZ';
      where.REBZG = { '!=': null };
      break;
    case 'CREDIT_MEMO':
      where.SHKZG = 'H';
      break;
    case 'INVOICE':
      where.SHKZG = 'S';
      break; // "not residual" needs OR, added as NOT_RESIDUAL in getOpenItems

    default:
      break;
  }

  return where;
};

// Inverse of the RESIDUAL rule in itemTypeOf (spec 10.3); keep in sync with mock-ecc-mapper.ts
const NOT_RESIDUAL = cds.parse.expr(`BLART != 'DZ' or BLART is null or REBZG is null`);

/** Value of a domain field used for sorting (mirrors ORDER_COLUMN in the S/4 mock). */
const sortValue = (item: OpenItem, field: OrderByField): string | number => {
  switch (field) {
    case 'NetDueDate':
      return item.netDueDate;
    case 'PostingDate':
      return item.postingDate;
    case 'Amount':
      return item.amountCents;
    case 'AccountingDocument':
      return item.accountingDocument;
  }
};

const byValue = (x: string | number, y: string | number): number => (x < y ? -1 : x > y ? 1 : 0);

/** Sorts by the requested fields, then by the item key (same tie-breaker as the S/4 mock). */
const compareBy =
  (orderBy: OrderBy[]) =>
  (a: OpenItem, b: OpenItem): number => {
    for (const o of orderBy) {
      const result = byValue(sortValue(a, o.field), sortValue(b, o.field));
      if (result !== 0) return o.direction === 'asc' ? result : -result;
    }
    return byValue(
      keyOf(a.companyCode, a.fiscalYear, a.accountingDocument, a.lineItem),
      keyOf(b.companyCode, b.fiscalYear, b.accountingDocument, b.lineItem),
    );
  };
export class MockEccDataSource implements ArDataSource {
  readonly name = 'mock-ecc';

  async getBusinessPartners(ids: string[]): Promise<BusinessPartner[]> {
    if (ids.length === 0) return [];
    const rows = await SELECT.from(Ecc_KNA1s).where({
      KUNNR: { in: ids.map((id) => alphaIn(id, 10)) },
    });

    return rows.map((row) => eccRowToBusinessPartner(row));
  }

  async getOpenItems(query: OpenItemQuery): Promise<{ openItems: OpenItem[]; total: number }> {
    if (query.businessPartners.length === 0) return { openItems: [], total: 0 };

    const where: Record<string, unknown> = {
      ...buildWhere(query),
      // Mandatory conditions last, so optional filters can never override the scope
      AUGBL: null,
      KUNNR: { in: query.businessPartners.map((id) => alphaIn(id)) },
    };

    let dataQuery = SELECT.from(Ecc_BSIDs).where(where);

    if (query.itemType === 'INVOICE') {
      dataQuery = dataQuery.where(NOT_RESIDUAL);
    }

    const [partners, rows] = await Promise.all([
      this.getBusinessPartners(query.businessPartners),
      dataQuery,
    ]);

    const bpNames: Record<string, string | null> = bpNameMap(partners);

    // ECC has no net due date column (it is ZFBDT + ZBD1T) and WRBTR is unsigned,
    // so overdue filtering, sorting and paging happen in memory after mapping.
    // Deliberate exception to push-down (spec 13.5) for the mock; see spec 16.4.
    let items = rows.map((row) => eccRowToOpenItem(row, bpNames));

    if (query.overdue === true) items = items.filter((i) => i.netDueDate < query.today);
    if (query.overdue === false) items = items.filter((i) => i.netDueDate >= query.today);

    items = items.sort(compareBy(query.orderBy));

    const total = items.length;
    items = items.slice(query.skip, query.skip + query.top);

    return {
      openItems: items,
      total: total,
    };
  }

  async getOpenItemsByKeys(itemKeys: ItemKey[], businessPartners: string[]): Promise<OpenItem[]> {
    if (itemKeys.length === 0 || businessPartners.length === 0) return [];

    const wanted = new Set(
      itemKeys.map((k) => keyOf(k.companyCode, k.fiscalYear, k.accountingDocument, k.lineItem)),
    );

    const [partners, rows] = await Promise.all([
      this.getBusinessPartners(businessPartners),
      SELECT.from(Ecc_BSIDs).where({
        AUGBL: null,
        KUNNR: { in: businessPartners.map((id) => alphaIn(id)) },
        BELNR: { in: unique(itemKeys.map((k) => k.accountingDocument)) },
      }),
    ]);

    const matching = rows.filter((row) =>
      wanted.has(keyOf(String(row.BUKRS), String(row.GJAHR), String(row.BELNR), String(row.BUZEI))),
    );

    const bpNames: Record<string, string | null> = bpNameMap(partners);

    return matching.map((row) => eccRowToOpenItem(row, bpNames));
  }
}
