import { log } from '@nile/src/internal.config';
import type { Action, ActionHandler, SubService } from '../../types/actions';
import { Ok, safeError } from '../../utils';
import type { Model } from '../orm';

export const generateDeleteByIdAction = ({
  sub,
  tableName,
  table,
  model,
}: {
  sub: SubService;
  tableName: string;
  table: any;
  model: Model<any, any>;
}) => {
  const deleteByIdActionHandler: ActionHandler = async (data) => {
    if (!data[sub.idName]) {
      const error_id = log({
        atFunction: 'deleteByIdActionHandler',
        message: `Missing ${sub.idName} in payload!`,
        data,
        type: 'error',
      });
      return safeError(`Missing ${sub.idName} in payload!`, error_id);
    }

    const { data: result, error } = await model.deleteById(data[sub.idName]);

    if (error) {
      const error_id = log({
        atFunction: 'deleteByIdActionHandler',
        message: `Error deleting record from ${tableName}: ${error.message}`,
        data: error.details || {},
        type: 'error',
      });
      return safeError(`Error deleting record from ${tableName}`, error_id);
    }
    return Ok(result as any);
  };

  const newAction: Action = {
    name: 'deleteById',
    type: 'auto',
    description: `Delete a record by id in ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('deleteById'),
    handler: deleteByIdActionHandler,
    validation: undefined as any,
  };

  return newAction;
};

export const generateDeleteManyAction = ({
  sub,
  tableName,
  table,
  model,
}: {
  sub: SubService;
  tableName: string;
  table: any;
  model: Model<any, any>;
}) => {
  const deleteManyActionHandler: ActionHandler = async (data) => {
    const { data: result, error } = await model.deleteMany([]);

    if (error) {
      const _error_id = log({
        atFunction: 'deleteManyActionHandler',
        message: `Error deleting all records from ${tableName}: ${error.message}`,
        data: error.details || {},
        type: 'error',
      });
      return safeError(
        `Error deleting all records from ${tableName}`,
        'error-id'
      );
    }
    return Ok(result as any);
  };

  const newAction: Action = {
    name: 'deleteMany',
    type: 'auto',
    description: `Delete all records in ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('deleteMany'),
    handler: deleteManyActionHandler,
    validation: undefined as any,
  };

  return newAction;
};
