import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { type ZodObject, type ZodRawShape, z } from 'zod';

export type Validation = {
  zodSchema?: ZodObject<ZodRawShape> | any;
  omitFields?: string[];
  customValidations?: ZodRawShape;
  validationMode?: 'strict' | 'partial' | 'auto';
  validationModifierHandler?: (
    baseSchema: ZodObject<ZodRawShape>
  ) => ZodObject<ZodRawShape>;
  inferTable?: any;
  context?: { operation?: 'create' | 'update' | 'read' | 'other' };
};

/**
 * Get the validation schema for an action
 * @param validation - The validation configuration object
 * @returns A Zod object schema with applied validations
 */
export const getValidationSchema = (
  validation: Validation
): ZodObject<ZodRawShape> => {
  let schema: any;
  const operation = validation.context?.operation ?? 'other';

  // Step 1: Create base schema
  // Priority: custom zodSchema > inferTable > empty passthrough
  if (validation.zodSchema) {
    schema = validation.zodSchema;
  } else if (validation.inferTable) {
    if (operation === 'create' || operation === 'update') {
      // Use createInsertSchema - drizzle-zod automatically handles optional fields
      // Fields not marked as notNull in the DB schema will be optional
      schema = createInsertSchema(validation.inferTable);
    } else {
      // For 'read' and 'other' operations, use select schema
      schema = createSelectSchema(validation.inferTable);
    }

    // Apply additional omit fields if specified
    if (validation.omitFields && validation.omitFields.length > 0) {
      const omitObj: Record<string, true> = {};
      validation.omitFields.forEach((field) => {
        omitObj[field] = true;
      });

      schema = schema.omit(omitObj);
    }
  } else {
    // No schema source - use passthrough to allow any fields
    schema = z.object({}).passthrough();
  }
  // Step 2: Apply custom validations
  if (validation.customValidations) {
    schema = schema.extend(validation.customValidations);
  }

  // Step 3: Apply validation modifier handler
  if (validation.validationModifierHandler) {
    schema = validation.validationModifierHandler(schema);
  }

  // Step 4: Apply validation mode with auto-detection
  const mode = validation.validationMode ?? 'auto';
  const isEmptySchema = !(
    validation.inferTable ||
    validation.zodSchema ||
    validation.customValidations ||
    validation.validationModifierHandler
  );
  schema = handleValidationMode(schema, mode, operation, isEmptySchema);

  return schema;
};

const handleValidationMode = (
  schema: ZodObject<ZodRawShape>,
  mode: string,
  operation: string,
  isEmptySchema = false
) => {
  // If it's an empty passthrough schema, keep it as-is
  if (isEmptySchema) {
    return schema;
  }

  switch (mode) {
    case 'partial':
      return schema.partial(); // Explicitly partial everywhere
    case 'strict':
      return schema.strict(); // Explicitly strict everywhere
    default:
      // Auto mode: strict for create, partial for update, partial.strict for read
      if (operation === 'create') {
        return schema.strict(); // Strict for create (minus omitted fields)
      }
      if (operation === 'update') {
        return schema.partial(); // Partial for update
      }
      if (operation === 'read') {
        return schema.partial().strict(); // All fields optional, but only valid columns
      }
      return schema; // Default for other operations
  }
};
