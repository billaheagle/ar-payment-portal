using CustomerService as service from '../../srv/customer-service';

annotate service.OpenItems with @(
    Capabilities.SearchRestrictions.Searchable: false,
    Capabilities.FilterRestrictions           : {FilterExpressionRestrictions: [
        {
            Property          : CompanyCode,
            AllowedExpressions: 'SingleValue',
        },
        {
            Property          : Currency,
            AllowedExpressions: 'SingleValue',
        },
        {
            Property          : ItemType,
            AllowedExpressions: 'SingleValue',
        },
        {
            Property          : IsOverdue,
            AllowedExpressions: 'SingleValue',
        },
        {
            Property          : BusinessPartner,
            AllowedExpressions: 'MultiValue',
        }
    ]},

    UI.HeaderInfo                             : {
        TypeName      : '{i18n>OpenItem}',
        TypeNamePlural: '{i18n>OpenItems}',
        Title         : {Value: AccountingDocument},
        Description   : {Value: BusinessPartnerName}
    },

    UI.SelectionFields                        : [
        BusinessPartner,
        CompanyCode,
        ItemType,
        Currency,
        IsOverdue
    ],

    UI.LineItem                               : [
        {Value: BusinessPartnerName},
        {Value: Reference},
        {Value: AccountingDocument},
        {Value: LineItem},
        {Value: ItemType},
        {Value: PostingDate},
        {Value: NetDueDate},
        {
            Value      : DaysOverdue,
            Criticality: DaysOverdueCriticality
        },
        {Value: Amount},
        {Value: NotPayableReason}
    ]
);

annotate service.OpenItems with {
    CompanyCode         @title: '{i18n>CompanyCode}';
    FiscalYear          @title: '{i18n>FiscalYear}';
    AccountingDocument  @title: '{i18n>Document}';
    LineItem            @title: '{i18n>LineItem}';
    BusinessPartner     @title: '{i18n>BusinessPartner}';
    BusinessPartnerName @title: '{i18n>Customer}';
    ItemType            @title             : '{i18n>ItemType}'
                        @Common.Text       : ItemTypeText
                        @UI.TextArrangement: #TextOnly;
    ItemTypeText        @title: '{i18n>ItemType}';
    BillingDocument     @title: '{i18n>BillingDocument}';
    Reference           @title: '{i18n>Reference}';
    InvoiceReference    @title: '{i18n>InvoiceReference}';
    PostingDate         @title: '{i18n>PostingDate}';
    DocumentDate        @title: '{i18n>DocumentDate}';
    NetDueDate          @title: '{i18n>NetDueDate}';
    Amount              @title             : '{i18n>Amount}'  @Measures.ISOCurrency: Currency;
    Currency            @title: '{i18n>Currency}';
    IsOverdue           @title: '{i18n>Overdue}';
    DaysOverdue         @title: '{i18n>DaysOverdue}';
    IsPayable           @title: '{i18n>IsPayable}';
    NotPayableReason    @title: '{i18n>NotPayableReason}';
};
