import cds from '@sap/cds';
import type { ArDataSource } from './ar-datasource';
import { MockS4DataSource } from './mock-s4/mock-s4-datasource';

let instance: ArDataSource | undefined;

const readSetting = (): string =>
  (cds.env as { arportal?: { dataSource?: string } }).arportal?.dataSource ?? 'mock-s4';

const create = (kind: string): ArDataSource => {
  switch (kind) {
    case 'mock-s4':
      return new MockS4DataSource();
    case 'mock-ecc':
    case 's4-sandbox':
      throw new Error(`DataSource '${kind}' is not implemented yet`);
    default:
      throw new Error(`Unknown DataSource '${kind}' in cds.env.arportal.dataSource`);
  }
};

export const dataSource = (): ArDataSource => {
  instance ??= create(readSetting());
  return instance;
};

export const setDataSourceForTest = (fake: ArDataSource | undefined): void => {
  instance = fake;
};
