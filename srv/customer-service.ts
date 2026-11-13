import cds from '@sap/cds';
import { OpenItems } from '#cds-models/CustomerService';
import { readOpenItems } from './lib/open-items/read-open-items';

export default class CustomerService extends cds.ApplicationService {
  override async init(): Promise<void> {
    this.on('READ', OpenItems, (req) => readOpenItems(req));

    await super.init();
  }
}
