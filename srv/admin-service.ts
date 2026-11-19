import cds from '@sap/cds';
import { UserAssignments } from '#cds-models/AdminService';
import { checkAssignment, normalizeUserId } from './lib/authz/assignment-rules';
import { AppError, reject } from './lib/errors';
import { UserAssignments as DbUserAssignments } from '#cds-models/arportal';

const { SELECT } = cds.ql;

export default class AdminService extends cds.ApplicationService {
  override async init(): Promise<void> {
    this.before('SAVE', UserAssignments, async (req) => {
      if (typeof req.data.UserId === 'string') {
        req.data.UserId = normalizeUserId(req.data.UserId);
      }

      try {
        checkAssignment(req.data);
      } catch (error) {
        if (error instanceof AppError) {
          return reject(req, error);
        }
        throw error;
      }

      const duplicate = await SELECT.one
        .from(DbUserAssignments)
        .columns('ID')
        .where({
          UserId: req.data.UserId,
          BusinessPartner: req.data.BusinessPartner,
          ID: { '!=': req.data.ID },
        });

      if (duplicate) {
        return reject(
          req,
          new AppError('ASSIGNMENT_DUPLICATE', [req.data.UserId, req.data.BusinessPartner]),
        );
      }
    });
    await super.init();
  }
}
