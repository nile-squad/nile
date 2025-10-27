import { log } from '@nile/src/internal.config';
import { z } from 'zod';
import type { Action, ActionHandler, SubService } from '../../types/actions';
import { Ok, safeError } from '../../utils';
import type { Model } from '../orm';

export const generateFindWithRelationsAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model<any, any>
) => {
  const findWithRelationsActionHandler: ActionHandler = async (data) => {
    const { id, with: withRelations } = data;

    const { data: result, error } = await model.findWithRelations(
      id,
      withRelations
    );

    if (error) {
      const error_id = log({
        atFunction: 'findWithRelationsActionHandler',
        message: `Error finding record with relations in ${tableName}: ${error.message}`,
        data: error.details || {},
        type: 'error',
      });
      return safeError(
        `Error finding record with relations in ${tableName}`,
        error_id
      );
    }
    return Ok(result as any);
  };

  const newAction: Action = {
    name: 'findWithRelations',
    type: 'auto',
    description: `Find one record with relations from ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('findWithRelations'),
    handler: findWithRelationsActionHandler,
    validation: {
      zodSchema: z.object({
        id: z.string().min(1, 'ID is required'),
        with: z.record(z.string(), z.any()).optional(),
      }),
    },
  };

  return newAction;
};
