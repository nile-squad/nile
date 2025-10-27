import type { InferInsertModel, InferSelectModel, Table } from 'drizzle-orm';
import { createAggregationOperations } from './aggregation';
import { createAtomicOperations } from './atomic';
import { createBulkOperations } from './bulk';
import { createCrudOperations } from './crud';
import { createSoftDeleteOperations } from './soft-delete';
import type { Model, ModelConfig, ModelResult } from './types';
import { createUtilityOperations } from './utils';

/**
 * Creates a model factory with all CRUD, bulk, atomic, aggregation, utility, and soft delete operations.
 *
 * Full documentation: {@link https://github.com/nilesquad/nile/blob/main/docs/create-models.md create-models.md}
 *
 * @param table - Drizzle table definition
 * @param dbInstance - Database instance (PostgreSQL, SQLite, etc.)
 * @param returnShape - Optional return shape for queries
 * @param config - Model configuration including soft delete settings
 * @returns Complete model with all operations
 *
 * @example
 * ```typescript
 * import { createModel } from 'nile';
 * import { users } from './schema/users';
 * import { db } from './server/db';
 *
 * const userModel = createModel({
 *   table: users,
 *   dbInstance: db,
 *   config: {
 *     softDelete: {
 *       field: 'deletedAt',
 *       autoFilter: true
 *     }
 *   }
 * });
 *
 * // Use the model
 * const { data, error } = await userModel.findById('user-123');
 * ```
 */
export function createModel<
  TTable extends Table,
  TConfig extends ModelConfig = Record<string, never>,
>({
  table,
  dbInstance,
  returnShape = null,
  config = {} as TConfig,
}: {
  table: TTable;
  /**
   * Database instance (PostgreSQL, SQLite, MySQL via Drizzle ORM).
   * Type is `any` for multi-driver support; model types (TSelect, TInsert) remain strongly typed.
   */
  dbInstance: any;
  returnShape?: Record<string, any> | null;
  config?: TConfig;
}): Model<InferSelectModel<TTable>, InferInsertModel<TTable>, TConfig> {
  const db = dbInstance;
  const dialect = config.dialect || 'postgresql';
  const jsonMode = config.jsonMode || 'auto';

  // Create all operation modules (no generic parameters to simplify)
  const crudOps = createCrudOperations(
    table,
    db,
    returnShape,
    config,
    dialect,
    jsonMode
  );
  const bulkOps = createBulkOperations(
    table,
    db,
    returnShape,
    config,
    dialect,
    jsonMode
  );
  const atomicOps = createAtomicOperations(table, db, returnShape);
  const aggregationOps = createAggregationOperations(table, db, dialect);
  const utilityOps = createUtilityOperations(table, db, config, dialect);
  const softDeleteOps = createSoftDeleteOperations(
    table,
    db,
    returnShape,
    config,
    dialect
  );

  // Combine all operations into a single model
  return {
    // CRUD operations
    ...crudOps,

    // Bulk operations
    ...bulkOps,

    // Atomic operations
    ...atomicOps,

    // Aggregation operations
    ...aggregationOps,

    // Utility operations
    ...utilityOps,

    // Soft delete operations
    ...softDeleteOps,

    // Table reference
    table,
  };
}

/**
 * Executes database operations within a transaction.
 * Automatically commits on success or rolls back on error.
 *
 * @param dbInstance - Database instance to run transaction with
 * @param callback - Function that receives transaction instance and returns result
 * @returns ModelResult with transaction result or error
 *
 * @example
 * ```typescript
 * import { withTransaction, createModel } from 'nile';
 * import { db } from './server/db';
 *
 * const { data, error } = await withTransaction(db, async (tx) => {
 *   const userModel = createModel({ table: users, dbInstance: tx });
 *   return await userModel.create(userData);
 * });
 * ```
 */
export async function withTransaction<T>(
  /**
   * Database instance (any Drizzle adapter).
   * Type is `any` for multi-driver support.
   */
  dbInstance: any,
  callback: (tx: any) => Promise<ModelResult<T>>
): Promise<ModelResult<T>> {
  try {
    const result = await dbInstance.transaction(callback);
    return result;
  } catch (error) {
    return {
      data: null,
      error: {
        message: error instanceof Error ? error.message : 'Transaction failed',
        type: 'database',
        details: { originalError: error },
      },
    };
  }
}

// Export all types for external use
export type {
  AggregateFunction,
  AggregateOptions,
  AggregateResult,
  AndFilter,
  AtomicOptions,
  BaseModel,
  BulkOperationResult,
  Filter,
  FindManyOptions,
  GroupByOptions,
  GroupByResult,
  Model,
  ModelConfig,
  ModelError,
  ModelOptions,
  ModelResult,
  OrderBy,
  OrderByOption,
  OrFilter,
  PaginatedResult,
  PropertyFilter,
  SQLFilter,
  SQLOrder,
  WithRelations,
} from './types';
