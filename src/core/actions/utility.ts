import { log } from '@nile/src/internal.config';
import { z } from 'zod';
import type { Action, ActionHandler, SubService } from '../../types/actions';
import { Ok, safeError } from '../../utils';
import type { Model } from '../orm';

export const generateCountAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model<any, any>
) => {
  const countActionHandler: ActionHandler = async (data) => {
    const { filters } = data;

    const { data: result, error } = await model.countRecords(filters || []);

    if (error) {
      const error_id = log({
        atFunction: 'countActionHandler',
        message: `Error counting records in ${tableName}: ${error.message}`,
        data: error.details || {},
        type: 'error',
      });
      return safeError(`Error counting records in ${tableName}`, error_id);
    }
    return Ok(result as any);
  };

  const newAction: Action = {
    name: 'count',
    type: 'auto',
    description: `Count records in ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('count'),
    handler: countActionHandler,
    validation: {
      zodSchema: z.object({
        filters: z.array(z.any()).optional(),
      }),
    },
  };

  return newAction;
};

export const generateExistsAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model<any, any>
) => {
  const existsActionHandler: ActionHandler = async (data) => {
    const { filters } = data;

    if (!(filters && Array.isArray(filters)) || filters.length === 0) {
      const error_id = log({
        atFunction: 'existsActionHandler',
        message: 'Missing or invalid filters array in payload',
        data,
        type: 'error',
      });
      return safeError('Missing or invalid filters array in payload', error_id);
    }

    const { data: result, error } = await model.exists(filters);

    if (error) {
      const error_id = log({
        atFunction: 'existsActionHandler',
        message: `Error checking existence in ${tableName}: ${error.message}`,
        data: error.details || {},
        type: 'error',
      });
      return safeError(`Error checking existence in ${tableName}`, error_id);
    }
    return Ok(result as any);
  };

  const newAction: Action = {
    name: 'exists',
    type: 'auto',
    description: `Check if record exists in ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('exists'),
    handler: existsActionHandler,
    validation: {
      zodSchema: z.object({
        filters: z.array(z.any()).min(1, 'At least one filter is required'),
      }),
    },
  };

  return newAction;
};
