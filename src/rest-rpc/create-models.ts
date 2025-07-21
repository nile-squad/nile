import { createLog } from '@nile/src/logging';
import { formatError } from '@nile/src/utils/erorr-formatter';
import { getChanges } from '@nile/src/utils/get-changes';
import { mergeTwoObjects } from '@nile/src/utils/merge-two-objects';
import {
  getValidationSchema,
  type Validation,
} from '@nile/src/utils/validation-utils';
import {
  and,
  eq,
  type InferInsertModel,
  type InferSelectModel,
  type Table,
} from 'drizzle-orm';
import type { ZodObject } from 'zod';

// Todo; review getOne and getMany methods

export type SelectArgs = {
  basedOnProperty: keyof Record<string, any>;
  withValue: any;
  options?: {
    transactionPointer?: any;
  };
};

export type updateArgs = {
  basedOnProperty: keyof Record<string, any>;
  withValue: any;
  dataInput: Record<string, any>;
  options?: {
    transactionPointer?: any;
    validation?: Validation;
  };
};

type Filter = {
  basedOnProperty: keyof Record<string, any>;
  withValue: any;
};

export type StrictSelectArgs = {
  filters: Filter[];
  options?: {
    transactionPointer?: any;
    validation?: Validation;
  };
};

export type ModelOptions = {
  transactionPointer?: any;
  validation?: Validation;
};

type ModelReturn = {
  data: Record<string, any> | null;
  errors: string[];
  validation?: ZodObject<any>;
};

export type Model = {
  getAll: () => Promise<{
    data: Record<string, any>[] | null;
    errors: string[];
  }>;
  createItem: (
    dataInput: Record<string, any> | any,
    options?: ModelOptions
  ) => Promise<ModelReturn>;
  deleteAll: () => Promise<{
    data: Record<string, any>[] | null;
    errors: string[];
  }>;
  getOne: (args: SelectArgs) => Promise<ModelReturn>;
  updateItem: (args: updateArgs) => Promise<ModelReturn>;
  deleteOne: (args: SelectArgs) => Promise<ModelReturn>;
  getMany: (args: SelectArgs) => Promise<ModelReturn>;
  getOneWithStrictly: (args: StrictSelectArgs) => Promise<ModelReturn>;
  table: Table;
};

/**
 * Create a model that provides CRUD operations for the given table.
 */
