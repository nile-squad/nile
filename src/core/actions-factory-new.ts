import type { Action, SubService } from '../types/actions';
import {
  generateDecrementAction,
  generateIncrementAction,
} from './actions/atomic';
import {
  generateCreateAction,
  generateCreateManyAction,
} from './actions/create';
import {
  generateDeleteByIdAction,
  generateDeleteManyAction,
} from './actions/delete';
import {
  generateFindByIdAction,
  generateFindByIdsAction,
  generateFindFirstAction,
  generateFindManyAction,
} from './actions/find';
import { generateFindWithRelationsAction } from './actions/relations';
import {
  generateUpdateAction,
  generateUpdateManyAction,
} from './actions/update';
import { generateCountAction, generateExistsAction } from './actions/utility';
import { createModel } from './orm';

export const newServiceActionsFactory = (
  sub: SubService,
  db: any,
  tables: any
) => {
  const actions: Action[] = [];
  const _errors: string[] = [];
  const tableName = sub.tableName;
  const table = tables[tableName as keyof typeof tables];
  const returnValue = { actions, errors: _errors };

  if (!(tableName && table)) {
    _errors.push(
      `Table ${tableName} does not exist in the database or tableName is not set on sub service ${sub.name}`
    );
    return returnValue;
  }

  const model = createModel({
    table,
    dbInstance: db,
  });

  // Generate all actions
  actions.push(generateCreateAction(sub, tableName, table, model as any));
  actions.push(generateCreateManyAction(sub, tableName, table, model as any));

  actions.push(generateFindByIdAction(sub, tableName, table, model as any));
  actions.push(generateFindByIdsAction(sub, tableName, table, model as any));
  actions.push(generateFindFirstAction(sub, tableName, table, model as any));
  actions.push(generateFindManyAction(sub, tableName, table, model as any));

  actions.push(generateUpdateAction(sub, tableName, table, model as any));
  actions.push(generateUpdateManyAction(sub, tableName, table, model as any));

  actions.push(
    generateDeleteByIdAction({ sub, tableName, table, model: model as any })
  );
  actions.push(
    generateDeleteManyAction({ sub, tableName, table, model: model as any })
  );

  actions.push(generateIncrementAction(sub, tableName, table, model as any));
  actions.push(generateDecrementAction(sub, tableName, table, model as any));

  actions.push(generateCountAction(sub, tableName, table, model as any));
  actions.push(generateExistsAction(sub, tableName, table, model as any));

  actions.push(
    generateFindWithRelationsAction(sub, tableName, table, model as any)
  );

  return returnValue;
};
