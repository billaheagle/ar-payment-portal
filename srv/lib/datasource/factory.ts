import cds from '@sap/cds';
import type { ArDataSource } from './ar-datasource';

let instance: ArDataSource | undefined;

const readSetting = (): string =>
  (cds.env as { arportal?: { dataSource?: string } }).arportal?.dataSource ?? 'mock-s4';

const create = (kind: string): ArDataSource => {
  switch (kind) {
    case 'mock-ecc':
    case 'mock-s4':
    case 's4-sandbox':
      throw new Error(`DataSource '${kind}' is not implemented yet`);
    default:
      throw new Error(`Unknown DataSource '${kind}' in cds.env.arportal.dataSource`);
  }
};

export const DataSource = (): ArDataSource => {
  instance ??= create(readSetting());
  return instance;
};

export const setDataSourceForTest = (fake: ArDataSource | undefined): void => {
  instance = fake;
};
