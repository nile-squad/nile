import { log } from '@nile/src/internal.config';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import { buildWhereClause, processJsonColumns } from './filters';
import type { Filter, ModelOptions, ModelResult } from './types';

// Import BulkOperationResult type if needed

/**
 * Creates soft delete operations for a model
 */
export function createSoftDeleteOperations<TTable>(
  table: TTable,
  db: any,
  returnShape: Record<string, any> | null,
  config: any,
  dialect: 'postgresql' | 'sqlite' = 'postgresql'
) {
  const tableAny = table as any;
  type SelectType = InferSelectModel<typeof tableAny>;

  const restore = async (
    id: string,
    options: ModelOptions = {}
  ): Promise<ModelResult<SelectType>> => {
    let _db: any = db;
    if (options?.transactionPointer) {
      _db = options.transactionPointer;
    }

    try {
      const _dbCast = _db as any;
      const result = returnShape
        ? await _dbCast
            .update(table)
            .set({ [config.softDelete?.field || 'deletedAt']: null } as any)
            .where(eq(tableAny.id, id))
            .returning(returnShape)
        : await _dbCast
            .update(table)
            .set({ [config.softDelete?.field || 'deletedAt']: null } as any)
            .where(eq(tableAny.id, id))
            .returning();

      const data = result[0]
        ? processJsonColumns(result[0], table, 'parse')
        : null;

      if (!data) {
        return {
          data: null,
          error: {
            message: `No record found for id = ${id}`,
            type: 'database',
            details: { id },
          },
        };
      }

      return { data, error: null };
    } catch (error) {
      log({
        atFunction: 'restore',
        message: `Error in restore: ${error instanceof Error ? error.message : String(error)}`,
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

  const restoreMany = async (
    filters: Filter<SelectType>[],
    options: ModelOptions = {}
  ): Promise<ModelResult<SelectType[]>> => {
    let _db: any = db;
    if (options?.transactionPointer) {
      _db = options.transactionPointer;
    }

    try {
      const whereClauses: any[] = [];
      for (const filter of filters) {
        const condition = buildWhereClause(table, [filter]);
        if (condition) {
          whereClauses.push(condition);
        }
      }

      const _dbCast = _db as any;
      const result = returnShape
        ? await _dbCast
            .update(table)
            .set({ [config.softDelete?.field || 'deletedAt']: null } as any)
            .where(and(...whereClauses))
            .returning(returnShape)
        : await _dbCast
            .update(table)
            .set({ [config.softDelete?.field || 'deletedAt']: null } as any)
            .where(and(...whereClauses))
            .returning();

      const processed =
        result?.map((row: any) => processJsonColumns(row, table, 'parse')) ??
        [];
      return { data: processed, error: null };
    } catch (error) {
      log({
        atFunction: 'restoreMany',
        message: `Error in restoreMany: ${error instanceof Error ? error.message : String(error)}`,
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

  const forceDelete = async (
    id: string,
    options: ModelOptions = {}
  ): Promise<ModelResult<SelectType>> => {
    let _db: any = db;
    if (options?.transactionPointer) {
      _db = options.transactionPointer;
    }

    try {
      const _dbCast = _db as any;
      const result = returnShape
        ? await _dbCast
            .delete(table)
            .where(eq(tableAny.id, id))
            .returning(returnShape)
        : await _dbCast.delete(table).where(eq(tableAny.id, id)).returning();

      const data = result[0]
        ? processJsonColumns(result[0], table, 'parse')
        : null;

      if (!data) {
        return {
          data: null,
          error: {
            message: `No record found for id = ${id}`,
            type: 'database',
            details: { id },
          },
        };
      }

      return { data, error: null };
    } catch (error) {
      log({
        atFunction: 'forceDelete',
        message: `Error in forceDelete: ${error instanceof Error ? error.message : String(error)}`,
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

  const forceDeleteMany = async (
    filters: Filter<SelectType>[],
    options: ModelOptions = {}
  ): Promise<ModelResult<SelectType[]>> => {
    let _db: any = db;
    if (options?.transactionPointer) {
      _db = options.transactionPointer;
    }

    try {
      const whereClauses: any[] = [];
      for (const filter of filters) {
        const condition = buildWhereClause(table, [filter]);
        if (condition) {
          whereClauses.push(condition);
        }
      }

      const _dbCast = _db as any;
      const result = returnShape
        ? await _dbCast
            .delete(table)
            .where(and(...whereClauses))
            .returning(returnShape)
        : await _dbCast
            .delete(table)
            .where(and(...whereClauses))
            .returning();

      const processed =
        result?.map((row: any) => processJsonColumns(row, table, 'parse')) ??
        [];
      return { data: processed, error: null };
    } catch (error) {
      log({
        atFunction: 'forceDeleteMany',
        message: `Error in forceDeleteMany: ${error instanceof Error ? error.message : String(error)}`,
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
    restore,
    restoreMany,
    forceDelete,
    forceDeleteMany,
  };
}
