import cds from '@sap/cds';
import { BusinessPartners, OpenItems } from '#cds-models/CustomerService';
import { readOpenItems } from './lib/open-items/read-open-items';
import { readBusinessPartners } from './lib/business-partners/read-business-partners';

export default class CustomerService extends cds.ApplicationService {
  override async init(): Promise<void> {
    this.on('READ', OpenItems, (req) => readOpenItems(req));
    this.on('READ', BusinessPartners, (req) => readBusinessPartners(req));

    await super.init();
  }
}
