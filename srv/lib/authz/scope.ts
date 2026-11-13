import cds from '@sap/cds';
import { UserAssignments } from '#cds-models/arportal';

const { SELECT } = cds.ql;

export interface PartnerPermission {
  businessPartner: string;
  canView: boolean;
  canPay: boolean;
  canDispute: boolean;
}

export type UserScope = PartnerPermission[];

export const loadScope = async (userId: string): Promise<UserScope> => {
  const rows = await SELECT.from(UserAssignments)
    .columns('BusinessPartner', 'CanView', 'CanPay', 'CanDispute')
    .where({ UserId: userId, IsActive: true, CanView: true });

  return rows.map((row): PartnerPermission => {
    if (!row.BusinessPartner)
      throw new Error(`User assignment without business partner for user ${userId}`);

    return {
      businessPartner: row.BusinessPartner,
      canView: row.CanView === true,
      canPay: row.CanPay === true,
      canDispute: row.CanDispute === true,
    };
  });
};

export const visiblePartners = (scope: UserScope): string[] => {
  return scope.map((permission) => permission.businessPartner);
};

export const permissionsFor = (scope: UserScope, bp: string): PartnerPermission | undefined => {
  return scope.find((permission) => permission.businessPartner === bp);
};
