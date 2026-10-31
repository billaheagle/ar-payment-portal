import { daysBetween } from '../dates';

export const daysOverdue = (netDueDate: string, today: string): number => {
  const overdue = daysBetween(netDueDate, today);
  return overdue > 0 ? overdue : 0;
};

export const isOverdue = (netDueDate: string, today: string): boolean => {
  return daysOverdue(netDueDate, today) > 0;
};
