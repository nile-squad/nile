import type { SQL, Table } from 'drizzle-orm';
import type { Validation } from '../../utils/validation-utils';

/**
 * Result pattern types for consistent error handling
 */
export interface ModelError {
  message: string;
  type: 'validation' | 'database';
  details?: Record<string, any>;
}

export interface ModelResult<T> {
  data: T | null;
  error: ModelError | null;
}

/**
 * Core model options
 *
 * @note `transactionPointer` is `any` to support multiple Drizzle adapters.
 * Model types (TSelect, TInsert) remain strongly typed for data safety.
 */
export interface ModelOptions {
  /**
   * Transaction context for atomic operations.
   * Pass the transaction object from db.transaction() callback.
   * Type: any (supports PostgreSQL, SQLite, MySQL drivers via Drizzle ORM)
   */
  transactionPointer?: any;
  validation?: Validation;
  includeDeleted?: boolean; // For soft delete - include deleted records
  select?: (keyof any)[]; // Field selection
}

/**
 * Filter system types
 */
export interface PropertyFilter<TSelect> {
  where: keyof TSelect;
  equals?: unknown;
  notEquals?: unknown;
  greaterThan?: unknown;
  greaterThanOrEqual?: unknown;
  lessThan?: unknown;
  lessThanOrEqual?: unknown;
  like?: string;
  ilike?: string;
  contains?: string;
  in?: unknown[];
  notIn?: unknown[];
  isNull?: boolean;
  isNotNull?: boolean;
  between?: [unknown, unknown];
}

export interface SQLFilter {
  sql: SQL;
}

export interface OrFilter<TSelect> {
  or: Filter<TSelect>[];
}

export interface AndFilter<TSelect> {
  and: Filter<TSelect>[];
}

export type Filter<TSelect> =
  | PropertyFilter<TSelect>
  | SQLFilter
  | OrFilter<TSelect>
  | AndFilter<TSelect>;

/**
 * Ordering types
 */
export interface OrderBy<TSelect> {
  field: keyof TSelect;
  direction: 'asc' | 'desc';
}

export interface SQLOrder {
  sql: SQL;
}

export type OrderByOption<TSelect> = OrderBy<TSelect> | SQLOrder;

/**
 * Pagination types
 */
export interface PaginatedResult<T> {
  items: T[];
  meta: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    perPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Find many options
 */
export interface FindManyOptions<TSelect> {
  filters?: Filter<TSelect>[];
  orderBy?: OrderByOption<TSelect>[];
  limit?: number;
  offset?: number;
  page?: number;
  perPage?: number;
  distinct?: keyof TSelect; // Distinct values for a field
  with?: WithRelations;
  transactionPointer?: any;
  validation?: Validation;
  includeDeleted?: boolean;
  select?: (keyof TSelect)[]; // Field selection
}

/**
 * Relations interface for Drizzle relations
 */
export interface WithRelations {
  [key: string]: boolean | WithRelations;
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult<T> {
  data: T[];
  errors: string[];
}

/**
 * Atomic operation options
 */
export interface AtomicOptions {
  transactionPointer?: any;
}

/**
 * Aggregation function options
 */
export interface AggregateFunction<TSelect> {
  field: keyof TSelect;
  operation: 'sum' | 'avg' | 'min' | 'max' | 'count';
  alias?: string;
}

export interface AggregateOptions<TSelect> {
  functions: AggregateFunction<TSelect>[];
  filters?: Filter<TSelect>[];
}

export interface AggregateResult {
  data: Record<string, any>;
  errors: string[];
}

/**
 * Group by options
 */
export interface GroupByOptions<TSelect> {
  count?: keyof TSelect;
  sum?: keyof TSelect;
  avg?: keyof TSelect;
  min?: keyof TSelect;
  max?: keyof TSelect;
  filters?: Filter<TSelect>[];
  having?: Filter<TSelect>[];
  orderBy?: OrderByOption<TSelect>[];
  limit?: number;
}

export interface GroupByResult<TSelect> {
  data: Array<TSelect & Record<string, any>>;
  errors: string[];
}

/**
 * Model configuration
 *
 * @example
 * ```typescript
 * const userModel = createModel({
 *   table: users,
 *   dbInstance: db,
 *   config: {
 *     dialect: "postgresql",
 *     jsonMode: "auto",
 *     bulkOperationLimit: 1000,
 *     softDelete: {
 *       field: "deletedAt",
 *       autoFilter: true
 *     },
 *     timestamps: {
 *       createdAt: "createdAt",
 *       updatedAt: "updatedAt"
 *     },
 *     validation: {
 *       defaultMode: "auto"
 *     }
 *   }
 * });
 * ```
 */
export interface ModelConfig {
  /**
   * Database dialect for query optimization and compatibility.
   * - "postgresql": Uses PostgreSQL-specific features (recommended)
   * - "sqlite": Uses SQLite-specific features and operators
   * @default "postgresql"
   */
  dialect?: 'postgresql' | 'sqlite';

