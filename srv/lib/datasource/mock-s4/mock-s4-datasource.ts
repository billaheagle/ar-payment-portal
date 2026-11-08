import cds from '@sap/cds';
import { S4_OperationalAcctgDocItems, S4_BusinessPartners } from '#cds-models/arportal/mock';
import type { ArDataSource } from '../ar-datasource';
import type { BusinessPartner, ItemKey, OpenItem, OpenItemQuery } from '../types';
import { s4RowToBusinessPartner, s4RowToOpenItem } from './mock-s4-mapper';

const { SELECT } = cds.ql;

const unique = (values: string[]): string[] => [...new Set(values)];

const keyOf = (
  companyCode: string,
  fiscalYear: string,
  accountingDocument: string,
  lineItem: string,
): string => `${companyCode}|${fiscalYear}|${accountingDocument}|${lineItem}`;

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

    const [partners, rows] = await Promise.all([
      this.getBusinessPartners(query.businessPartners),
      SELECT.from(S4_OperationalAcctgDocItems).where({
        ClearingAccountingDocument: null,
        Customer: { in: query.businessPartners },
      }),
    ]);

    const bpNames: Record<string, string | null> = Object.fromEntries(
      partners.map((p) => [p.businessPartner, p.name]),
    );

    return {
      openItems: rows.map((row) => s4RowToOpenItem(row, bpNames)),
      total: rows.length,
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

    const bpNames: Record<string, string | null> = Object.fromEntries(
      partners.map((p) => [p.businessPartner, p.name]),
    );

    return matching.map((row) => s4RowToOpenItem(row, bpNames));
  }
}
