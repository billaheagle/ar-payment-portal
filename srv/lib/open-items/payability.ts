import type { PartnerPermission } from '../authz/scope';
import type { NotPayableReason, OpenItem } from '../datasource/types';
import { keyOf } from '../datasource/shared';

export type Payability =
  { isPayable: true; reason: null } | { isPayable: false; reason: NotPayableReason };

export const payabilityOf = (
  item: OpenItem,
  permission: PartnerPermission | undefined,
  disputedKeys: Set<string>,
  reservedKeys: Set<string>,
): Payability => {
  // Reasons in priority order (spec 5.10): permission, then open dispute, then pending payment
  if (!permission?.canPay)
    return {
      isPayable: false,
      reason: 'NO_PAY_PERMISSION',
    };

  const key = keyOf(item.companyCode, item.fiscalYear, item.accountingDocument, item.lineItem);

  if (disputedKeys.has(key))
    return {
      isPayable: false,
      reason: 'IN_DISPUTE',
    };

  if (reservedKeys.has(key))
    return {
      isPayable: false,
      reason: 'PAYMENT_PENDING',
    };

  return {
    isPayable: true,
    reason: null,
  };
};
