namespace arportal;

using {
    cuid,
    managed,
    Currency
} from '@sap/cds/common';
using from './types';

@assert.unique: {userBp: [
    UserId,
    BusinessPartner
]}
entity UserAssignments : cuid, managed {
    UserId          : String(255) not null;
    BusinessPartner : String(10) not null;
    CanView         : Boolean not null default true;
    CanPay          : Boolean not null default false;
    CanDispute      : Boolean not null default false;
    IsActive        : Boolean not null default true;
}

@assert.unique: {
    paymentReference: [PaymentReference],
    idempotency     : [
        createdBy,
        IdempotencyKey
    ]
}
entity Payments : cuid, managed {
    PaymentReference   : String(12) not null;
    BusinessPartner    : String(10) not null;
    CompanyCode        : String(4) not null;
    Currency           : Currency not null;
    TotalAmount        : Decimal(15, 2) not null;

    @assert.range
    Status             : arportal.PaymentStatus not null default 'NEW';
    IdempotencyKey     : String(36) not null;
    RequestHash        : String(64) not null;
    PspCheckoutId      : String(64);
    PspCheckoutUrl     : String(500);
    PspPaymentId       : String(64);
    ExpiresAt          : Timestamp;
    SucceededAt        : Timestamp;
    PostedAt           : Timestamp;
    ClearingDocument   : String(10);
    ClearingFiscalYear : String(4);
    FailureCode        : String(40);
    FailureMessage     : String(500);
    Items              : Composition of many PaymentItems
                             on Items.Payment = $self;
//OutboxMessages: Association to many OutboxMessages on Payment on OutboxMessages.Payment = $self;
}

@assert.unique: {paymentItem: [
    Payment,
    CompanyCode,
    FiscalYear,
    AccountingDocument,
    LineItem
]}
entity PaymentItems : cuid, arportal.ItemKey {
    Payment                    : Association to Payments not null;

    @assert.range
    ItemType                   : arportal.ItemType not null;
    Reference                  : String(16);
    OpenAmount                 : Decimal(15, 2) not null;
    PaidAmount                 : Decimal(15, 2) not null;
    IsPartial                  : Boolean not null;
    ResidualAccountingDocument : String(10);
    ResidualLineItem           : String(3);
}
