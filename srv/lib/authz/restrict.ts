import cds from '@sap/cds';
import { loadScope, visiblePartners } from './scope';

export const restrictToScope = async (req: cds.Request, column: string): Promise<void> => {
  const allowed = visiblePartners(await loadScope(req.user.id));
  const select = req.query.SELECT;
  if (select === undefined) return;

  const condition =
    allowed.length > 0
      ? { xpr: [{ ref: column.split('.') }, 'in', { list: allowed.map((bp) => ({ val: bp })) }] }
      : { xpr: [{ val: 1 }, '=', { val: 0 }] };

  console.log(condition);

  const existing = select.where as unknown[] | undefined;
  select.where = (
    existing?.length ? [{ xpr: existing }, 'and', condition] : [condition]
  ) as typeof select.where;
};
