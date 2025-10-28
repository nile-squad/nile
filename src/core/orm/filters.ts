import type { Table } from 'drizzle-orm';
import {
  and,
  asc,
  between,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  not,
  notInArray,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import type { Filter, PropertyFilter } from './types';

/**
 * Builds SQL condition from a single filter
 */
export function buildFilterCondition<TTable extends Table>(
  table: TTable,
  filter: Filter<any>,
  dialect: 'postgresql' | 'sqlite' = 'postgresql'
): SQL | undefined {
  // Guard clause for SQL filters
  if ('sql' in filter) {
    // For SQLite, check if using unsupported JSON operators
    if (dialect === 'sqlite') {
      const sqlString = filter.sql.toString().toLowerCase();
      if (sqlString.includes('->>') || sqlString.includes("'json")) {
        throw new Error(
          'JSON operators (->>) not supported in SQLite. Use Drizzle JSON functions instead.'
        );
      }
    }
    return filter.sql;
  }

  // Handle OR filters
  if ('or' in filter) {
    const conditions = filter.or
      .map((f) => buildFilterCondition(table, f, dialect))
      .filter((c): c is SQL => c !== undefined);
    return conditions.length > 0 ? or(...conditions) : undefined;
  }

  // Handle AND filters
  if ('and' in filter) {
    const conditions = filter.and
      .map((f) => buildFilterCondition(table, f, dialect))
      .filter((c): c is SQL => c !== undefined);
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  // Handle property filters
  const propertyFilter = filter as PropertyFilter<any>;
  const {
    where,
    equals,
    notEquals,
    greaterThan,
    greaterThanOrEqual,
    lessThan,
    lessThanOrEqual,
    like: likeValue,
    ilike: ilikeValue,
    contains: containsValue,
    in: inValues,
    notIn,
    isNull: isNullValue,
    isNotNull: isNotNullValue,
    between: betweenValues,
  } = propertyFilter;

  const column = table[where as keyof typeof table] as any;

  // Guard clause for invalid columns
  if (!column) {
    throw new Error(`Column '${String(where)}' does not exist on table`);
  }

  // Object lookup for operators (following AGENTS.md rule)
  const operatorMap = {
    equals: () => (equals !== undefined ? eq(column, equals) : null),
    notEquals: () =>
      notEquals !== undefined ? not(eq(column, notEquals)) : null,
    greaterThan: () =>
      greaterThan !== undefined ? gt(column, greaterThan) : null,
    greaterThanOrEqual: () =>
      greaterThanOrEqual !== undefined ? gte(column, greaterThanOrEqual) : null,
    lessThan: () => (lessThan !== undefined ? lt(column, lessThan) : null),
    lessThanOrEqual: () =>
      lessThanOrEqual !== undefined ? lte(column, lessThanOrEqual) : null,
    like: () => (likeValue !== undefined ? like(column, likeValue) : null),
    ilike: () => {
      // SQLite doesn't support ilike, fall back to case-insensitive like
      if (dialect === 'sqlite' && ilikeValue !== undefined) {
        // Use SQL function for case-insensitive matching
        return sql`lower(${column}) LIKE lower(${ilikeValue})`;
      }
      return ilikeValue !== undefined ? ilike(column, ilikeValue) : null;
    },
    contains: () => {
      if (containsValue === undefined) {
        return null;
      }
      const pattern = `%${containsValue}%`;
      // SQLite doesn't support ilike, use lower() for case-insensitive matching
      if (dialect === 'sqlite') {
        return sql`lower(${column}) LIKE lower(${pattern})`;
      }
      // PostgreSQL supports ilike for case-insensitive matching
      return ilike(column, pattern);
    },
    in: () => (inValues !== undefined ? inArray(column, inValues) : null),
    notIn: () => (notIn !== undefined ? notInArray(column, notIn) : null),
    isNull: () => (isNullValue !== undefined ? isNull(column) : null),
    isNotNull: () => (isNotNullValue !== undefined ? isNotNull(column) : null),
    between: () =>
      betweenValues !== undefined
        ? between(column, betweenValues[0], betweenValues[1])
        : null,
  };

  // Find the first defined operator and execute it
  for (const [operator, handler] of Object.entries(operatorMap)) {
    if (propertyFilter[operator as keyof typeof propertyFilter] !== undefined) {
      const result = handler();
      if (result !== null) {
        return result;
      }
    }
  }

  throw new Error(`No operator provided for where '${String(where)}'`);
}

/**
 * Builds WHERE clause from array of filters
 */
export function buildWhereClause<TTable extends Table>(
  table: TTable,
  filters: Filter<any>[],
  dialect: 'postgresql' | 'sqlite' = 'postgresql'
): SQL | undefined {
  if (filters.length === 0) {
    return;
  }

  const conditions = filters
    .map((filter) => buildFilterCondition(table, filter, dialect))
    .filter((c): c is SQL => c !== undefined);

  return conditions.length === 1 ? conditions[0] : and(...conditions);
}

/**
 * Builds ORDER BY clause from order options
 */
export function buildOrderClause<TTable extends Table>(
  table: TTable,
  orderBy: any[] | undefined
): SQL[] {
  if (!orderBy || orderBy.length === 0) {
    // Default ordering by createdAt if available
    if ('createdAt' in table) {
      return [desc((table as any).createdAt)];
    }
    return [];
  }

  return orderBy.map((order) => {
    // Guard clause for SQL orders
    if ('sql' in order) {
      return order.sql;
    }

    // Handle property-based ordering
    const { field, direction } = order;
    const column = table[field as keyof typeof table] as any;

    // Guard clause for invalid columns
    if (!column) {
      throw new Error(`Column '${String(field)}' does not exist on table`);
    }

    return direction === 'desc' ? desc(column) : asc(column);
  });
}

/**
 * Detects JSON columns in a table schema
 */
export function detectJsonColumns<TTable extends Table>(
  table: TTable,
  dialect: 'postgresql' | 'sqlite' = 'postgresql',
  jsonMode: 'auto' | 'stringify' = 'auto'
): string[] {
  const jsonColumns: string[] = [];
  const tableAny = table as any;

  for (const [key, value] of Object.entries(tableAny)) {
    if (!value || typeof value !== 'object') {
      continue;
    }

    // Direct dataType property (PostgreSQL)
    if (
      'dataType' in value &&
      ['json', 'jsonb'].includes((value as any).dataType)
    ) {
      jsonColumns.push(key);
      continue;
    }

    // Nested structure
    if ('_' in value && jsonMode === 'stringify') {
      const innerValue = (value as any)._;
      const dataType = innerValue?.dataType;
      const config = innerValue?.config;
      if (dialect === 'postgresql' && ['json', 'jsonb'].includes(dataType)) {
        jsonColumns.push(key);
        continue;
      }
      if (dialect === 'sqlite' && config?.mode === 'json') {
        jsonColumns.push(key);
        continue;
      }
    }

    // Outer config property for SQLite mode: 'json'
    const outerConfig = (value as any).config;
    if (
      jsonMode === 'stringify' &&
      dialect === 'sqlite' &&
      outerConfig?.mode === 'json'
    ) {
      jsonColumns.push(key);
    }
  }

  return jsonColumns;
}

/**
 * Processes JSON columns for database operations
 */
export function processJsonColumns<TTable extends Table>(
  data: any,
  table: TTable,
  operation: 'stringify' | 'parse',
  dialect: 'postgresql' | 'sqlite' = 'postgresql',
  jsonMode: 'auto' | 'stringify' = 'auto'
): any {
  const jsonColumns = detectJsonColumns(table, dialect, jsonMode);
  const processed = { ...data };

  for (const column of jsonColumns) {
    if (processed[column] !== undefined && processed[column] !== null) {
      if (operation === 'stringify') {
        // Always stringify objects for database storage
        if (
          typeof processed[column] === 'object' &&
          !Array.isArray(processed[column])
        ) {
          processed[column] = JSON.stringify(processed[column]);
        }
      } else if (
        operation === 'parse' &&
        typeof processed[column] === 'string'
      ) {
        // Always parse strings back to objects
        try {
          processed[column] = JSON.parse(processed[column]);
        } catch {
          // If parsing fails, keep the original value
        }
      }
    }
  }

  return processed;
}
