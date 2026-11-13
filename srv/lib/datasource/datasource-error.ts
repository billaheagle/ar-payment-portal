export type DataSourceErrorCode =
  | 'SAP_TEMPORARILY_UNAVAILABLE'
  | 'SAP_ITEM_ALREADY_CLEARED'
  | 'SAP_OPEN_AMOUNT_CHANGED'
  | 'SAP_NOT_SUPPORTED';

const TRANSIENT: Record<DataSourceErrorCode, boolean> = {
  SAP_TEMPORARILY_UNAVAILABLE: true,
  SAP_ITEM_ALREADY_CLEARED: false,
  SAP_OPEN_AMOUNT_CHANGED: false,
  SAP_NOT_SUPPORTED: false,
};

export class DataSourceError extends Error {
  readonly transient: boolean;

  constructor(
    readonly code: DataSourceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DataSourceError';
    this.transient = TRANSIENT[code];
  }
}
