import { createHash } from 'node:crypto';

export interface RequestHashItem {
  companyCode: string;
  fiscalYear: string;
  accountingDocument: string;
  lineItem: string;
  amountCents: number;
}

const keyOf = (item: RequestHashItem): string =>
  `${item.companyCode}|${item.fiscalYear}|${item.accountingDocument}|${item.lineItem}`;

const compareByKey = (a: RequestHashItem, b: RequestHashItem): number => {
  const keyA = keyOf(a);
  const keyB = keyOf(b);

  if (keyA < keyB) return -1;
  if (keyA > keyB) return 1;
  return 0;
};

export const requestHash = (items: RequestHashItem[]): string => {
  const text = [...items]
    .sort(compareByKey)
    .map((item) => `${keyOf(item)}|${String(item.amountCents)}`)
    .join('\n');
  return createHash('sha256').update(text).digest('hex');
};
