import cds from '@sap/cds';

// HTTP status per error code (spec 14.1). The message for each code is in
// _i18n/messages.properties under the same key.
export const ERROR_STATUS = {
  VALIDATION_FAILED: 400,
  ITEMS_REQUIRED: 400,
  ITEMS_TOO_MANY: 400,
  ITEM_DUPLICATE: 400,
  AMOUNT_INVALID: 400,
  AMOUNT_EXCEEDS_OPEN: 400,
  PARTIAL_NOT_ALLOWED: 400,
  MIXED_SCOPE: 400,
  TOTAL_NOT_POSITIVE: 400,
  IDEMPOTENCY_KEY_INVALID: 400,
  UNSUPPORTED_QUERY: 400,
  DISPUTE_NOT_ALLOWED: 400,
  DISPUTE_AMOUNT_INVALID: 400,
  DESCRIPTION_REQUIRED: 400,
  RESOLUTION_NOTE_REQUIRED: 400,
  WEBHOOK_PAYLOAD_INVALID: 400,
  WEBHOOK_SIGNATURE_INVALID: 401,
  WEBHOOK_TIMESTAMP_EXPIRED: 401,
  NO_PAY_PERMISSION: 403,
  NO_DISPUTE_PERMISSION: 403,
  ITEM_NOT_FOUND: 404,
  PAYMENT_NOT_FOUND: 404,
  DISPUTE_NOT_FOUND: 404,
  ASSIGNMENT_DUPLICATE: 409,
  ITEM_IN_DISPUTE: 409,
  ITEM_PAYMENT_PENDING: 409,
  IDEMPOTENCY_KEY_REUSED: 409,
  REQUEST_IN_PROGRESS: 409,
  PAYMENT_NOT_CANCELLABLE: 409,
  DISPUTE_ALREADY_OPEN: 409,
  DISPUTE_NOT_WITHDRAWABLE: 409,
  DISPUTE_NOT_OPEN: 409,
  PAYMENT_NOT_RETRYABLE: 409,
  PSP_UNAVAILABLE: 502,
} as const satisfies Record<string, 400 | 401 | 403 | 404 | 409 | 502>;

export type ErrorCode = keyof typeof ERROR_STATUS;

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly args: (string | number)[] = [],
    readonly target?: string,
  ) {
    super(code);
  }
}

export const reject = (req: cds.Request, error: AppError): never => {
  return req.reject({
    status: ERROR_STATUS[error.code],
    code: error.code,
    message: error.code,
    args: error.args,
    target: error.target,
  });
};
