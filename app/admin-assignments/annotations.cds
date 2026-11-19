using AdminService as service from '../../srv/admin-service';


annotate service.UserAssignments with @(
    UI.HeaderInfo      : {
        TypeName      : '{i18n>Assignment}',
        TypeNamePlural: '{i18n>Assignments}',
        Title         : {Value: UserId},
        Description   : {Value: BusinessPartner}
    },
    UI.SelectionFields : [
        UserId,
        BusinessPartner,
        IsActive
    ],
    UI.LineItem        : [
        {Value: UserId},
        {Value: BusinessPartner},
        {Value: CanView},
        {Value: CanPay},
        {Value: CanDispute},
        {Value: IsActive},
        {Value: modifiedAt},
    ],
    UI.FieldGroup #Main: {Data: [
        {Value: UserId},
        {Value: BusinessPartner},
        {Value: CanView},
        {Value: CanPay},
        {Value: CanDispute},
        {Value: IsActive},
    ]},
    UI.Facets          : [{
        $Type : 'UI.ReferenceFacet',
        ID    : 'Main',
        Label : '{i18n>General}',
        Target: '@UI.FieldGroup#Main'
    }]
);

annotate service.UserAssignments with {
    UserId          @title: '{i18n>UserId}';
    BusinessPartner @title: '{i18n>BusinessPartner}';
    CanView         @title: '{i18n>CanView}';
    CanPay          @title: '{i18n>CanPay}';
    CanDispute      @title: '{i18n>CanDispute}';
    IsActive        @title: '{i18n>IsActive}';
};