  /**
   * JSON handling mode for JSON columns.
   * - "auto": Let Drizzle handle JSON serialization/deserialization automatically (best for PostgreSQL)
   * - "stringify": Explicitly stringify/parse JSON in the ORM layer (better for cross-dialect compatibility, recommended for SQLite)
   * @default "auto"
   */
  jsonMode?: 'auto' | 'stringify';

  /**
   * Maximum number of records allowed per bulk operation (createMany, updateMany, deleteMany, upsertMany).
   * Prevents accidental excessive database operations.
   * @default 1000
   */
  bulkOperationLimit?: number;

  /**
   * Soft delete configuration for reversible deletions.
   */
  softDelete?: {
    /**
     * Column name for the soft delete timestamp (e.g., 'deleted_at', 'deletedAt').
     * When set, delete operations will set this field to current timestamp instead of removing the record.
     */
    field: string;

    /**
     * Automatically exclude soft-deleted records from all queries.
     * When true, deleted records are hidden from find operations unless includeDeleted: true is passed.
     * @default false
     */
    autoFilter?: boolean;
  };

  /**
   * Timestamp configuration for automatic timestamp management.
   * When configured, the ORM automatically manages these fields on create and update operations.
   */
  timestamps?: {
    /**
     * Column name for creation timestamp (e.g., 'created_at', 'createdAt').
     * Automatically set to current date on record creation.
     */
    createdAt?: string;

    /**
     * Column name for update timestamp (e.g., 'updated_at', 'updatedAt').
     * Automatically set to current date on every update operation (update, updateMany, upsert, upsertMany).
     */
    updatedAt?: string;
  };

