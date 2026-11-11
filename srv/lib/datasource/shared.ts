import { BusinessPartner } from './types';

export const unique = (values: string[]): string[] => [...new Set(values)];

export const keyOf = (
  companyCode: string,
  fiscalYear: string,
  accountingDocument: string,
  lineItem: string,
): string => `${companyCode}|${fiscalYear}|${accountingDocument}|${lineItem}`;

export const bpNameMap = (partners: BusinessPartner[]): Record<string, string | null> =>
  Object.fromEntries(partners.map((p) => [p.businessPartner, p.name]));