export const createModel = ({
  table,
  dbInstance,
  returnShape = null,
}: {
  table: any;
  dbInstance: any;
  returnShape?: Record<string, any> | null;
}): Model => {
  const db = dbInstance;
  type InsertType = InferInsertModel<typeof table>;
  type SelectType = InferSelectModel<typeof table>;
  const columns = Object.keys(table);

  const filterCondition = (basedOnProperty: keyof SelectType, withValue: any) =>
    eq(table[basedOnProperty], withValue);

  // Helper: parse the "other" column if it exists
  const parseOtherColumn = <T extends object>(row: T): T => {
    if (
      row &&
      typeof row === 'object' &&
      'other' in row &&
      typeof row.other === 'string'
    ) {
      try {
        // Only parse if not already parsed
        return { ...row, other: JSON.parse(row.other as string) };
      } catch {
        // If parsing fails, leave as is
        return row;
      }
    }
    return row;
  };

  // Helper: stringify the "other" column if it exists and is not a string
  const stringifyOtherColumn = <T extends object>(row: T): T => {
    if (
      row &&
      typeof row === 'object' &&
      'other' in row &&
      typeof row.other !== 'string'
    ) {
      try {
        return { ...row, other: JSON.stringify(row.other) };
      } catch {
        return row;
      }
    }
    return row;
  };

  const getAll = async (
    options: ModelOptions = {}
  ): Promise<{
    data: SelectType[] | null;
    errors: string[];
  }> => {
    let _db = db;
    if (options?.transactionPointer) {
      _db = options.transactionPointer;
    }
    try {
      const data = returnShape
        ? await _db.select(returnShape).from(table)
        : await _db.select().from(table);
      // Parse "other" for each row if it exists
      const parsed = data?.map(parseOtherColumn) ?? null;
      return { data: parsed, errors: [] };
    } catch (error) {
      return { data: null, errors: [`Error in getAll: ${error}`] };
    }
  };

  const getOne = async (
    args: SelectArgs
  ): Promise<{ data: SelectType | null; errors: string[] }> => {
    const errors: string[] = [];
    try {
      if (!columns.includes(args.basedOnProperty as string)) {
        errors.push(
          `Property ${String(args.basedOnProperty)} does not exist in the table`
        );
        return { data: null, errors };
      }
      let _db = db;
      if (args.options?.transactionPointer) {
        _db = args.options?.transactionPointer;
      }
      const result = await _db
        .select()
        .from(table)
        .where(filterCondition(args.basedOnProperty, args.withValue));
      const data = result[0] ? parseOtherColumn(result[0]) : null;
      return { data, errors };
    } catch (error) {
      return { data: null, errors: [`Error in getOne: ${error}`] };
    }
  };

  const create = async (
    dataInput: InsertType,
    options: ModelOptions = {}
  ): Promise<{
    data: SelectType | null;
    errors: string[];
    validation: ZodObject<any>;
  }> => {
    let validator = getValidationSchema({
      inferTable: table,
      validationMode: 'auto', // Default to auto
    });
    const errors: string[] = [];

    if (options.validation) {
      validator = getValidationSchema({
        ...options.validation,
        inferTable: table,
      });
    }
    const parsed = validator.safeParse(dataInput);
    if (!parsed.success) {
      const formattedError = formatError(parsed.error);
      errors.push(formattedError.toString());
      return { data: null, errors, validation: validator };
    }

    // Convert "other" to string if necessary before insert
    const dataToInsert = stringifyOtherColumn(dataInput);

    let _db = db;
    if (options?.transactionPointer) {
      _db = options.transactionPointer;
    }
    try {
      const result = returnShape
        ? await _db.insert(table).values(dataToInsert).returning(returnShape)
        : await _db.insert(table).values(dataToInsert).returning();
      // Parse "other" on result
      const data = result[0] ? parseOtherColumn(result[0]) : null;
      return { data, errors, validation: validator };
    } catch (error) {
      return {
        data: null,
        errors: [`Error in create: ${error}`],
        validation: validator,
      };
    }
  };

  const validateUpdatePayload = (args: updateArgs) => {
    const errors: string[] = [];
    const validation = args?.options?.validation || {};

    const validator = getValidationSchema({
      inferTable: table,
      validationMode: 'auto', // Default to auto
      context: {
        operation: 'update', // Set context for update operation
      },
      ...validation,
    });

    const parsed = validator.safeParse(args.dataInput);
    if (!parsed.success) {
      const formattedError = formatError(parsed.error);
      errors.push(formattedError.toString());
    }
    return { errors, validator };
  };

  const getCurrentDataForUpdate = async (args: updateArgs) => {
    try {
      const oldData = await db
        .select()
        .from(table)
        .where(filterCondition(args.basedOnProperty, args.withValue))
        .limit(1);

      if (!oldData || oldData.length === 0) {
        return {
          data: null,
          error: `No record found for ${String(args.basedOnProperty)} = ${
            args.withValue
          }`,
        };
      }
      return { data: oldData[0], error: null };
    } catch (error) {
      return {
        data: null,
        error: `Error in update process: ${error}`,
      };
    }
  };

  const prepareUpdateData = (currentData: any, newData: any) => {
    const otherWithChanges = mergeTwoObjects(currentData.other, newData.other);
    const mainChanges = getChanges(currentData, newData);
    let dataChanges = { ...mainChanges, other: otherWithChanges };
    dataChanges = stringifyOtherColumn(dataChanges);
    return dataChanges;
  };

  const executeUpdate = async (
    args: updateArgs,
    dataChanges: any,
    _db: any
  ) => {
    try {
      if (!columns.includes(args.basedOnProperty as string)) {
        return {
          data: null,
          error: `Column ${String(
            args.basedOnProperty
          )} does not exist in the table`,
        };
      }
      const result = returnShape
        ? await _db
            .update(table)
            .set(dataChanges)
            .where(filterCondition(args.basedOnProperty, args.withValue))
            .returning(returnShape)
        : await _db
            .update(table)
            .set(dataChanges)
            .where(filterCondition(args.basedOnProperty, args.withValue))
            .returning();

      const data = result[0] ? parseOtherColumn(result[0]) : null;
      return { data, error: null };
    } catch (error) {
      return {
        data: null,
        error: `Error in update: ${error}`,
      };
    }
  };

  const update = async (
    args: updateArgs
  ): Promise<{
    data: SelectType | null;
    errors: string[];
    validation: ZodObject<any>;
  }> => {
    const { errors: validationErrors, validator } = validateUpdatePayload(args);
    if (validationErrors.length > 0) {
      return { data: null, errors: validationErrors, validation: validator };
    }

    const { data: currentData, error: fetchError } =
      await getCurrentDataForUpdate(args);
    if (fetchError) {
      return { data: null, errors: [fetchError], validation: validator };
    }

    if (!currentData) {
      return {
        data: null,
        errors: ['Current data not found'],
        validation: validator,
      };
    }

    const dataChanges = prepareUpdateData(currentData, args.dataInput);

    if (Object.keys(dataChanges).length === 0) {
      createLog({
        appName: 'shared',
        atFunction: 'create models - update',
        message: 'No values to update',
        data: dataChanges,
        type: 'warn',
      });
      return { data: null, errors: [], validation: validator };
    }

    let _db = db;
    if (args.options?.transactionPointer) {
      _db = args.options.transactionPointer;
    }

    const { data, error: updateError } = await executeUpdate(
      args,
      dataChanges,
      _db
    );
    if (updateError) {
      return { data: null, errors: [updateError], validation: validator };
    }

    return { data, errors: [], validation: validator };
  };

  const deleteOne = async (
    args: SelectArgs
  ): Promise<{ data: SelectType | null; errors: string[] }> => {
    const errors: string[] = [];
    let _db = db;
    if (args.options?.transactionPointer) {
      _db = args.options.transactionPointer;
    }
    try {
      if (!columns.includes(args.basedOnProperty as string)) {
        errors.push(
          `Property ${String(args.basedOnProperty)} does not exist in the table`
        );
        return { data: null, errors };
      }
      const result = returnShape
        ? await _db
            .delete(table)
            .where(filterCondition(args.basedOnProperty, args.withValue))
            .returning(returnShape)
        : await _db
            .delete(table)
            .where(filterCondition(args.basedOnProperty, args.withValue))
            .returning();
      // Parse "other" on result
      return { data: result[0] ? parseOtherColumn(result[0]) : null, errors };
    } catch (error) {
      return { data: null, errors: [`Error in deleteOne: ${error}`] };
    }
  };

  const deleteAll = async (
    options: ModelOptions = {}
  ): Promise<{
    data: SelectType[] | null;
    errors: string[];
  }> => {
    let _db = db;
    if (options?.transactionPointer) {
      _db = options.transactionPointer;
    }
    try {
      const data = returnShape
        ? await _db.delete(table).returning(returnShape)
        : await _db.delete(table).returning();
      // Parse "other" for each row if it exists
      const parsed = data?.map(parseOtherColumn) ?? null;
      return { data: parsed, errors: [] };
    } catch (error) {
      return { data: null, errors: [`Error in deleteAll: ${error}`] };
    }
  };

  const getMany = async (
    args: SelectArgs
  ): Promise<{ data: SelectType[] | null; errors: string[] }> => {
    const errors: string[] = [];
    let _db = db;
    if (args.options?.transactionPointer) {
      _db = args.options.transactionPointer;
    }
    try {
      if (!columns.includes(args.basedOnProperty as string)) {
        errors.push(
          `Property ${String(args.basedOnProperty)} does not exist in the table`
        );
        return { data: null, errors };
      }
      const result = returnShape
        ? await _db
            .select(returnShape)
            .from(table)
            .where(filterCondition(args.basedOnProperty, args.withValue))
            .returning(returnShape)
        : await _db
            .select()
            .from(table)
            .where(filterCondition(args.basedOnProperty, args.withValue));
      // Parse "other" for each row if it exists
      const parsed = result?.map(parseOtherColumn) ?? null;
      return { data: parsed, errors };
    } catch (error) {
      return { data: null, errors: [`Error in getMany: ${error}`] };
    }
  };

  const getOneWithStrictly = async (
    args: StrictSelectArgs
  ): Promise<{ data: SelectType | null; errors: string[] }> => {
    const errors: string[] = [];

    // check if columns exist
    for (const f of args.filters) {
      if (!columns.includes(f.basedOnProperty as string)) {
        errors.push(
          `Property ${String(f.basedOnProperty)} does not exist in the table`
        );
      }
    }

    if (errors.length > 0) {
      return { data: null, errors };
    }

    let _db = db;
    if (args.options?.transactionPointer) {
      _db = args.options.transactionPointer;
    }
    try {
      const _filters = args.filters.map((f) =>
        eq(table[f.basedOnProperty], f.withValue)
      );

      const result = await _db
        .select()
        .from(table)
        .where(and(..._filters));
      const data = result[0] ? parseOtherColumn(result[0]) : null;
      return { data, errors };
    } catch (error) {
      return { data: null, errors: [`Error in getOneWithStrictly: ${error}`] };
    }
  };

  return {
    table,
    getAll,
    getOne,
    createItem: create,
    updateItem: update,
    deleteOne,
    deleteAll,
    getMany,
    getOneWithStrictly,
  };
};
