import { log } from '@nile/src/internal.config';
import { z } from 'zod';
import type { Action, ActionHandler, SubService } from '../../types/actions';
import { Ok, safeError } from '../../utils';
import type { Model } from '../orm';

export const generateIncrementAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model<any, any>
) => {
  const incrementActionHandler: ActionHandler = async (data) => {
    const { id, field, value } = data;

    if (!(id && field) || value === undefined) {
      const error_id = log({
        atFunction: 'incrementActionHandler',
        message: 'Missing id, field, or value in payload',
        data,
        type: 'error',
      });
      return safeError('Missing id, field, or value in payload', error_id);
    }

    const { data: result, error } = await model.increment(
      id,
      field,
      value || 1
    );

    if (error) {
      const error_id = log({
        atFunction: 'incrementActionHandler',
        message: `Error incrementing field in ${tableName}: ${error.message}`,
        data: error.details || {},
        type: 'error',
      });
      return safeError(`Error incrementing field in ${tableName}`, error_id);
    }
    return Ok(result as any);
  };

  const newAction: Action = {
    name: 'increment',
    type: 'auto',
    description: `Increment a numeric field in ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('increment'),
    handler: incrementActionHandler,
    validation: {
      zodSchema: z.object({
        id: z.string().min(1, 'ID is required'),
        field: z.string().min(1, 'Field is required'),
        value: z.number().optional().default(1),
      }),
    },
  };

  return newAction;
};

export const generateDecrementAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model<any, any>
) => {
  const decrementActionHandler: ActionHandler = async (data) => {
    const { id, field, value } = data;

    if (!(id && field) || value === undefined) {
      const error_id = log({
        atFunction: 'decrementActionHandler',
        message: 'Missing id, field, or value in payload',
        data,
        type: 'error',
      });
      return safeError('Missing id, field, or value in payload', error_id);
    }

    const { data: result, error } = await model.decrement(
      id,
      field,
      value || 1
    );

    if (error) {
      const error_id = log({
        atFunction: 'decrementActionHandler',
        message: `Error decrementing field in ${tableName}: ${error.message}`,
        data: error.details || {},
        type: 'error',
      });
      return safeError(`Error decrementing field in ${tableName}`, error_id);
    }
    return Ok(result as any);
  };

  const newAction: Action = {
    name: 'decrement',
    type: 'auto',
    description: `Decrement a numeric field in ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('decrement'),
    handler: decrementActionHandler,
    validation: {
      zodSchema: z.object({
        id: z.string().min(1, 'ID is required'),
        field: z.string().min(1, 'Field is required'),
        value: z.number().optional().default(1),
      }),
    },
  };

  return newAction;
};
