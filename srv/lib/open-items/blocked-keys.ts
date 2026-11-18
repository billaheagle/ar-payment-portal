import cds from '@sap/cds';
import { keyOf, unique } from '../datasource/shared';
import { Disputes, ItemReservations } from '#cds-models/arportal';
import type { OpenItem } from '../datasource/types';

const { SELECT } = cds.ql;

type KeyRow = {
  CompanyCode?: string | null;
  FiscalYear?: string | null;
  AccountingDocument?: string | null;
  LineItem?: string | null;
};

const keyOfRow = (row: KeyRow): string =>
  keyOf(
    String(row.CompanyCode),
    String(row.FiscalYear),
    String(row.AccountingDocument),
    String(row.LineItem),
  );

export const blockedKeys = async (
  items: OpenItem[],
): Promise<{ disputed: Set<string>; reserved: Set<string> }> => {
  if (items.length === 0) return { disputed: new Set(), reserved: new Set() };

  const docs = unique(items.map((item) => item.accountingDocument));

  const [disputedRows, reservedRows] = await Promise.all([
    SELECT.from(Disputes)
      .columns('CompanyCode', 'FiscalYear', 'AccountingDocument', 'LineItem')
      .where({
        AccountingDocument: { in: docs },
        Status: 'OPEN',
      }),
    SELECT.from(ItemReservations)
      .columns('CompanyCode', 'FiscalYear', 'AccountingDocument', 'LineItem')
      .where({
        AccountingDocument: { in: docs },
      }),
  ]);

  return {
    disputed: new Set(disputedRows.map(keyOfRow)),
    reserved: new Set(reservedRows.map(keyOfRow)),
  };
};
