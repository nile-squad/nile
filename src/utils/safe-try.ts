// type Data = Record<string, any> | Record<string, any>[];

/*
 * A successful operation result.
 * Properties:
 *   - status: true (indicates success)
 *   - message: string (success message)
 *   - data: T (result data)
 *   - isOk?: true (optional, always true if present)
 */
/*
 * A successful operation result.
 * Properties:
 *   - status: true (indicates success)
 *   - message: string (success message)
 *   - data: T (result data)
 *   - isOk: true (discriminant)
 *   - isError: false (discriminant)
 */
export type _Ok<T> = {
  status: true;
  message: string;
  data: T;
  isOk: true;
  isError: false;
};

/*
 * An unsuccessful operation result.
 * Properties:
 *   - status: false (indicates failure)
 *   - message: string (error message)
 *   - data: { error_id: string, ... } (error details)
 *   - isError?: true (optional, always true if present)
 */
/*
 * An unsuccessful operation result.
 * Properties:
 *   - status: false (indicates failure)
 *   - message: string (error message)
 *   - data: { error_id: string, ... } (error details)
 *   - isOk: false (discriminant)
 *   - isError: true (discriminant)
 */
export type _Error = {
  status: false;
  message: string;
  data: {
    error_id: string;
    [key: string]: any;
  };
  isOk: false;
  isError: true;
};

export type SafeResult<T> = _Ok<T> | _Error;

/**
 * Type guard to check if the result is an _Ok type.
 * @param obj - The result object to check.
 * @returns True if the result is an _Ok type.
 */
export const isOk = <T>(obj: _Ok<T> | _Error): obj is _Ok<T> =>
  obj.isOk === true;

/**
 * Type guard to check if the result is an _Error type.
 * @param obj - The result object to check.
 * @returns True if the result is an _Error type.
 */
export const isError = <T>(obj: _Ok<T> | _Error): obj is _Error =>
  obj.isError === true;

/**
 * Creates an _Ok object.
 * @param data - The data associated with the success.
 * @param message - An optional message, defaults to 'Success'.
 * @returns An _Ok type object with isOk: true.
 */
export const Ok = <T>(data: T, message = 'Success'): _Ok<T> => ({
  status: true,
  message,
  data,
  isOk: true,
  isError: false,
});

/**
 * Creates an _Error object.
 * @param message - The error message.
 * @param error_id - A unique identifier for the error.
 * @param other - Optional additional data to include in the error.
 * @returns An _Error type object with isError: true.
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
  isOk: false,
  isError: true,
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
