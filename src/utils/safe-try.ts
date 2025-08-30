// type Data = Record<string, any> | Record<string, any>[];

/**
 * Represents a successful operation result.
 */
export type _Ok<T> = {
  status: true;
  message: string;
  data: T;
};

/**
 * Represents an unsuccessful operation result.
 */
export type _Error = {
  status: false;
  message: string;
  data: {
    error_id: string;
  };
};

export type SafeResult<T> = _Ok<T> | _Error;

/**
 * Type guard to check if the result is an _Ok type.
 * @param obj - The result object to check.
 * @returns True if the result is an _Ok type.
 */
export const isOk = <T>(obj: _Ok<T> | _Error): obj is _Ok<T> => obj.status;

/**
 * Type guard to check if the result is an _Error type.
 * @param obj - The result object to check.
 * @returns True if the result is an _Error type.
 */
export const isError = <T>(obj: _Ok<T> | _Error): obj is _Error => !obj.status;

/**
 * Creates an _Ok object.
 * @param data - The data associated with the success.
 * @param message - An optional message, defaults to 'Success'.
 * @returns An _Ok type object.
 */
export const Ok = <T>(data: T, message = 'Success'): _Ok<T> => ({
  status: true,
  message,
  data,
});

/**
 * Creates an _Error object.
 * @param message - The error message.
 * @param error_id - A unique identifier for the error.
 * @param other - Optional additional data to include in the error.
 * @returns An _Error type object.
 */
export const safeError = (
  message: string,
  error_id: string,
  other?: Record<string, any>
): _Error => ({
  status: false,
  message,
  data: {
    error_id,
    ...other,
  },
});

/**
 * Executes a function and returns a SafeResult with the result or error.
 * @param fn - The synchronous or asynchronous function to execute.
 * @param throwTheError - If true, rethrows the error on catch.
 * @returns An object containing the result or error.
 */
export const safeTry = async <T>(
  fn: () => Promise<T>,
  throwTheError = false
) => {
  let result: T | null = null;
  let error: any = null;
  try {
    result = await fn();
  } catch (e) {
    console.error(e);
    if (throwTheError) {
      throw e;
    }
    error = e;
  }

  return { result, error };
};

// references
// https://youtu.be/Y6jT-IkV0VM
// https://github.com/supermacro/neverthrow
// idea: add pattern matching?
// ok and error - result pattern
