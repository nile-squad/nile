import { z as zod, type ZodError } from "zod";
import { fromError, createErrorMap } from "zod-validation-error";

zod.config({
	customError: createErrorMap(),
});

export const formatError = (error: ZodError) => {
	const validationError = fromError(error);
	return validationError;
};
