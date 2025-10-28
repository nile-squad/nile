/**
 * Runtime validation utilities for action handlers.
 * Ensures handlers match expected signature before execution.
 */

/**
 * Validates that a handler function has the correct signature.
 * Expected signature: (data, context?) => SafeResult
 *
 * @param handler - The handler function to validate
 * @throws Error if handler signature is invalid
 */
export function validateHandlerSignature(
  handler: (...args: unknown[]) => unknown
): void {
  if (typeof handler !== 'function') {
    throw new Error('Handler must be a function');
  }

  if (handler.length < 1 || handler.length > 2) {
    throw new Error(
      `Handler must accept 1-2 parameters (data, context?), got ${handler.length}`
    );
  }
}

/**
 * Type guard to check if an object is a SafeResult.
 *
 * @param obj - The object to check
 * @returns True if the object is a SafeResult
 */
export function isSafeResult(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object' || obj === null) {
    return false;
  }

  const record = obj as Record<string, unknown>;
  return (
    typeof record.status === 'boolean' &&
    'message' in record &&
    'data' in record
  );
}
