import { log } from '@nile/src/internal.config';
import type { InferSelectModel, Table } from 'drizzle-orm';
import { and, count as drizzleCount, eq, type SQL } from 'drizzle-orm';
import { buildWhereClause } from './filters';
import type { Filter, ModelOptions, ModelResult } from './types';

/**
 * Creates utility operations for a model
 */
export function createUtilityOperations<TTable extends Table>(
  table: TTable,
  db: any,
  config: any,
  dialect: 'postgresql' | 'sqlite' = 'postgresql'
) {
  type SelectType = InferSelectModel<typeof table>;
  const tableAny = table as any;

  function buildCountConditions(
    filters: Filter<SelectType>[] | undefined,
    options: ModelOptions
  ): any[] {
    const conditions: any[] = [];

    // Apply filters
    if (filters && filters.length > 0) {
      const whereClause = buildWhereClause(table, filters, dialect);
      if (whereClause) {
        conditions.push(whereClause);
      }
    }

    // Apply soft delete filter if configured
    if (config.softDelete && !options.includeDeleted) {
      conditions.push(eq(tableAny[config.softDelete.field], null));
    }

    return conditions;
  }

  function buildCountQuery(conditions: any[], _db: any) {
    let query = _db.select({ count: drizzleCount() }).from(table);
    if (conditions.length > 0) {
      query = query.where(
        conditions.length === 1 ? conditions[0] : and(...conditions)
      );
    }
    return query;
  }

  function isNotFoundError(errorMessage: string): boolean {
    return (
      errorMessage.includes('Failed query') ||
      errorMessage.includes('invalid input syntax')
    );
  }

  const countRecords = async (
    filters?: Filter<SelectType>[],
    options: ModelOptions = {}
  ): Promise<ModelResult<number>> => {
    let _db = db;
    if (options?.transactionPointer) {
      _db = options.transactionPointer;
    }

    try {
      const conditions = buildCountConditions(filters, options);
      const query = buildCountQuery(conditions, _db);
      const result = await query;
      return { data: result[0]?.count || 0, error: null };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (isNotFoundError(errorMessage)) {
        return { data: 0, error: null };
      }

      log({
        atFunction: 'countRecords',
        message: `Error in countRecords: ${errorMessage}`,
        type: 'error',
        data: error,
      });
      return {
        data: null,
        error: {
          message: errorMessage,
          type: 'database',
          details: { originalError: error },
        },
      };
    }
  };

  const exists = async (
    filters: Filter<SelectType>[],
    options: ModelOptions = {}
  ): Promise<ModelResult<boolean>> => {
    try {
      const countResult = await countRecords(filters, options);
      if (countResult.error) {
        return {
          data: null,
          error: countResult.error,
        };
      }
      return { data: (countResult.data ?? 0) > 0, error: null };
    } catch (error) {
      log({
        atFunction: 'exists',
        message: `Error in exists: ${error instanceof Error ? error.message : String(error)}`,
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

  const distinct = async (
    field: keyof SelectType,
    filters?: Filter<SelectType>[],
    options: ModelOptions = {}
  ): Promise<ModelResult<any[]>> => {
    let _db: any = db;
    if (options?.transactionPointer) {
      _db = options.transactionPointer;
    }

    try {
      // Build conditions array to combine WHERE clauses properly
      const conditions: any[] = [];

      // Apply filters
      if (filters && filters.length > 0) {
        const whereClause = buildWhereClause(table, filters, dialect);
        if (whereClause) {
          conditions.push(whereClause);
        }
      }

      // Apply soft delete filter if configured and not explicitly including deleted
      if (config.softDelete && !options.includeDeleted) {
        conditions.push(eq(tableAny[config.softDelete.field], null));
      }

      let query = (_db as any)
        .select({ [field]: tableAny[field as string] })
        .from(table);

      if (conditions.length > 0) {
        query = query.where(
          conditions.length === 1 ? conditions[0] : and(...conditions)
        );
      }

      const result = await query;
      return { data: result.map((row: any) => row[field]), error: null };
    } catch (error) {
      log({
        atFunction: 'distinct',
        message: `Error in distinct: ${error instanceof Error ? error.message : String(error)}`,
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

  /**
   * INTERNAL USE ONLY - NOT EXPORTED
   * 
   * Executes raw SQL queries. This method is kept internal to the ORM layer
   * and is NOT exposed through the public Model interface for security reasons.
   * 
   * Raw SQL execution bypasses all validation, authorization, and security checks,
   * making it dangerous if exposed to external interfaces (REST/WebSocket/RPC).
   * 
   * @internal
   */
  const raw = async (sqlQuery: SQL): Promise<ModelResult<any>> => {
    const _db = db;

    try {
      let result: any = null;

      // SQLite uses .all() method, PostgreSQL uses .execute()
      if (dialect === 'sqlite') {
        // For SQLite, use all() method
        if (typeof (_db as any).all === 'function') {
          result = await (_db as any).all(sqlQuery);
          return { data: result || [], error: null };
        }
        // Fallback to execute if all() not available
        result = await (_db as any).execute(sqlQuery);
        const normalizedResult = Array.isArray(result)
          ? result
          : result.rows || result;
        return { data: normalizedResult, error: null };
      }
      // PostgreSQL
      result = await (_db as any).execute(sqlQuery);
      const normalizedResult = result.rows || [result];
      return { data: normalizedResult, error: null };
    } catch (error) {
      log({
        atFunction: 'raw',
        message: `Error in raw: ${error instanceof Error ? error.message : String(error)}`,
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

  const count = countRecords; // Alias for shorter naming

  // NOTE: raw() method is intentionally NOT exported for security reasons
  // See: /docs/ORM-SECURITY-BOUNDARIES.md
  return {
    count,
    countRecords,
    exists,
    distinct,
  };
}
