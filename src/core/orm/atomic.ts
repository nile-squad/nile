import { log } from '@nile/src/internal.config';
import type { InferSelectModel, Table } from 'drizzle-orm';
import { eq, sql } from 'drizzle-orm';
import { processJsonColumns } from './filters';
import type { AtomicOptions, ModelResult } from './types';

/**
 * Creates atomic operations for a model
 */
export function createAtomicOperations<TTable extends Table>(
  table: TTable,
  db: any,
  returnShape: Record<string, any> | null
) {
  type SelectType = InferSelectModel<typeof table>;
  const tableAny = table as any;

  const increment = async (
    id: string,
    field: keyof SelectType,
    value = 1,
    options: AtomicOptions = {}
  ): Promise<ModelResult<SelectType>> => {
    let _db: any = db;
    if (options?.transactionPointer) {
      _db = options.transactionPointer;
    }

    try {
      const column = tableAny[field as string];
      const result = await (_db as any)
        .update(table)
        .set({ [field]: sql`${column} + ${value}` } as any)
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
        atFunction: 'increment',
        message: `Error in increment: ${error instanceof Error ? error.message : String(error)}`,
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

  const decrement = async (
    id: string,
    field: keyof SelectType,
    value = 1,
    options: AtomicOptions = {}
  ): Promise<ModelResult<SelectType>> => {
    let _db: any = db;
    if (options?.transactionPointer) {
      _db = options.transactionPointer;
    }

    try {
      const column = tableAny[field as string];
      const result = await (_db as any)
        .update(table)
        .set({ [field]: sql`${column} - ${value}` } as any)
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
        atFunction: 'decrement',
        message: `Error in decrement: ${error instanceof Error ? error.message : String(error)}`,
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
    increment,
    decrement,
  };
}
