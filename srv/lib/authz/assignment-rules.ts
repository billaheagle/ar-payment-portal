import { AppError } from '../errors';

const BUSINESS_PARTNER_RE = /^[1-9][0-9]{0,9}$/;

export interface AssignmentInput {
  UserId?: string | null;
  BusinessPartner?: string | null;
  CanView?: boolean | null;
  CanPay?: boolean | null;
  CanDispute?: boolean | null;
}

export interface ValidAssignment extends AssignmentInput {
  UserId: string;
  BusinessPartner: string;
}

export const normalizeUserId = (raw: string): string => {
  return raw.trim().toLowerCase();
};

export function checkAssignment(data: AssignmentInput): asserts data is ValidAssignment {
  if (normalizeUserId(data.UserId ?? '') === '')
    throw new AppError('VALIDATION_FAILED', ['UserId'], 'UserId');

  if (!BUSINESS_PARTNER_RE.test(data.BusinessPartner ?? ''))
    throw new AppError('VALIDATION_FAILED', ['BusinessPartner'], 'BusinessPartner');

  if ((data.CanPay || data.CanDispute) && !data.CanView)
    throw new AppError('VALIDATION_FAILED', ['CanView'], 'CanView');
}
