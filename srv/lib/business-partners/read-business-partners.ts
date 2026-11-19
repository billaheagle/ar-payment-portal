import { type BusinessPartner as BusinessPartnerRow } from '#cds-models/CustomerService';
import cds from '@sap/cds';
import type { BusinessPartner } from '../datasource/types';
import {
  loadScope,
  permissionsFor,
  visiblePartners,
  type UserScope,
  type PartnerPermission,
} from '../authz/scope';
import { dataSource } from '../datasource/factory';
import { readLimit, rejectSearch, UnsupportedQueryError, type CqnSelect } from '../odata/query';
import { AppError, reject } from '../errors';

const readOneBusinessPartner = async (req: cds.Request, scope: UserScope) => {
  const [raw] = req.params as unknown[];
  const businessPartner =
    typeof raw === 'string'
      ? raw
      : typeof raw === 'object' && raw !== null && 'BusinessPartner' in raw
        ? raw.BusinessPartner
        : undefined;

  if (typeof businessPartner !== 'string') return req.reject(400, 'Invalid business partner key');

  const permission = permissionsFor(scope, businessPartner);
  if (!permission) return req.reject(404, 'Business partner not found');

  const [partner] = await dataSource().getBusinessPartners([businessPartner]);
  if (!partner) return req.reject(404, 'Business partner not found');

  return toBusinessPartnerRow(partner, permission);
};

export const readBusinessPartners = async (req: cds.Request) => {
  const scope = await loadScope(req.user.id);
  const visible = visiblePartners(scope);

  if (req.params.length > 0) {
    return readOneBusinessPartner(req, scope);
  }

  let limit: ReturnType<typeof readLimit>;
  const partners = await dataSource().getBusinessPartners(visible);
  try {
    const select = req.query.SELECT as CqnSelect;
    rejectSearch(select.search);
    limit = readLimit(select.limit);
  } catch (error) {
    if (error instanceof UnsupportedQueryError) {
      return reject(req, new AppError('UNSUPPORTED_QUERY', [error.option]));
    }
    throw error;
  }

  const { top, skip } = limit;
  const rows = partners
    .flatMap((partner) => {
      const permission = permissionsFor(scope, partner.businessPartner);
      return permission ? [toBusinessPartnerRow(partner, permission)] : [];
    })
    .sort((a, b) => String(a.BusinessPartner).localeCompare(String(b.BusinessPartner)));

  const total = rows.length;
  return Object.assign(rows.slice(skip, skip + top), { $count: total });
};

export const toBusinessPartnerRow = (
  partner: BusinessPartner,
  permission: PartnerPermission,
): BusinessPartnerRow => {
  return {
    // Key
    BusinessPartner: partner.businessPartner,

    // BP
    Name: partner.name,
    Country: partner.country,

    // Access
    CanPay: permission.canPay,
    CanDispute: permission.canDispute,
  };
};
