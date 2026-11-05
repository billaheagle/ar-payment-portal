import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DataSourceError } from '../../srv/lib/datasource/datasource-error';

describe('DataSourceError (spec 10.5)', () => {
  it('marks a temporary outage as transient', () => {
    const err = new DataSourceError('SAP_TEMPORARILY_UNAVAILABLE', 'SAP is down');
    assert.equal(err.code, 'SAP_TEMPORARILY_UNAVAILABLE');
    assert.equal(err.transient, true);
  });

  it('marks permanent errors as not transient', () => {
    assert.equal(
      new DataSourceError('SAP_ITEM_ALREADY_CLEARED', 'Item already cleared').transient,
      false,
    );
    assert.equal(
      new DataSourceError('SAP_OPEN_AMOUNT_CHANGED', 'Open amount changed').transient,
      false,
    );
    assert.equal(new DataSourceError('SAP_NOT_SUPPORTED', 'Not supported').transient, false);
  });

  it('is both a DataSourceError and an Error', () => {
    const err = new DataSourceError('SAP_TEMPORARILY_UNAVAILABLE', 'SAP is down');
    assert.ok(err instanceof DataSourceError);
    assert.ok(err instanceof Error);
  });

  it('keeps the name and the message', () => {
    const err = new DataSourceError('SAP_TEMPORARILY_UNAVAILABLE', 'SAP is down');
    assert.equal(err.name, 'DataSourceError');
    assert.equal(err.message, 'SAP is down');
  });
});
