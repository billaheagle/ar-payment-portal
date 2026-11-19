const DEFAULT_TOP = 30; // same as @cds.query.limit default in customer-service.cds

export interface CqnSelect {
  where?: unknown[];
  orderBy?: {
    ref?: unknown[];
    sort?: unknown;
    implicit?: unknown;
  }[];

  limit?: {
    rows?: { val?: unknown };
    offset?: { val?: unknown };
  };

  search?: unknown;
}

export class UnsupportedQueryError extends Error {
  constructor(
    message: string,
    readonly option: string,
  ) {
    super(message);
    this.name = 'UnsupportedQueryError';
  }
}

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

export const readLimit = (limit: CqnSelect['limit']): { top: number; skip: number } => {
  const rows = limit?.rows?.val ?? DEFAULT_TOP;
  const offset = limit?.offset?.val ?? 0;

  if (!isNonNegativeInteger(rows)) {
    throw new UnsupportedQueryError(`Invalid $top: ${JSON.stringify(rows)}`, '$top');
  }
  if (!isNonNegativeInteger(offset)) {
    throw new UnsupportedQueryError(`Invalid $skip: ${JSON.stringify(offset)}`, '$skip');
  }

  return { top: rows, skip: offset };
};

export const rejectSearch = (search: CqnSelect['search']): void => {
  if (search !== undefined) throw new UnsupportedQueryError(`$search is not supported`, '$search');
};
