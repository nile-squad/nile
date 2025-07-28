import { type ZodError, z as zod } from 'zod';
import { createErrorMap, fromError } from 'zod-validation-error';

zod.config({
  customError: createErrorMap(),
});

export const formatError = (error: ZodError) => {
  const validationError = fromError(error);
  return validationError;
};
