import { log } from '@nile/src/internal.config';
import { z } from 'zod';
import type { Action, ActionHandler, SubService } from '../../types/actions';
import { Ok, safeError } from '../../utils';
import type { Model } from '../orm';

export const generateFindByIdAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model<any, any>
) => {
  const findByIdActionHandler: ActionHandler = async (data) => {
    const { id } = data;

    if (!id) {
      const error_id = log({
        atFunction: 'findByIdActionHandler',
        message: 'Missing id in payload',
        data,
        type: 'error',
      });
      return safeError('Missing id in payload', error_id);
    }

    const { data: result, error } = await model.findById(id);

    if (error) {
      const _error_id = log({
        atFunction: 'findByIdActionHandler',
        message: `Error finding record by id in ${tableName}: ${error.message}`,
        data: error.details || {},
        type: 'error',
      });
      return safeError(
        `Error finding record by id in ${tableName}`,
        'error-id'
      );
    }
    return Ok(result as any);
  };

  const newAction: Action = {
    name: 'findById',
    type: 'auto',
    description: `Find one record by id from ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('findById'),
    handler: findByIdActionHandler,
    validation: {
      zodSchema: z.object({
        id: z.string().min(1, 'ID is required'),
      }),
    },
  };

  return newAction;
};

export const generateFindByIdsAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model<any, any>
) => {
  const findByIdsActionHandler: ActionHandler = async (data) => {
    const { ids } = data;

    if (!(ids && Array.isArray(ids)) || ids.length === 0) {
      const error_id = log({
        atFunction: 'findByIdsActionHandler',
        message: 'Missing or invalid ids array in payload',
        data,
        type: 'error',
      });
      return safeError('Missing or invalid ids array in payload', error_id);
    }

    const { data: result, error } = await model.findByIds(ids);

    if (error) {
      const _error_id = log({
        atFunction: 'findByIdsActionHandler',
        message: `Error finding records by ids in ${tableName}: ${error.message}`,
        data: error.details || {},
        type: 'error',
      });
      return safeError(
        `Error finding records by ids in ${tableName}`,
        'error-id'
      );
    }
    return Ok(result as any);
  };

  const newAction: Action = {
    name: 'findByIds',
    type: 'auto',
    description: `Find multiple records by ids from ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('findByIds'),
    handler: findByIdsActionHandler,
    validation: {
      zodSchema: z.object({
        ids: z.array(z.string()).min(1, 'At least one ID is required'),
      }),
    },
  };

  return newAction;
};

export const generateFindFirstAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model<any, any>
) => {
  const findFirstActionHandler: ActionHandler = async (data) => {
    const { filters } = data;

    // Convert filters object to Filter array
    const filterArray = filters
      ? Object.entries(filters).map(([key, value]) => ({
          where: key as any,
          equals: value,
        }))
      : [];

    const { data: result, error } = await model.findFirst(filterArray);

    if (error) {
      const error_id = log({
        atFunction: 'findFirstActionHandler',
        message: `Error finding record in ${tableName}: ${error.message}`,
        data: error.details || {},
        type: 'error',
      });
      return safeError(`Error finding record in ${tableName}`, error_id);
    }
    return Ok(result as any);
  };

  const newAction: Action = {
    name: 'findFirst',
    type: 'auto',
    description: `Find first record matching filters in ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('findFirst'),
    handler: findFirstActionHandler,
    validation: {
      zodSchema: z.object({
        filters: z.record(z.string(), z.any()).optional(),
      }),
    },
  };

  return newAction;
};

export const generateFindManyAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model<any, any>
) => {
  const findManyActionHandler: ActionHandler = async (data) => {
    const { page, perPage, sort, filters } = data;

    // Convert filters object to Filter array
    const filterArray = filters
      ? Object.entries(filters).map(([key, value]) => ({
          where: key as any,
          equals: value,
        }))
      : undefined;

    const { data: result, error } = await model.findMany({
      page,
      perPage,
      orderBy: sort?.map((s: any) => ({
        field: s.field as any,
        direction: s.direction as 'asc' | 'desc',
      })),
      filters: filterArray,
    });

    if (error) {
      const error_id = log({
        atFunction: 'findManyActionHandler',
        message: `Error finding records in ${tableName}: ${error.message}`,
        data: error.details || {},
        type: 'error',
      });
      return safeError(`Error finding records in ${tableName}`, error_id);
    }
    return Ok(result as any);
  };

  const newAction: Action = {
    name: 'findMany',
    type: 'auto',
    description: `Find multiple records with filters in ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('findMany'),
    handler: findManyActionHandler,
    validation: {
      zodSchema: z.object({
        page: z.number().optional(),
        perPage: z.number().optional(),
        sort: z.array(z.any()).optional(),
        filters: z.record(z.string(), z.any()).optional(),
      }),
    },
  };

  return newAction;
};
