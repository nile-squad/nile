import { log } from '@nile/src/internal.config';
import { z } from 'zod';
import type { Action, ActionHandler, SubService } from '../../types/actions';
import { Ok, safeError } from '../../utils';
import type { Model, ModelOptions } from '../orm';

export const generateUpdateAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model<any, any>
) => {
  const updateActionHandler: ActionHandler = async (data) => {
    if (!data[sub.idName]) {
      const error_id = log({
        atFunction: 'updateActionHandler',
        message: `Missing ${sub.idName} in payload!`,
        data,
        type: 'error',
      });
      return safeError(`Missing ${sub.idName} in payload!`, error_id);
    }

    const id = data[sub.idName];
    const { [sub.idName]: _, ...updateData } = data;

    const _options = {
      validation: {
        ...sub.validation,
        context: {
          operation: 'update',
        },
      } as ModelOptions['validation'],
    };

    const { data: result, error } = await model.update(
      id,
      updateData,
      _options
    );

    if (error) {
      const error_id = log({
        atFunction: 'updateActionHandler',
        message: `Error updating record in ${tableName}: ${error.message}`,
        data: error.details || {},
        type: 'error',
      });
      return safeError(`Error updating record in ${tableName}`, error_id);
    }
    return Ok(result as any);
  };

  const newAction: Action = {
    name: 'update',
    type: 'auto',
    description: `Update a record in ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('update'),
    handler: updateActionHandler,
    validation: {
      zodSchema: model.getSchema('update'),
    },
  };

  return newAction;
};

export const generateUpdateManyAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model<any, any>
) => {
  const updateManyActionHandler: ActionHandler = async (data) => {
    const { filters, data: updateData } = data;

    if (!(filters && Array.isArray(filters)) || filters.length === 0) {
      const error_id = log({
        atFunction: 'updateManyActionHandler',
        message: 'Missing or invalid filters array in payload',
        data,
        type: 'error',
      });
      return safeError('Missing or invalid filters array in payload', error_id);
    }

    if (!updateData || typeof updateData !== 'object') {
      const error_id = log({
        atFunction: 'updateManyActionHandler',
        message: 'Missing or invalid update data in payload',
        data,
        type: 'error',
      });
      return safeError('Missing or invalid update data in payload', error_id);
    }

    const _options = sub.validation
      ? {
          validation: {
            ...sub.validation,
            context: {
              operation: 'update',
            },
          } as ModelOptions['validation'],
        }
      : {
          validation: {
            context: {
              operation: 'update',
            },
          } as ModelOptions['validation'],
        };

    const { data: result, error } = await model.updateMany(
      filters,
      updateData,
      _options
    );

    if (error) {
      const _error_id = log({
        atFunction: 'updateManyActionHandler',
        message: `Error updating multiple records in ${tableName}: ${error.message}`,
        data: error.details || {},
        type: 'error',
      });
      return safeError(
        `Error updating multiple records in ${tableName}`,
        'error-id'
      );
    }
    return Ok(result as any);
  };

  const newAction: Action = {
    name: 'updateMany',
    type: 'auto',
    description: `Update multiple records in ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('updateMany'),
    handler: updateManyActionHandler,
    validation: {
      zodSchema: z.object({
        filters: z.array(z.any()).min(1, 'At least one filter is required'),
        data: z.any(),
      }),
    },
  };

  return newAction;
};
