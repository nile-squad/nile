import { log } from '@nile/src/internal.config';
import { formatError } from '@nile/src/utils/erorr-formatter';
import { mergeChanges } from '@nile/src/utils/merge-changes';
import { getValidationSchema } from '@nile/src/utils/validation-utils';
import type { InferInsertModel, InferSelectModel, Table } from 'drizzle-orm';
import { and, eq, sql } from 'drizzle-orm';
import {
  buildWhereClause,
  detectJsonColumns,
  processJsonColumns,
} from './filters';
import type { Filter, ModelOptions, ModelResult } from './types';

/**
 * Creates bulk operations for a model
 */
export function createBulkOperations<TTable extends Table>(
  table: TTable,
  db: any,
  returnShape: Record<string, any> | null,
  config: any,
  dialect: 'postgresql' | 'sqlite' = 'postgresql',
  jsonMode: 'auto' | 'stringify' = 'auto'
) {
  type InsertType = InferInsertModel<typeof table>;
  type SelectType = InferSelectModel<typeof table>;
  const tableAny = table as any;

  // Get bulk operation limit from config or use default
  const bulkLimit = config.bulkOperationLimit || 1000;

  function buildUpdateValidator(options: ModelOptions) {
    const baseValidation = getValidationSchema({
      inferTable: table,
      validationMode: 'auto',
      context: { operation: 'update' },
    });

    if (options.validation) {
      return getValidationSchema({
        ...options.validation,
        inferTable: table,
        context: { operation: 'update' },
      });
    }

    return baseValidation;
  }

  function applyTimestampAutoUpdate(data: any): any {
    const dataWithTimestamp = { ...data };
    if (config.timestamps?.updatedAt) {
      dataWithTimestamp[config.timestamps.updatedAt] = new Date();
    }
    return dataWithTimestamp;
  }

  function buildWhereClauses(filters: Filter<SelectType>[]): any[] {
    const whereClauses: any[] = [];
    for (const filter of filters) {
      const condition = buildWhereClause(table, [filter], dialect);
      if (condition) {
        whereClauses.push(condition);
      }
    }
    return whereClauses;
  }

  function deepMergeJsonUpdates(
    records: any[],
    dataWithTimestamp: any,
    jsonColumns: string[]
  ): Array<{ id: string; data: any }> {
    const mergedUpdates: Array<{ id: string; data: any }> = [];

    for (const record of records || []) {
      const mergedData = { ...dataWithTimestamp };

      // Deep merge JSON columns
      for (const key of Object.keys(dataWithTimestamp)) {
        const value = dataWithTimestamp[key];
        if (
          jsonColumns.includes(key) &&
          value &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          record[key] &&
          typeof record[key] === 'object' &&
          !Array.isArray(record[key])
        ) {
          const { result: mergedValue } = mergeChanges(record[key], value);
          mergedData[key] = mergedValue;
        }
      }

      mergedUpdates.push({ id: record.id, data: mergedData });
    }

    return mergedUpdates;
  }

  async function executeIndividualUpdates(
    updates: Array<{ id: string; data: any }>,
    _db: any
  ): Promise<any[]> {
    const updatePromises = updates.map(async (update) => {
      const processedData = processJsonColumns(
        update.data,
        table,
        'stringify',
        dialect,
        jsonMode
      );
      const result = await _db
        .update(table)
        .set(processedData)
        .where(eq(tableAny.id, update.id))
        .returning();

      if (result && result.length > 0) {
        return processJsonColumns(result[0], table, 'parse', dialect, jsonMode);
      }
      return null;
    });

    const results = await Promise.all(updatePromises);
    return results.filter((r): r is any => r !== null);
  }
  const createMany = async (
    data: InsertType[],
    options: ModelOptions = {}
  ): Promise<ModelResult<SelectType[]>> => {
    // Check bulk operation limit
    if (data.length > bulkLimit) {
      return {
        data: null,
        error: {
          message: `Bulk operation limit exceeded. Maximum ${bulkLimit} records allowed.`,
          type: 'validation',
          details: { limit: bulkLimit, provided: data.length },
        },
      };
    }

    // Validate all items with Zod schema
    let validator = getValidationSchema({
      inferTable: table,
      validationMode: 'auto',
      context: { operation: 'create' },
    });

    if (options.validation) {
      validator = getValidationSchema({
        ...options.validation,
        inferTable: table,
        context: { operation: 'create' },
      });
    }

    const validatedData: any[] = [];
    const validationErrors: string[] = [];

    for (const item of data) {
      const parsed = validator.safeParse(item);
      if (parsed.success) {
        validatedData.push(parsed.data);
      } else {
        const formattedError = formatError(parsed.error);
        validationErrors.push(
          `Validation failed for item: ${JSON.stringify(formattedError)}`
        );
      }
    }

    // If all items failed validation, return error
    if (validatedData.length === 0 && validationErrors.length > 0) {
      return {
        data: null,
        error: {
          message: 'All items failed validation',
          type: 'validation',
          details: { errors: validationErrors },
        },
      };
    }

    // If some items failed validation, return partial success
    if (validationErrors.length > 0) {
      // Continue with validated items, track partial failure
    }

    const validData = validatedData;

    let _db: any = db;
    if (options?.transactionPointer) {
      _db = options.transactionPointer;
    }

    try {
      const processedData = validData.map((item) =>
        processJsonColumns(item, table, 'stringify', dialect, jsonMode)
      );
      const result = returnShape
        ? await (_db as any)
            .insert(table)
            .values(processedData)
            .returning(returnShape)
        : await (_db as any).insert(table).values(processedData).returning();

      const processed =
        result?.map((row: any) =>
          processJsonColumns(row, table, 'parse', dialect, jsonMode)
        ) ?? null;
      return { data: processed, error: null };
    } catch (error) {
      log({
        atFunction: 'createMany',
        message: `Error in createMany: ${error instanceof Error ? error.message : String(error)}`,
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

  const updateMany = async (
    filters: Filter<SelectType>[],
    data: Partial<SelectType>,
    options: ModelOptions = {}
  ): Promise<ModelResult<SelectType[]>> => {
    // Validate data
    const validator = buildUpdateValidator(options);
    const parsed = validator.safeParse(data);

    if (!parsed.success) {
      const formattedError = formatError(parsed.error);
      return {
        data: null,
        error: {
          message: 'Validation failed',
          type: 'validation',
          details: { fields: formattedError },
        },
      };
    }

    // Auto-update timestamp if configured
    const dataWithTimestamp = applyTimestampAutoUpdate(parsed.data);

    let _db: any = db;
    if (options?.transactionPointer) {
      _db = options.transactionPointer;
    }

    try {
      // Build WHERE clauses and fetch existing records
      const whereClauses = buildWhereClauses(filters);
      let query = _db.select().from(table);

      if (whereClauses.length > 0) {
        query = query.where(
          whereClauses.length === 1 ? whereClauses[0] : and(...whereClauses)
        );
      }

      const existingRecords = await query;

      // Deep merge JSON updates
      const jsonColumns = detectJsonColumns(table, dialect);
      const mergedUpdates = deepMergeJsonUpdates(
        existingRecords,
        dataWithTimestamp,
        jsonColumns
      );

      // Execute individual updates
      const processedResults = await executeIndividualUpdates(
        mergedUpdates,
        _db
      );

      return { data: processedResults, error: null };
    } catch (error) {
      log({
        atFunction: 'updateMany',
        message: `Error in updateMany: ${error instanceof Error ? error.message : String(error)}`,
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

  const deleteMany = async (
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

      if (config.softDelete) {
        // Soft delete
        const result = returnShape
          ? await _db
              .update(table)
              .set({ [config.softDelete.field]: new Date() } as any)
              .where(and(...whereClauses))
              .returning(returnShape)
          : await _db
              .update(table)
              .set({ [config.softDelete.field]: new Date() } as any)
              .where(and(...whereClauses))
              .returning();

        const processed =
          result?.map((row: any) =>
            processJsonColumns(row, table, 'parse', dialect, jsonMode)
          ) ?? [];
        return { data: processed, error: null };
      }
      // Hard delete
      const result = returnShape
        ? await _db
            .delete(table)
            .where(and(...whereClauses))
            .returning(returnShape)
        : await _db
            .delete(table)
            .where(and(...whereClauses))
            .returning();

      const processed =
        result?.map((row: any) =>
          processJsonColumns(row, table, 'parse', dialect, jsonMode)
        ) ?? [];
      return { data: processed, error: null };
    } catch (error) {
      log({
        atFunction: 'deleteMany',
        message: `Error in deleteMany: ${error instanceof Error ? error.message : String(error)}`,
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

  const upsert = async (
    data: InsertType & { id: string },
    options: ModelOptions = {}
  ): Promise<ModelResult<SelectType>> => {
    let _db: any = db;
    if (options?.transactionPointer) {
      _db = options.transactionPointer;
    }

    try {
      const processedData = processJsonColumns(
        data,
        table,
        'stringify',
        dialect,
        jsonMode
      );

      // Build update set object with timestamp if configured
      const setObject: any = { ...processedData };
      if (config.timestamps?.updatedAt) {
        setObject[config.timestamps.updatedAt] = new Date();
      }

      const result = await _db
        .insert(table)
        .values(processedData)
        .onConflictDoUpdate({
          target: tableAny.id,
          set: setObject,
        })
        .returning();

      const processed = result[0]
        ? processJsonColumns(result[0], table, 'parse', dialect, jsonMode)
        : null;

      if (!processed) {
        return {
          data: null,
          error: {
            message: 'Failed to upsert record',
            type: 'database',
            details: { originalError: 'No data returned from upsert' },
          },
        };
      }
      return { data: processed, error: null };
    } catch (error) {
      log({
        atFunction: 'upsert',
        message: `Error in upsert: ${error instanceof Error ? error.message : String(error)}`,
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

  const upsertMany = async (
    data: (InsertType & { id: string })[],
    options: ModelOptions = {}
  ): Promise<ModelResult<SelectType[]>> => {
    if (data.length > bulkLimit) {
      return {
        data: null,
        error: {
          message: `Bulk operation limit exceeded. Maximum ${bulkLimit} records allowed.`,
          type: 'validation',
          details: { limit: bulkLimit, provided: data.length },
        },
      };
    }

    let _db: any = db;
    if (options?.transactionPointer) {
      _db = options.transactionPointer;
    }

    try {
      const processedData = data.map((item) =>
        processJsonColumns(item, table, 'stringify', dialect, jsonMode)
      );

      // Build update set object - normalize for SQLite and PostgreSQL
      const columns = Object.keys(processedData[0] || {});
      const setObject: any = {};

      // For SQLite, use 'excluded.' prefix; for PostgreSQL, Drizzle handles this
      for (const col of columns) {
        if (col !== 'id') {
          const colRef = tableAny[col];
          if (dialect === 'sqlite') {
            setObject[col] = sql`excluded.${colRef}`;
          } else {
            // PostgreSQL - Drizzle's SQL template handles this
            setObject[col] = sql`excluded.${colRef}`;
          }
        }
      }

      // Add timestamp if configured
      if (config.timestamps?.updatedAt) {
        setObject[config.timestamps.updatedAt] = new Date();
      }

      const result = await _db
        .insert(table)
        .values(processedData)
        .onConflictDoUpdate({
          target: tableAny.id,
          set: setObject,
        })
        .returning();

      const processed =
        result?.map((row: any) =>
          processJsonColumns(row, table, 'parse', dialect, jsonMode)
        ) ?? [];
      return { data: processed, error: null };
    } catch (error) {
      log({
        atFunction: 'upsertMany',
        message: `Error in upsertMany: ${error instanceof Error ? error.message : String(error)}`,
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
    createMany,
    updateMany,
    deleteMany,
    upsert,
    upsertMany,
  };
}
