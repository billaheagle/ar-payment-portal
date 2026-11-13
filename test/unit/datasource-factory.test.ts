import cds from '@sap/cds';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { dataSource, setDataSourceForTest } from '../../srv/lib/datasource/factory';
import { MockS4DataSource } from '../../srv/lib/datasource/mock-s4/mock-s4-datasource';
import { MockEccDataSource } from '../../srv/lib/datasource/mock-ecc/mock-ecc-datasource';

type ArportalEnv = { arportal?: { dataSource?: string } };
const env = cds.env as ArportalEnv;
const original = env.arportal;

// Simulate a setting and clear the cached instance so the factory reads it again
const useSetting = (value: string | undefined): void => {
  env.arportal = value === undefined ? undefined : { dataSource: value };
  setDataSourceForTest(undefined);
};

describe('DataSource factory (spec 10)', () => {
  afterEach(() => {
    env.arportal = original;
    setDataSourceForTest(undefined);
  });

  it('uses mock-s4 when nothing is configured', () => {
    useSetting(undefined);
    assert.ok(dataSource() instanceof MockS4DataSource);
  });

  it('uses mock-ecc when configured', () => {
    useSetting('mock-ecc');
    assert.ok(dataSource() instanceof MockEccDataSource);
  });

  it('returns the same instance on every call', () => {
    useSetting('mock-s4');
    assert.ok(dataSource() instanceof MockS4DataSource);
    assert.equal(dataSource(), dataSource());
  });

  it('rejects an unknown setting', () => {
    useSetting('mock-sap');
    assert.throws(() => dataSource(), /Unknown DataSource/);
  });

  it('reports s4-sandbox as not implemented yet', () => {
    useSetting('s4-sandbox');
    assert.throws(() => dataSource(), /not implemented/);
  });

  it('can be replaced by a fake in tests', () => {
    const fake = new MockEccDataSource();
    setDataSourceForTest(fake);
    assert.equal(dataSource(), fake);
  });
});
