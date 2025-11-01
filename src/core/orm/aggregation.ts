import { log } from '@nile/src/internal.config';
import type { InferSelectModel } from 'drizzle-orm';
import { and, asc, avg, count, desc, max, min, sum } from 'drizzle-orm';
import { buildWhereClause, processJsonColumns } from './filters';
import type {
  AggregateOptions,
  AggregateResult,
  Filter,
  GroupByOptions,
  GroupByResult,
  ModelResult,
} from './types';

/**
 * Creates aggregation operations for a model
 */
export function createAggregationOperations<TTable>(
  table: TTable,
  db: any,
  dialect: 'postgresql' | 'sqlite' = 'postgresql'
) {
  const tableAny = table as any;
  type SelectType = InferSelectModel<typeof tableAny>;

  function buildSelectObjectForGroupBy(
    field: keyof SelectType,
    options: GroupByOptions<SelectType>
  ): any {
    const column = tableAny[field as string];
    const selectObj: any = { [field]: column };

    if (options.count) {
      selectObj.count = count(tableAny[options.count as string]);
    }
    if (options.sum) {
      selectObj.sum = sum(tableAny[options.sum as string]);
    }
    if (options.avg) {
      selectObj.avg = avg(tableAny[options.avg as string]);
    }
    if (options.min) {
      selectObj.min = min(tableAny[options.min as string]);
    }
    if (options.max) {
      selectObj.max = max(tableAny[options.max as string]);
    }

    return selectObj;
  }

  function applyFilters(query: any, filters?: Filter<SelectType>[]): any {
    let result = query;
    if (filters && filters.length > 0) {
      const conditions = filters
        .map((f) => buildWhereClause(table, [f]))
        .filter((c): c is any => c !== undefined);
      if (conditions.length > 0) {
        result = result.where(and(...conditions));
      }
    }
    return result;
  }

  function applyHaving(query: any, having?: Filter<SelectType>[]): any {
    let result = query;
    if (having && having.length > 0) {
      const havingConditions = having
        .map((f) => buildWhereClause(table, [f]))
        .filter((c): c is any => c !== undefined);
      if (havingConditions.length > 0) {
        result = result.having(and(...havingConditions));
      }
    }
    return result;
  }

  function applyOrdering(query: any, orderBy?: any): any {
    let result = query;
    if (orderBy && orderBy.length > 0) {
      for (const order of orderBy) {
        if ('sql' in order) {
          result = result.orderBy(order.sql);
        } else {
          const direction = order.direction === 'desc' ? desc : asc;
          const orderColumn = tableAny[order.field as string];
          result = result.orderBy(direction(orderColumn));
        }
      }
    }
    return result;
  }

  const aggregate = async (
    fieldOrOptions: keyof SelectType | AggregateOptions<SelectType>,
    operation?: 'sum' | 'avg' | 'min' | 'max' | 'count'
  ): Promise<ModelResult<AggregateResult>> => {
    const _db = db;

    try {
      let options: AggregateOptions<SelectType>;

      // Handle both signatures
      if (typeof fieldOrOptions === 'string' && operation) {
        // Simple signature: aggregate(field, operation)
        options = {
          functions: [
            {
              field: fieldOrOptions,
              operation,
            },
          ],
        };
      } else {
        // Complex signature: aggregate(options)
        options = fieldOrOptions as AggregateOptions<SelectType>;
      }

      const selectObj: any = {};
      for (const func of options.functions) {
        const alias = func.alias || func.operation;
        const column = tableAny[func.field as string];

        switch (func.operation) {
          case 'sum':
            selectObj[alias] = sum(column);
            break;
          case 'avg':
            selectObj[alias] = avg(column);
            break;
          case 'min':
            selectObj[alias] = min(column);
            break;
          case 'max':
            selectObj[alias] = max(column);
            break;
          case 'count':
            selectObj[alias] = count(column);
            break;
          default:
            // Unknown operation, skip
            break;
        }
      }

      let query = (_db as any).select(selectObj).from(table);

      if (options.filters && options.filters.length > 0) {
        const conditions = options.filters
          .map((f) => buildWhereClause(table, [f]))
          .filter((c): c is any => c !== undefined);
        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
      }

      const result = await query;
      const processedResult = result[0] || {};

      // Normalize numeric values to ensure consistency across dialects
      const normalized = normalizeNumericValues(processedResult);

      return { data: { data: normalized, errors: [] }, error: null };
    } catch (error) {
      log({
        atFunction: 'aggregate',
        message: `Error in aggregate: ${error instanceof Error ? error.message : String(error)}`,
        type: 'error',
        data: error,
      });
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Database error',
          type: 'database',
          details: { originalError: error },
        },
      };
    }
  };

  function normalizeNumericValues(obj: any): any {
    const normalized: any = {};
    for (const key in obj) {
      const value = obj[key];
      // Convert string numbers to actual numbers for consistency across dialects
      if (
        typeof value === 'string' &&
        !Number.isNaN(Number(value)) &&
        value.trim() !== ''
      ) {
        normalized[key] = Number(value);
      } else if (typeof value === 'bigint') {
        normalized[key] = Number(value);
      } else {
        normalized[key] = value;
      }
    }
    return normalized;
  }

  const groupBy = async (
    field: keyof SelectType,
    options: GroupByOptions<SelectType> = {}
  ): Promise<ModelResult<GroupByResult<SelectType>>> => {
    const _db = db;
    const column = tableAny[field as string];

    try {
      // Build select object with group field and aggregations
      const selectObj = buildSelectObjectForGroupBy(field, options);

      // Build base query
      let query = _db.select(selectObj).from(table).groupBy(column);

      // Apply filters
      query = applyFilters(query, options.filters);

      // Apply having
      query = applyHaving(query, options.having);

      // Apply ordering
      query = applyOrdering(query, options.orderBy);

      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const result = await query;
      const processed =
        result?.map((row: any) => processJsonColumns(row, table, 'parse')) ??
        [];

      // Normalize numeric values to ensure consistency across dialects
      const normalized = processed.map((row: any) =>
        normalizeNumericValues(row)
      );

      return { data: { data: normalized, errors: [] }, error: null };
    } catch (error) {
      log({
        atFunction: 'groupBy',
        message: `Error in groupBy: ${error instanceof Error ? error.message : String(error)}`,
        type: 'error',
        data: error,
      });
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Database error',
          type: 'database',
          details: { originalError: error },
        },
      };
    }
  };

  return {
    aggregate,
    groupBy,
  };
}
