import { ITEM_TYPE, ORDER_BY_DIRECTION, ORDER_BY_FIELDS } from '../datasource/types';
import type {
  ItemType,
  OpenItemQuery,
  OrderBy,
  OrderByDirection,
  OrderByField,
} from '../datasource/types';
import { readLimit, rejectSearch, UnsupportedQueryError, type CqnSelect } from '../odata/query';

export interface RequestedQuery extends Omit<OpenItemQuery, 'businessPartners' | 'today'> {
  businessPartners?: string[];
}

export type Filters = Pick<
  RequestedQuery,
  'businessPartners' | 'companyCode' | 'itemType' | 'currency' | 'overdue'
>;

const DEFAULT_ORDER: OrderBy[] = [{ field: 'NetDueDate', direction: 'asc' }];

const isOrderByField = (value: unknown): value is OrderByField =>
  typeof value === 'string' && (ORDER_BY_FIELDS as readonly string[]).includes(value);

const isOrderByDirection = (value: unknown): value is OrderByDirection =>
  typeof value === 'string' && (ORDER_BY_DIRECTION as readonly string[]).includes(value);

const isItemType = (value: unknown): value is ItemType =>
  typeof value === 'string' && (ITEM_TYPE as readonly string[]).includes(value);

export const fieldOf = (token: unknown): string | undefined => {
  if (typeof token !== 'object' || token === null || !('ref' in token)) return undefined;
  const { ref } = token;
  if (!Array.isArray(ref) || ref.length !== 1) return undefined;
  const [name] = ref as unknown[];
  return typeof name === 'string' ? name : undefined;
};

export const valOf = (token: unknown): { value: unknown } | undefined => {
  if (typeof token !== 'object' || token === null || !('val' in token)) return undefined;
  return { value: token.val };
};

export const xprOf = (token: unknown): unknown[] | undefined => {
  if (typeof token !== 'object' || token === null || !('xpr' in token)) return undefined;
  const { xpr } = token;
  if (!Array.isArray(xpr)) return undefined;
  return xpr as unknown[];
};

const splitBy = (tokens: unknown[], word: 'and' | 'or'): unknown[][] => {
  const groups: unknown[][] = [[]];
  for (const token of tokens) {
    if (token === word) groups.push([]);
    else groups[groups.length - 1]?.push(token);
  }
  return groups;
};

const readComparison = (group: unknown[]): { field: string; value: unknown } => {
  const [refToken, operator, valToken] = group;
  const field = fieldOf(refToken);
  const val = valOf(valToken);

  if (group.length !== 3 || field === undefined || operator !== '=' || val === undefined) {
    throw new UnsupportedQueryError(`Unsupported condition: ${JSON.stringify(group)}`, '$filter');
  }

  return { field, value: val.value };
};

const readOrderBy = (orderBy: CqnSelect['orderBy']): OrderBy[] => {
  const requested = (orderBy ?? []).filter((o) => !o.implicit);
  if (requested.length === 0) return DEFAULT_ORDER;

  return requested.map((o): OrderBy => {
    const field = o.ref?.length === 1 ? o.ref[0] : undefined;

    if (!isOrderByField(field)) {
      throw new UnsupportedQueryError(
        `Sorting by ${JSON.stringify(o.ref)} is not supported`,
        '$orderby',
      );
    }

    const direction = o.sort ?? 'asc';
    if (!isOrderByDirection(direction)) {
      throw new UnsupportedQueryError(
        `Unsupported sort direction: ${JSON.stringify(o.sort)}`,
        '$orderby',
      );
    }

    return { field, direction };
  });
};

const readWhere = (where: CqnSelect['where']): Filters => {
  if (where === undefined) return {};
  const filter: Filters = {};

  const hasOr = where.includes('or');
  if (hasOr && where.includes('and'))
    throw new UnsupportedQueryError(
      "Combine 'and' with 'or' only by putting the 'or' part in parentheses",
      '$filter',
    );

  const tokens = hasOr ? [{ xpr: where }] : where;

  const setOnce = <K extends keyof Filters>(key: K, value: NonNullable<Filters[K]>): void => {
    if (filter[key] !== undefined)
      throw new UnsupportedQueryError(`'${key}' is filtered more than once`, '$filter');

    filter[key] = value;
  };

  for (const group of splitBy(tokens, 'and')) {
    const xpr = group.length === 1 ? xprOf(group[0]) : undefined;

    if (xpr !== undefined) {
      const partners: string[] = [];
      for (const part of splitBy(xpr, 'or')) {
        const { field, value } = readComparison(part);

        if (field !== 'BusinessPartner')
          throw new UnsupportedQueryError(
            `'or' is only supported for BusinessPartner, not '${field}'`,
            '$filter',
          );
        if (typeof value !== 'string')
          throw new UnsupportedQueryError(
            `Invalid BusinessPartner: ${JSON.stringify(value)}`,
            '$filter',
          );
        partners.push(value);
      }
      setOnce('businessPartners', partners);
      continue;
    }

    const { field, value } = readComparison(group);

    switch (field) {
      case 'CompanyCode':
        if (typeof value !== 'string')
          throw new UnsupportedQueryError(
            `Unsupported data type for CompanyCode: ${JSON.stringify(value)}`,
            '$filter',
          );
        setOnce('companyCode', value);
        break;
      case 'Currency':
        if (typeof value !== 'string')
          throw new UnsupportedQueryError(
            `Unsupported data type for Currency: ${JSON.stringify(value)}`,
            '$filter',
          );
        setOnce('currency', value);
        break;
      case 'ItemType':
        if (!isItemType(value))
          throw new UnsupportedQueryError(
            `Unsupported ItemType value: ${JSON.stringify(value)}`,
            '$filter',
          );
        setOnce('itemType', value);
        break;
      case 'IsOverdue':
        if (typeof value !== 'boolean')
          throw new UnsupportedQueryError(
            `Unsupported data type for IsOverdue: ${JSON.stringify(value)}`,
            '$filter',
          );
        setOnce('overdue', value);
        break;
      case 'BusinessPartner':
        if (typeof value !== 'string')
          throw new UnsupportedQueryError(
            `Unsupported data type for BusinessPartner: ${JSON.stringify(value)}`,
            '$filter',
          );
        setOnce('businessPartners', [value]);
        break;

      default:
        throw new UnsupportedQueryError(`Filtering by '${field}' is not supported`, '$filter');
    }
  }

  return filter;
};

export const toRequestedQuery = (select: CqnSelect): RequestedQuery => {
  rejectSearch(select.search);
  const { top, skip } = readLimit(select.limit);

  return {
    ...readWhere(select.where),
    orderBy: readOrderBy(select.orderBy),
    top,
    skip,
  };
};
