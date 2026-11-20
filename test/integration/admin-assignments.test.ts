import cds from '@sap/cds';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OpenItem } from '#cds-models/CustomerService';

const { GET, POST, PATCH } = cds.test(__dirname + '/../..');

const ADMIN = '/odata/v4/admin/UserAssignments';

// Assert on the status code instead of letting axios throw on 4xx
const as = (username: string) => ({
  auth: { username, password: 'test' },
  validateStatus: () => true,
});
const admin = as('admin@portal.test');

interface Assignment {
  ID: string;
  UserId: string;
  BusinessPartner: string;
  CanView: boolean;
  CanPay: boolean;
  CanDispute: boolean;
  IsActive: boolean;
}

interface ODataError {
  error: { code: string; message: string; target?: string };
}

const draftUrl = (id: string) => `${ADMIN}(ID=${id},IsActiveEntity=false)`;
const activeUrl = (id: string) => `${ADMIN}(ID=${id},IsActiveEntity=true)`;

// New assignment: POST creates a draft, draftActivate runs the before('SAVE') handler
const createAndActivate = async (body: Partial<Assignment>) => {
  const draft = await POST(ADMIN, body, admin);
  assert.equal(draft.status, 201);
  const { ID } = draft.data as Assignment;
  return POST(`${draftUrl(ID)}/AdminService.draftActivate`, {}, admin);
};

// Existing assignment: draftEdit → PATCH the draft → draftActivate
const editAndActivate = async (id: string, changes: Partial<Assignment>) => {
  const edit = await POST(
    `${activeUrl(id)}/AdminService.draftEdit`,
    { PreserveChanges: true },
    admin,
  );
  assert.equal(edit.status, 201);

  const patch = await PATCH(draftUrl(id), changes, admin);
  assert.equal(patch.status, 200);

  return POST(`${draftUrl(id)}/AdminService.draftActivate`, {}, admin);
};

const findAssignment = async (userId: string, bp: string): Promise<Assignment> => {
  const res = await GET(
    `${ADMIN}?$filter=UserId eq '${userId}' and BusinessPartner eq '${bp}' and IsActiveEntity eq true`,
    admin,
  );
  const [row] = (res.data as { value: Assignment[] }).value;
  assert.ok(row, `assignment ${userId}/${bp} not found`);
  return row;
};

describe('AdminService (spec 3.2, 6.1)', () => {
  describe('role separation (AT-37)', () => {
    it('rejects a customer on AdminService', async () => {
      const res = await GET(ADMIN, as('alice@acme.test'));
      assert.equal(res.status, 403);
    });

    it('rejects an admin on CustomerService', async () => {
      const res = await GET('/odata/v4/customer/OpenItems', admin);
      assert.equal(res.status, 403);
    });
  });

  describe('validation on activate (AT-34)', () => {
    it('requires CanView when CanPay is set (BR-02)', async () => {
      const res = await createAndActivate({
        UserId: 'erin@acme.test',
        BusinessPartner: '1000003',
        CanView: false,
        CanPay: true,
      });
      const { error } = res.data as ODataError;
      assert.equal(res.status, 400);
      assert.equal(error.code, 'VALIDATION_FAILED');
      assert.match(error.target ?? '', /CanView$/);
    });

    it('rejects a duplicate user and business partner (BR-01)', async () => {
      const res = await createAndActivate({
        UserId: 'alice@acme.test',
        BusinessPartner: '1000001',
      });
      const { error } = res.data as ODataError;
      assert.equal(res.status, 409);
      assert.equal(error.code, 'ASSIGNMENT_DUPLICATE');
    });

    it('stores the user ID trimmed and in lower case (BR-01)', async () => {
      const res = await createAndActivate({
        UserId: ' Erin@ACME.test ',
        BusinessPartner: '1000003',
        CanView: true,
      });
      assert.match(String(res.status), /^2\d\d$/);

      const find = await findAssignment('erin@acme.test', '1000003');
      assert.ok(find);
    });

    it('allows editing an existing assignment without a duplicate error', async () => {
      const find = await findAssignment('bob@globex.test', '1000003');
      const res = await editAndActivate(find.ID, { CanDispute: true });
      assert.match(String(res.status), /^2\d\d$/);
    });
  });

  describe('deactivation takes effect immediately (AT-35, BR-03)', () => {
    it('hides business partner 1000001 from alice once deactivated', async () => {
      type ODataList = { value: OpenItem[]; '@odata.count'?: number };
      const alice = 'alice@acme.test';
      const find = await findAssignment(alice, '1000001');

      await editAndActivate(find.ID, { IsActive: false });
      try {
        const res = await GET('/odata/v4/customer/OpenItems', as(alice));
        const data = (res.data as ODataList).value;

        const docs = [...new Set(data.map((d) => d.AccountingDocument))];
        assert.deepEqual(docs, ['1800000007']);
      } finally {
        await editAndActivate(find.ID, { IsActive: true });
      }
    });
  });
});
