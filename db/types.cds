namespace arportal;

type PaymentStatus    : String(20) enum {
    NEW;
    INITIATED;
    PSP_SUCCEEDED;
    POSTED;
    POSTING_FAILED;
    FAILED;
    EXPIRED;
    CANCELLED;
}

type OutboxStatus     : String(12) enum {
    PENDING;
    PROCESSING;
    DONE;
    FAILED;
}

type DisputeStatus    : String(10) enum {
    OPEN;
    ACCEPTED;
    REJECTED;
    WITHDRAWN;
}

type DisputeReason    : String(15) enum {
    PRICE;
    QUANTITY;
    DAMAGED;
    NOT_RECEIVED;
    OTHER;
}

type ItemType         : String(12) enum {
    INVOICE;
    CREDIT_MEMO;
    RESIDUAL;
}

type NotPayableReason : String(20) enum {
    IN_DISPUTE;
    PAYMENT_PENDING;
    NO_PAY_PERMISSION;
}

type WebhookResult    : String(20) enum {
    PROCESSED;
    IGNORED_STATE;
    UNKNOWN_PAYMENT;
    AMOUNT_MISMATCH;
}

aspect ItemKey {
    CompanyCode        : String(4) not null;
    FiscalYear         : String(4) not null;
    AccountingDocument : String(10) not null;
    LineItem           : String(3) not null;
}
