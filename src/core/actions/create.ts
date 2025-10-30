import { log } from '@nile/src/internal.config';
import { z } from 'zod';
import type { Action, ActionHandler, SubService } from '../../types/actions';
import { Ok, safeError } from '../../utils';
import type { Model, ModelOptions } from '../orm';

export const generateCreateAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model<any, any>
) => {
  const createActionHandler: ActionHandler = async (data) => {
    const _options = sub.validation
      ? {
          validation: {
            ...sub.validation,
          } as ModelOptions['validation'],
        }
      : {
          validation: {
            context: {
              operation: 'create',
            },
          } as ModelOptions['validation'],
        };

    const { data: result, error } = await model.create(data, _options);

    if (error) {
      const error_id = log({
        atFunction: 'createActionHandler',
        message: `Error creating new record in ${tableName}: ${error.message}`,
        data: error.details || {},
        type: 'error',
      });
      return safeError(`Error creating new record in ${tableName}`, error_id);
    }
    return Ok(result as any);
  };

  const newAction: Action = {
    name: 'create',
    type: 'auto',
    description: `Create a new record in ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('create'),
    handler: createActionHandler,
    validation: {
      zodSchema: model.getSchema('create'),
    },
  };

  return newAction;
};

export const generateCreateManyAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model<any, any>
) => {
  const createManyActionHandler: ActionHandler = async (data) => {
    const { items } = data;

    if (!(items && Array.isArray(items)) || items.length === 0) {
      const error_id = log({
        atFunction: 'createManyActionHandler',
        message: 'Missing or invalid items array in payload',
        data,
        type: 'error',
      });
      return safeError('Missing or invalid items array in payload', error_id);
    }

    const _options = sub.validation
      ? {
          validation: {
            ...sub.validation,
            context: {
              operation: 'create',
            },
          } as ModelOptions['validation'],
        }
      : {
          validation: {
            context: {
              operation: 'create',
            },
          } as ModelOptions['validation'],
        };

    const { data: result, error } = await model.createMany(items, _options);

    if (error) {
      const error_id = log({
        atFunction: 'createManyActionHandler',
        message: `Error creating multiple records in ${tableName}: ${error.message}`,
        data: error.details || {},
        type: 'error',
      });
      return safeError(
        `Error creating multiple records in ${tableName}`,
        error_id
      );
    }
    return Ok(result as any);
  };

  const newAction: Action = {
    name: 'createMany',
    type: 'auto',
    description: `Create multiple records in ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('createMany'),
    handler: createManyActionHandler,
    validation: {
      zodSchema: z.object({
        items: z.array(z.any()).min(1, 'At least one item is required'),
      }),
    },
  };

  return newAction;
};
