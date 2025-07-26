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
  context?: { operation?: 'create' | 'update' | 'other' };
};

/**
 * Generates a Zod validation schema based on the provided validation configuration. Default mode is 'auto'.
 *
 * @param validation - Configuration options for creating the validation schema
 * @param context - Additional context like operation type ('create' | 'update')
 * @returns A Zod object schema with applied validations
 */
export function getValidationSchema(
  validation: Validation
): ZodObject<ZodRawShape> {
  let schema: any;
  const operation = validation.context?.operation ?? 'other';

  // Step 1: Create base schema
  if (validation.inferTable) {
    schema =
      operation === 'create'
        ? createInsertSchema(validation.inferTable)
        : createSelectSchema(validation.inferTable);

    // Apply omit fields if specified
    if (validation.omitFields && validation.omitFields.length > 0) {
      const omitObj: Record<string, true> = {};
      validation.omitFields.forEach((field) => {
        omitObj[field] = true;
      });

      schema = schema.omit(omitObj);
    }
  } else if (validation.zodSchema) {
    schema = validation.zodSchema;
  } else {
    schema = z.object({});
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
  schema = handleValidationMode(schema, mode, operation);

  return schema;
}

const handleValidationMode = (
  schema: ZodObject<ZodRawShape>,
  mode: string,
  operation: string
) => {
  switch (mode) {
    case 'partial':
      return schema.partial(); // Explicitly partial everywhere
    case 'strict':
      return schema.strict(); // Explicitly strict everywhere
    default:
      // Auto mode: strict for create, partial for update
      if (operation === 'create') {
        return schema.strict(); // Strict for create (minus omitted fields)
      }
      if (operation === 'update') {
        return schema.partial(); // Partial for update
      }
      return schema; // Default for other operations
  }
};
