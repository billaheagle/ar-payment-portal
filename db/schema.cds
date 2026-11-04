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
    OutboxMessages     : Association to many OutboxMessages
                             on OutboxMessages.Payment = $self;
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

@assert.unique: {disputeNumber: [DisputeNumber]}
entity Disputes : cuid, managed, arportal.ItemKey {
    DisputeNumber   : String(12) not null;
    BusinessPartner : String(10) not null;

    @assert.range
    Reason          : arportal.DisputeReason not null;
    Description     : String(1000);
    DisputedAmount  : Decimal(15, 2) not null;
    Currency        : Currency not null;

    @assert.range
    Status          : arportal.DisputeStatus not null default 'OPEN';
    ResolutionNote  : String(1000);
    ResolvedAt      : Timestamp;
    ResolvedBy      : String(255);
}

@assert.unique: {paymentMessage: [
    Payment,
    MessageType
]}
entity OutboxMessages : cuid, managed {
    MessageType      : String(40) not null;
    Payment          : Association to Payments not null;

    @assert.range
    Status           : arportal.OutboxStatus not null default 'PENDING';
    Attempts         : Integer not null default 0;
    MaxAttempts      : Integer not null default 6;
    NextAttemptAt    : Timestamp not null default $now;
    LockedBy         : String(64);
    LockedUntil      : Timestamp;
    LastErrorCode    : String(40);
    LastErrorMessage : String(1000);
    ProcessedAt      : Timestamp;
}

entity WebhookEvents {
    key EventId          : String(64) not null;
        EventType        : String(40) not null;
        CheckoutId       : String(64) not null;
        PaymentReference : String(12) not null;
        PayloadHash      : String(64) not null;
        ReceivedAt       : Timestamp not null;

        @assert.range
        Result           : arportal.WebhookResult not null;
        Note             : String(500);
}

entity JobLocks {
    key Name        : String(40) not null;
        LockedBy    : String(64);
        LockedUntil : Timestamp;
}

entity ItemReservations {
    key CompanyCode        : String(4) not null;
    key FiscalYear         : String(4) not null;
    key AccountingDocument : String(10) not null;
    key LineItem           : String(3) not null;
        Payment            : Association to Payments not null;
        ReservedAt         : Timestamp not null;
}

@cds.persistence.skip
entity BusinessPartners {
    key BusinessPartner : String(10) not null;
        Name            : String(81);
        Country         : String(3);
        CanPay          : Boolean;
        CanDispute      : Boolean;
}

@cds.persistence.skip
entity OpenItems {
    key CompanyCode            : String(4) not null;
    key FiscalYear             : String(4) not null;
    key AccountingDocument     : String(10) not null;
    key LineItem               : String(3) not null;
        BusinessPartner        : String(10);
        BusinessPartnerName    : String(81);
        ItemType               : arportal.ItemType;
        BillingDocument        : String(10);
        Reference              : String(16);
        InvoiceReference       : String(10);
        PostingDate            : Date;
        DocumentDate           : Date;
        NetDueDate             : Date;
        Amount                 : Decimal(15, 2);
        Currency               : String(3);
        IsOverdue              : Boolean;
        DaysOverdue            : Integer;
        IsPayable              : Boolean;
        NotPayableReason       : arportal.NotPayableReason;
        DaysOverdueCriticality : Integer;
}
