import { log } from '@nile/src/internal.config';
import { formatError } from '@nile/src/utils/erorr-formatter';
import { getChanges } from '@nile/src/utils/get-changes';
import { mergeChanges } from '@nile/src/utils/merge-changes';
import { getValidationSchema } from '@nile/src/utils/validation-utils';
import type { InferInsertModel, InferSelectModel, Table } from 'drizzle-orm';
import { and, count, eq, inArray, isNull } from 'drizzle-orm';
import {
  buildOrderClause,
  buildWhereClause,
  detectJsonColumns,
  processJsonColumns,
} from './filters';
import type {
  Filter,
  FindManyOptions,
  ModelOptions,
  ModelResult,
  PaginatedResult,
} from './types';

/**
 * Creates CRUD operations for a model.
 *
 * @note `db` parameter is `any` to support multiple Drizzle adapters (PostgreSQL, SQLite, MySQL).
 * Model types (TSelect, TInsert) remain strongly typed for end-user safety.
 */
export function createCrudOperations<TTable extends Table>(
  table: TTable,
  db: any, // Simplified to any for multi-driver support
  returnShape: Record<string, any> | null,
  config: any,
  dialect: 'postgresql' | 'sqlite' = 'postgresql',
  jsonMode: 'auto' | 'stringify' = 'auto'
) {
  type InsertType = InferInsertModel<typeof table>;
  type SelectType = InferSelectModel<typeof table>;
  const tableAny = table as any;

  function buildQueryConditions(
    filters: Filter<SelectType>[],
    options: ModelOptions
  ): any[] {
    const whereClause = buildWhereClause(table, filters, dialect);
    const conditions: any[] = [];
    if (whereClause) {
      conditions.push(whereClause);
    }

    if (config.softDelete && !options.includeDeleted) {
      conditions.push(isNull(tableAny[config.softDelete.field]));
    }

    return conditions;
  }

  function buildFindQuery(options: FindManyOptions<SelectType>, _db: any): any {
    const selectObj = buildSelectObject(options.select);
    const query = selectObj
      ? (_db as any).select(selectObj).from(table)
      : (_db as any).select().from(table);

    return query;
  }

  function applyQueryFilters(query: any, conditions: any[]): any {
    let result = query;
    if (conditions.length > 0) {
      result = result.where(
        conditions.length === 1 ? conditions[0] : and(...conditions)
      );
    }
    return result;
  }

  function applyOrdering(query: any, orderBy: any): any {
    let result = query;
    const orderClauses = buildOrderClause(table, orderBy);
    if (orderClauses.length > 0) {
      result = result.orderBy(...orderClauses);
    }
    return result;
  }

  function applyPagination(
    query: any,
    options: FindManyOptions<SelectType>
  ): any {
    const { page, perPage, limit = 50, offset = 0 } = options;
    let result = query;

    if (page && perPage) {
      const actualOffset = (page - 1) * perPage;
      result = result.limit(perPage).offset(actualOffset);
    } else {
      result = result.limit(limit).offset(offset);
    }

    return result;
  }

  function applyDistinct(
    query: any,
    distinct: keyof SelectType | undefined
  ): any {
    let result = query;
    if (distinct) {
      result = result.distinct({ columns: [tableAny[distinct]] });
    }
    return result;
  }

  async function executeCountQuery(
    conditions: any[],
    _db: any
  ): Promise<number> {
    let countQuery = _db.select({ count: count() }).from(table);

    if (conditions.length > 0) {
      countQuery = countQuery.where(
        conditions.length === 1 ? conditions[0] : and(...conditions)
      );
    }

    const countResult = await countQuery;
    return countResult[0]?.count || 0;
  }

  function processJsonUpdates(
    changes: Partial<SelectType>,
    oldData: SelectType,
    jsonColumns: string[]
  ): Record<string, any> {
    const dataChanges: Record<string, any> = { ...changes };

    for (const key of Object.keys(changes)) {
      const value = changes[key as keyof SelectType];

      if (
        jsonColumns.includes(key) &&
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        oldData[key as keyof SelectType] &&
        typeof oldData[key as keyof SelectType] === 'object' &&
        !Array.isArray(oldData[key as keyof SelectType])
      ) {
        const existingData = oldData[key as keyof SelectType];

        if (
          existingData &&
          typeof existingData === 'object' &&
          !Array.isArray(existingData)
        ) {
          const { result: mergedResult } = mergeChanges(existingData, value);

          dataChanges[key] = JSON.stringify(mergedResult);
        }
      }
    }

    return dataChanges;
  }

  function getUpdateValidator(options: ModelOptions) {
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

  const buildSelectObject = (fields?: (keyof any)[]) => {
    if (!fields || fields.length === 0) {
      return;
    }
    const selectObj: Record<string, any> = {};
    for (const field of fields) {
      if (tableAny[field as string]) {
        selectObj[field as string] = tableAny[field as string];
      }
    }
    return selectObj;
  };

  function processResult(result: any[]): SelectType | null {
    return result[0]
      ? processJsonColumns(result[0], table, 'parse', dialect, jsonMode)
      : null;
  }

  function handleError(error: any): ModelResult<SelectType> {
    if (error instanceof Error && error.name === 'Error' && error.message) {
      return {
        data: null,
        error: {
          message: error.message,
          type: 'validation',
          details: { originalError: error },
        },
      };
    }
    log({
      atFunction: 'findFirst',
      message: `Error in findFirst: ${error instanceof Error ? error.message : String(error)}`,
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

  const findFirst = async (
    filters: Filter<SelectType>[],
    options: ModelOptions = {}
  ): Promise<ModelResult<SelectType>> => {
    const _db = options.transactionPointer || db;
    try {
      const conditions = buildQueryConditions(filters, options);
      const selectObj = buildSelectObject(options.select);
      let query = selectObj
        ? (_db as any).select(selectObj).from(table)
        : (_db as any).select().from(table);
      query = applyQueryFilters(query, conditions);
      const result = await query.limit(1);
      const data = processResult(result);
      return { data, error: null };
    } catch (error) {
      return handleError(error);
    }
  };

  // CRUD methods
  // ... [all CRUD method implementations from backup] ...

  const findById = async (
    id: string,
    options: ModelOptions = {}
  ): Promise<ModelResult<SelectType>> => {
    let _db: any = db;
    if (options?.transactionPointer) {
      _db = options.transactionPointer;
    }
    try {
      // Build conditions array to combine WHERE clauses properly
      const conditions: any[] = [eq(tableAny.id, id)];
      // Apply soft delete filter if configured and not explicitly including deleted
      if (config.softDelete && !options.includeDeleted) {
        conditions.push(isNull(tableAny[config.softDelete.field]));
      }
      // Build select object for field projection
      const selectObj = buildSelectObject(options.select);
      let query = selectObj
        ? (_db as any).select(selectObj).from(table)
        : (_db as any).select().from(table);
      if (conditions.length > 0) {
        query = query.where(
          conditions.length === 1 ? conditions[0] : and(...conditions)
        );
      }
      const result = await query.limit(1);
      // If no result found, return null data with no error
      if (!result || result.length === 0 || !result[0]) {
        return { data: null, error: null };
      }
      const data = processJsonColumns(
        result[0],
        table,
        'parse',
        dialect,
        jsonMode
      );
      return { data, error: null };
    } catch (error) {
      // Check if error is due to invalid UUID (not found scenario)
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes('Failed query') ||
        errorMessage.includes('invalid input syntax')
      ) {
        // Invalid ID or query failure - treat as "not found"
        return { data: null, error: null };
      }
      log({
        atFunction: 'findById',
        message: `Error in findById: ${errorMessage}`,
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

  const findByIds = async (
    ids: string[],
    options: ModelOptions = {}
  ): Promise<ModelResult<SelectType[]>> => {
    let _db = db;
    if (options?.transactionPointer) {
      _db = options.transactionPointer;
    }
    try {
      // Build conditions array to combine WHERE clauses properly
      const conditions: any[] = [inArray(tableAny.id, ids)];
      // Apply soft delete filter if configured and not explicitly including deleted
      if (config.softDelete && !options.includeDeleted) {
        conditions.push(isNull(tableAny[config.softDelete.field]));
      }
      // Build select object for field projection
      const selectObj = buildSelectObject(options.select);
      let query = selectObj
        ? (_db as any).select(selectObj).from(table)
        : (_db as any).select().from(table);
      if (conditions.length > 0) {
        query = query.where(
          conditions.length === 1 ? conditions[0] : and(...conditions)
        );
      }
      const result = await query;
      const data =
        result?.map((row: any) =>
          processJsonColumns(row, table, 'parse', dialect, jsonMode)
        ) ?? [];
      return { data, error: null };
    } catch (error) {
      log({
        atFunction: 'findByIds',
        message: `Error in findByIds: ${error instanceof Error ? error.message : String(error)}`,
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

  // ... [rest of CRUD methods unchanged] ...

  const findMany = async (
    options: FindManyOptions<SelectType> = {}
  ): Promise<ModelResult<SelectType[] | PaginatedResult<SelectType>>> => {
    let _db = db;
    if (options?.transactionPointer) {
      _db = options.transactionPointer;
    }
    const { filters = [], orderBy, distinct, page, perPage } = options;
    // Helper to build conditions safely
    const getConditions = (): any[] => {
      try {
        return buildQueryConditions(filters, options) ?? [];
      } catch (filterError) {
        const errMsg =
          filterError instanceof Error
            ? filterError.message
            : String(filterError);
        throw new Error(`Validation error: ${errMsg}`);
      }
    };
    try {
      const conditions = getConditions();
      let query = buildFindQuery(options, _db);
      query = applyQueryFilters(query, conditions);
      query = applyOrdering(query, orderBy);
      query = applyPagination(query, options);
      query = applyDistinct(query, distinct);
      // Execute query
      const result = await query;
      const processed: SelectType[] =
        result?.map((row: any) =>
          processJsonColumns(row, table, 'parse', dialect, jsonMode)
        ) ?? [];
      // Handle pagination metadata
      if (page && perPage) {
        const totalItems = await executeCountQuery(conditions, _db);
        const totalPages = Math.ceil(totalItems / perPage);
        return {
          data: {
            items: processed,
            meta: {
              totalItems,
              totalPages,
              currentPage: page,
              perPage,
              hasNextPage: page < totalPages,
              hasPreviousPage: page > 1,
            },
          },
          error: null,
        };
      }
      return { data: processed, error: null };
    } catch (error: any) {
      if (error?.type === 'validation') {
        return {
          data: null,
          error: {
            message: error.message,
            type: error.type,
            details: error.details,
          },
        };
      }
      log({
        atFunction: 'findMany',
        message: `Error in findMany: ${error instanceof Error ? error.message : String(error)}`,
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
   * Finds a single record by ID with related data using Drizzle relations.
   *
   * @param id - The unique identifier of the record
   * @param relations - Object specifying which relations to include (Drizzle relations API)
   * @param options - Optional model options (transactions, soft delete inclusion)
   * @returns ModelResult with the record including related data
   *
   * @note This method requires the Drizzle query API (e.g., PostgreSQL with relations).
   * SQLite and some drivers may not support relations.
   *
   * @example
   * const { data, error } = await userModel.findWithRelations('user-123', {
   *   posts: true,
   *   comments: { with: { author: true } }
   * });
   */
  const findWithRelations = async (
    id: string,
    relations: any,
    options: ModelOptions = {}
  ): Promise<ModelResult<SelectType>> => {
    let _db = db;
    if (options?.transactionPointer) {
      _db = options.transactionPointer;
    }
    try {
      // Check if query API exists (required for relations)
      if (!(_db as any).query) {
        return {
          data: null,
          error: {
            message:
              "Relations API not supported by current database driver. This feature requires Drizzle's query API.",
            type: 'database',
            details: {
              feature: 'findWithRelations',
              driver: 'unknown',
              suggestion:
                'Use a database driver that supports Drizzle relations (e.g., PostgreSQL)',
            },
          },
        };
      }
      const tableAnyLocal = table as any;
      const tableName = tableAnyLocal._.name || tableAnyLocal.name;
      if (!tableName) {
        return {
          data: null,
          error: {
            message: 'Unable to determine table name for relations query',
            type: 'database',
            details: { feature: 'findWithRelations' },
          },
        };
      }
      const data = await ((_db as any).query as any)[tableName].findFirst({
        where: eq(tableAny.id, id),
        with: relations,
      });
      const processed = data
        ? processJsonColumns(data, table, 'parse', dialect, jsonMode)
        : null;
      return { data: processed, error: null };
    } catch (error) {
      log({
        atFunction: 'findWithRelations',
        message: `Error in findWithRelations: ${error instanceof Error ? error.message : String(error)}`,
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

  const create = async (
    data: InsertType,
    options: ModelOptions = {}
  ): Promise<ModelResult<SelectType>> => {
    // Validate data with Zod schema
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
    // Convert JSON columns to string if necessary before insert
    // Note: For SQLite text columns with mode: 'json', Drizzle handles this automatically
    const dataToInsert = processJsonColumns(
      data,
      table,
      'stringify',
      dialect,
      jsonMode
    );
    let _db = db;
    if (options?.transactionPointer) {
      _db = options.transactionPointer;
    }
    try {
      const result = returnShape
        ? await (_db as any)
            .insert(table)
            .values(dataToInsert)
            .returning(returnShape)
        : await (_db as any).insert(table).values(dataToInsert).returning();
      // Parse JSON columns on result
      // Note: For SQLite text columns with mode: 'json', Drizzle returns objects directly
      const processedData = result[0]
        ? processJsonColumns(result[0], table, 'parse', dialect, jsonMode)
        : null;
      if (!processedData) {
        return {
          data: null,
          error: {
            message: 'No data returned from insert',
            type: 'database',
            details: { originalError: 'No data returned from insert' },
          },
        };
      }
      return { data: processedData, error: null };
    } catch (error) {
      log({
        atFunction: 'create',
        message: `Error in create: ${error instanceof Error ? error.message : String(error)}`,
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

  const update = async (
    id: string,
    data: Partial<SelectType>,
    options: ModelOptions = {}
  ): Promise<ModelResult<SelectType>> => {
    // Validate data with Zod schema
    const validator = getUpdateValidator(options);
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
    // Get current data for change detection
    try {
      const oldDataRaw = await (db as any)
        .select()
        .from(table)
        .where(eq(tableAny.id, id))
        .limit(1);
      if (!oldDataRaw || oldDataRaw.length === 0) {
        return {
          data: null,
          error: {
            message: `No record found for id = ${id}`,
            type: 'database',
            details: { id },
          },
        };
      }
      // Parse JSON columns in oldData for proper comparison
      const oldData = [
        processJsonColumns(oldDataRaw[0], table, 'parse', dialect, jsonMode),
      ];
      const changes = getChanges(oldData[0], data);
      if (Object.keys(changes).length === 0) {
        log({
          atFunction: 'update',
          message: 'No values to update',
          type: 'warn',
        });
        return {
          data: null,
          error: {
            message: 'No values to update',
            type: 'validation',
            details: { id },
          },
        };
      }
      // Auto-update timestamp if configured
      if (
        config.timestamps?.updatedAt &&
        tableAny[config.timestamps.updatedAt]
      ) {
        (changes as any)[config.timestamps.updatedAt] = new Date();
      }
      // Merge JSON objects if needed
      const jsonColumns = detectJsonColumns(table, dialect);
      const dataChanges = processJsonUpdates(changes, oldData[0], jsonColumns);
      let _db = db;
      if (options?.transactionPointer) {
        _db = options.transactionPointer;
      }
      const updateResult = returnShape
        ? await (_db as any)
            .update(table)
            .set(dataChanges)
            .where(eq(tableAny.id, id))
            .returning(returnShape)
        : await (_db as any)
            .update(table)
            .set(dataChanges)
            .where(eq(tableAny.id, id))
            .returning();
      const processedData = updateResult[0]
        ? processJsonColumns(updateResult[0], table, 'parse', dialect, jsonMode)
        : null;
      return { data: processedData, error: null };
    } catch (error) {
      log({
        atFunction: 'update',
        message: `Error in update: ${error instanceof Error ? error.message : String(error)}`,
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

  const deleteById = async (
    id: string,
    options: ModelOptions = {}
  ): Promise<ModelResult<void>> => {
    let _db = db;
    if (options?.transactionPointer) {
      _db = options.transactionPointer;
    }
    try {
      // Check if record exists first
      const existingRecord = await (_db as any)
        .select()
        .from(table)
        .where(eq(tableAny.id, id))
        .limit(1);
      if (!existingRecord || existingRecord.length === 0) {
        // No record found - return success (idempotent delete)
        return { data: null, error: null };
      }
      if (config.softDelete) {
        // Soft delete
        await (_db as any)
          .update(table)
          .set({ [config.softDelete.field]: new Date() } as any)
          .where(eq(tableAny.id, id));
      } else {
        // Hard delete
        await (_db as any).delete(table).where(eq(tableAny.id, id));
      }
      return { data: null, error: null };
    } catch (error) {
      // Check if error is due to invalid UUID (not found scenario)
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes('Failed query') ||
        errorMessage.includes('invalid input syntax')
      ) {
        // Invalid ID - treat as idempotent success
        return { data: null, error: null };
      }
      log({
        atFunction: 'deleteById',
        message: `Error in delete: ${errorMessage}`,
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

  return {
    findById,
    findByIds,
    findFirst,
    findMany,
    findWithRelations,
    create,
    update,
    deleteById,
    delete: deleteById, // Alias for compatibility
  };
}
