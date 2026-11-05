import type { BusinessPartner, OpenItemQuery, OpenItem, ItemKey } from './types';

export type DataSourceKind = 'mock-ecc' | 'mock-s4' | 's4-sandbox';

/**
 * Access to the SAP backend (ECC or S/4) through a single contract.
 *
 * Rules for every implementation (spec 10.1):
 * - An empty `businessPartners` list returns an empty result, never all data.
 * - Only items that are not yet cleared are returned.
 */
export interface ArDataSource {
  readonly name: DataSourceKind;
  getBusinessPartners(ids: string[]): Promise<BusinessPartner[]>;
  getOpenItems(query: OpenItemQuery): Promise<{ openItems: OpenItem[]; total: number }>;
  getOpenItemsByKeys(itemKeys: ItemKey[], businessPartners: string[]): Promise<OpenItem[]>;
}
