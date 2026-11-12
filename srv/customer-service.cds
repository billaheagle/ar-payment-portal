using arportal as db from '../db/schema';

@requires: 'CustomerUser'
service CustomerService {
    @readonly
    @cds.persistence.skip
    entity BusinessPartners as projection on db.BusinessPartners;

    @readonly
    @cds.persistence.skip
    @cds.query.limit: {
        default: 30,
        max    : 200
    }
    entity OpenItems        as projection on db.OpenItems;

    @readonly
    entity Payments         as
        projection on db.Payments
        excluding {
            IdempotencyKey,
            RequestHash,
            FailureMessage
        };

    @readonly
    entity PaymentItems     as projection on db.PaymentItems;

    @readonly
    entity Disputes         as
        projection on db.Disputes
        excluding {
            ResolvedBy
        };
}
