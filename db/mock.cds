namespace arportal.mock;

entity Ecc_KNA1 {
    key KUNNR : String(10);
        NAME1 : String(35);
        LAND1 : String(3);
}

entity Ecc_BSID {
    key BUKRS : String(4);
    key GJAHR : String(4);
    key BELNR : String(10);
    key BUZEI : String(3);
        KUNNR : String(10);
        BLART : String(2);
        VBELN : String(10);
        XBLNR : String(16);
        REBZG : String(10);
        BUDAT : String(8);
        BLDAT : String(8);
        ZFBDT : String(8);
        ZBD1T : Integer;
        WRBTR : Decimal(13, 2);
        SHKZG : String(1);
        WAERS : String(5);
        AUGBL : String(10);
        AUGDT : String(8);
}

entity S4_BusinessPartner {
    key BusinessPartner         : String(10);
        BusinessPartnerFullName : String(81);
        Country                 : String(3);
}

entity S4_OperationalAcctgDocItem {
    key CompanyCode                 : String(4);
    key FiscalYear                  : String(4);
    key AccountingDocument          : String(10);
    key AccountingDocumentItem      : String(3);
        Customer                    : String(10);
        AccountingDocumentType      : String(2);
        BillingDocument             : String(10);
        DocumentReferenceID         : String(16);
        InvoiceReference            : String(10);
        PostingDate                 : Date;
        DocumentDate                : Date;
        NetDueDate                  : Date;
        AmountInTransactionCurrency : Decimal(15, 2);
        TransactionCurrency         : String(5);
        ClearingAccountingDocument  : String(10);
        ClearingDate                : Date;
}

entity MockPostings {
    key PaymentReference : String(12);
        ClearingDocument : String(10);
        FiscalYear       : String(4);
        ResultJson       : LargeString;
        CreatedAt        : Timestamp;
}

entity MockNumberRanges {
    key Name       : String(20);
        LastNumber : Integer;
}
