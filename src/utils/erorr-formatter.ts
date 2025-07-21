import type { ZodError } from 'zod';
import { fromError } from 'zod-validation-error';

export const formatError = (error: ZodError) => {
  const validationError = fromError(error);
  return validationError;
};
