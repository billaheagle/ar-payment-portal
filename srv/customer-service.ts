import cds from '@sap/cds';
import {
  BusinessPartners,
  OpenItems,
  Disputes,
  Payments,
  PaymentItems,
} from '#cds-models/CustomerService';
import { readOpenItems } from './lib/open-items/read-open-items';
import { readBusinessPartners } from './lib/business-partners/read-business-partners';
import { restrictToScope } from './lib/authz/restrict';

export default class CustomerService extends cds.ApplicationService {
  override async init(): Promise<void> {
    this.on('READ', OpenItems, (req) => readOpenItems(req));
    this.on('READ', BusinessPartners, (req) => readBusinessPartners(req));

    this.before('READ', Disputes, async (req) => restrictToScope(req, 'BusinessPartner'));
    this.before('READ', Payments, async (req) => restrictToScope(req, 'BusinessPartner'));
    this.before('READ', PaymentItems, async (req) =>
      restrictToScope(req, 'Payment.BusinessPartner'),
    );

    await super.init();
  }
}