  /**
   * Validation configuration for schema validation.
   */
  validation?: {
    /**
     * Validation mode for schema validation.
     * - "auto": Automatically infer validation from Drizzle schema
     * - "strict": Enforce all validation rules strictly
     * - "loose": Apply loose validation rules
     * @default "auto"
     */
    defaultMode?: 'auto' | 'strict' | 'loose';
  };
}

/**
 * Base model interface
 */
export type BaseModel<TSelect, TInsert> = {
  /**
   * Finds a single record by its ID.
   * @param id - The unique identifier of the record
   * @param options - Optional model options (transactions, soft delete inclusion)
   * @returns ModelResult with the found record or null if not found
   * @example
   * const { data, error } = await userModel.findById('user-123');
   */
  findById: (
    id: string,
    options?: ModelOptions
  ) => Promise<ModelResult<TSelect>>;

  /**
   * Finds multiple records by their IDs.
   * @param ids - Array of unique identifiers
   * @param options - Optional model options
   * @returns ModelResult with array of found records
   * @example
   * const { data, error } = await userModel.findByIds(['user-1', 'user-2']);
   */
  findByIds: (
    ids: string[],
    options?: ModelOptions
  ) => Promise<ModelResult<TSelect[]>>;

  /**
   * Finds the first record matching the given filters.
   * @param filters - Array of filter conditions
   * @param options - Optional model options
   * @returns ModelResult with the first matching record or null
   * @example
   * const { data, error } = await userModel.findFirst([{ where: 'email', equals: 'user@example.com' }]);
   */
  findFirst: (
    filters: Filter<TSelect>[],
    options?: ModelOptions
  ) => Promise<ModelResult<TSelect>>;

  /**
   * Finds multiple records with advanced filtering and pagination.
   * @param options - Filtering, pagination, and ordering options
   * @returns ModelResult with array of records or paginated result
   * @example
   * const { data, error } = await userModel.findMany({ filters: [{ where: 'status', equals: 'active' }], limit: 10 });
   */
  findMany: (
    options?: FindManyOptions<TSelect>
  ) => Promise<ModelResult<TSelect[] | PaginatedResult<TSelect>>>;

  /**
   * Finds a single record by ID with related data using Drizzle relations.
   * @param id - The unique identifier of the record
   * @param relations - Object specifying which relations to include
   * @param options - Optional model options (transactions, soft delete inclusion)
   * @returns ModelResult with the record including related data
   * @example
   * const { data, error } = await userModel.findWithRelations('user-123', { posts: true, comments: true });
   */
  findWithRelations: (
    id: string,
    relations: WithRelations,
    options?: ModelOptions
  ) => Promise<ModelResult<TSelect>>;

  /**
   * Creates a new record with validation.
   * @param data - The data to insert
   * @param options - Optional model options including validation
   * @returns ModelResult with the created record
   * @example
   * const { data, error } = await userModel.create({ username: 'newuser', email: 'user@example.com' });
   */
  create: (
    data: TInsert,
    options?: ModelOptions
  ) => Promise<ModelResult<TSelect>>;

  /**
   * Updates a record by its ID with validation and change detection.
   * @param id - The unique identifier of the record to update
   * @param data - The data to update (partial)
   * @param options - Optional model options
   * @returns ModelResult with the updated record
   * @example
   * const { data, error } = await userModel.update('user-123', { firstName: 'John' });
   */
  update: (
    id: string,
    data: Partial<TSelect>,
    options?: ModelOptions
  ) => Promise<ModelResult<TSelect>>;

  /**
   * Deletes a record by its ID (soft delete if configured).
   * @param id - The unique identifier of the record to delete
   * @param options - Optional model options
   * @returns ModelResult with void data
   * @example
   * const { data, error } = await userModel.delete('user-123');
   */
  deleteById: (
    id: string,
    options?: ModelOptions
  ) => Promise<ModelResult<void>>;

  /**
   * Counts records matching the given filters.
   * @param filters - Array of filter conditions
   * @param options - Optional model options
   * @returns ModelResult with the count number
   * @example
   * const { data, error } = await userModel.countRecords([{ where: 'status', equals: 'active' }]);
   */
  countRecords: (
    filters?: Filter<TSelect>[],
    options?: ModelOptions
  ) => Promise<ModelResult<number>>;

  /**
   * Checks if a record exists matching the given filters.
   * @param filters - Array of filter conditions
   * @param options - Optional model options
   * @returns ModelResult with boolean indicating existence
   * @example
   * const { data, error } = await userModel.exists([{ where: 'email', equals: 'user@example.com' }]);
   */
  exists: (
    filters: Filter<TSelect>[],
    options?: ModelOptions
  ) => Promise<ModelResult<boolean>>;

  /**
   * Gets distinct values for a specific field.
   * @param field - The field to get distinct values for
   * @param filters - Optional filter conditions
   * @param options - Optional model options
   * @returns ModelResult with array of distinct values
   * @example
   * const { data, error } = await userModel.distinct('status');
   */
  distinct: (
    field: keyof TSelect,
    filters?: Filter<TSelect>[],
    options?: ModelOptions
  ) => Promise<ModelResult<any[]>>;

  /**
   * REMOVED FOR SECURITY: raw() method is no longer exposed.
   *
   * Raw SQL execution bypasses validation, authorization, and security checks.
   * This method is kept internal to the ORM layer only.
   *
   * See: /docs/ORM-SECURITY-BOUNDARIES.md for details.
   *
   * @deprecated - Removed from public Model interface for security reasons
   * @internal
   */
  // raw: (sqlQuery: SQL) => Promise<ModelResult<any>>;

  /**
   * Creates multiple records in a single operation.
   * @param data - Array of data to insert
   * @param options - Optional model options
   * @returns ModelResult with bulk operation result
   * @example
   * const { data, error } = await userModel.createMany([{ username: 'user1' }, { username: 'user2' }]);
   */
  createMany: (
    data: TInsert[],
    options?: ModelOptions
  ) => Promise<ModelResult<TSelect[]>>;

  /**
   * Updates multiple records matching the given filters.
   * @param filters - Array of filter conditions
   * @param data - The data to update
   * @param options - Optional model options
   * @returns ModelResult with array of updated records
   * @example
   * const { data, error } = await userModel.updateMany([{ where: 'status', equals: 'inactive' }], { status: 'active' });
   */
  updateMany: (
    filters: Filter<TSelect>[],
    data: Partial<TSelect>,
    options?: ModelOptions
  ) => Promise<ModelResult<TSelect[]>>;

  /**
   * Deletes multiple records matching the given filters.
   * @param filters - Array of filter conditions
   * @param options - Optional model options
   * @returns ModelResult with array of deleted records
   * @example
   * const { data, error } = await userModel.deleteMany([{ where: 'status', equals: 'inactive' }]);
   */
  deleteMany: (
    filters: Filter<TSelect>[],
    options?: ModelOptions
  ) => Promise<ModelResult<TSelect[]>>;

  /**
   * Inserts or updates a record (upsert).
   * @param data - The data to insert or update, must include id
   * @param options - Optional model options
   * @returns ModelResult with the upserted record
   * @example
   * const { data, error } = await userModel.upsert({ id: 'user-123', username: 'kizz', email: 'kizz@example.com' });
   */
  upsert: (
    data: TInsert & { id: string },
    options?: ModelOptions
  ) => Promise<ModelResult<TSelect>>;

  /**
   * Inserts or updates multiple records (bulk upsert).
   * @param data - Array of data to insert or update, each must include id
   * @param options - Optional model options
   * @returns ModelResult with array of upserted records
   * @example
   * const { data, error } = await userModel.upsertMany([{ id: 'user-1', username: 'user1' }, { id: 'user-2', username: 'user2' }]);
   */
  upsertMany: (
    data: (TInsert & { id: string })[],
    options?: ModelOptions
  ) => Promise<ModelResult<TSelect[]>>;

  /**
   * Increments a numeric field by a specified value.
   * @param id - The unique identifier of the record
   * @param field - The numeric field to increment
   * @param value - The value to increment by (default: 1)
   * @param options - Optional model options
   * @returns ModelResult with the updated record
   * @example
   * const { data, error } = await userModel.increment('user-123', 'viewCount', 5);
   */
  increment: (
    id: string,
    field: keyof TSelect,
    value?: number,
    options?: AtomicOptions
  ) => Promise<ModelResult<TSelect>>;

  /**
   * Decrements a numeric field by a specified value.
   * @param id - The unique identifier of the record
   * @param field - The numeric field to decrement
   * @param value - The value to decrement by (default: 1)
   * @param options - Optional model options
   * @returns ModelResult with the updated record
   * @example
   * const { data, error } = await userModel.decrement('user-123', 'viewCount', 2);
   */
  decrement: (
    id: string,
    field: keyof TSelect,
    value?: number,
    options?: AtomicOptions
  ) => Promise<ModelResult<TSelect>>;

  /**
   * Performs aggregation operations on records.
   * @param fieldOrOptions - Field name and operation, or complex options object
   * @param operation - Aggregation operation (when using simple signature)
   * @returns ModelResult with aggregation result
   * @example
   * const { data, error } = await userModel.aggregate('age', 'avg');
   * const { data, error } = await userModel.aggregate({ functions: [{ field: 'age', operation: 'avg' }] });
   */
  aggregate: (
    fieldOrOptions: keyof TSelect | AggregateOptions<TSelect>,
    operation?: 'sum' | 'avg' | 'min' | 'max' | 'count'
  ) => Promise<ModelResult<AggregateResult>>;

  /**
   * Groups records by a field with optional aggregations.
   * @param field - The field to group by
   * @param options - Group by options including aggregations
   * @returns ModelResult with grouped results
   * @example
   * const { data, error } = await userModel.groupBy('status', { count: 'id' });
   */
  groupBy: (
    field: keyof TSelect,
    options?: GroupByOptions<TSelect>
  ) => Promise<ModelResult<GroupByResult<TSelect>>>;

  /**
   * Restores a soft-deleted record.
   * @param id - The unique identifier of the record to restore
   * @param options - Optional model options
   * @returns ModelResult with the restored record
   * @example
   * const { data, error } = await userModel.restore('user-123');
   */
  restore: (
    id: string,
    options?: ModelOptions
  ) => Promise<ModelResult<TSelect>>;

  /**
   * Restores multiple soft-deleted records.
   * @param filters - Array of filter conditions
   * @param options - Optional model options
   * @returns ModelResult with array of restored records
   * @example
   * const { data, error } = await userModel.restoreMany([{ where: 'status', equals: 'deleted' }]);
   */
  restoreMany: (
    filters: Filter<TSelect>[],
    options?: ModelOptions
  ) => Promise<ModelResult<TSelect[]>>;

  /**
   * Permanently deletes a record (bypasses soft delete).
   * @param id - The unique identifier of the record to permanently delete
   * @param options - Optional model options
   * @returns ModelResult with the deleted record
   * @example
   * const { data, error } = await userModel.forceDelete('user-123');
   */
  forceDelete: (
    id: string,
    options?: ModelOptions
  ) => Promise<ModelResult<TSelect>>;

  /**
   * Permanently deletes multiple records (bypasses soft delete).
   * @param filters - Array of filter conditions
   * @param options - Optional model options
   * @returns ModelResult with array of deleted records
   * @example
   * const { data, error } = await userModel.forceDeleteMany([{ where: 'status', equals: 'deleted' }]);
   */
  forceDeleteMany: (
    filters: Filter<TSelect>[],
    options?: ModelOptions
  ) => Promise<ModelResult<TSelect[]>>;

  /**
   * Table reference for advanced usage
   */
  table: Table;
};

/**
 * Model factory return type
 */
export type Model<
  TSelect,
  TInsert,
  _TConfig extends ModelConfig = Record<string, never>,
> = BaseModel<TSelect, TInsert> & {
  // Table reference
  table: Table;
};
