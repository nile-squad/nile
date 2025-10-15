import type { NileContext } from '../core/context';
import type { SafeResult } from '../utils/safe-try';
import type { Action } from './actions';
export type ActionHookResult = SafeResult<any>;

/**
 * ActionHookHandler must return a SafeResult (Ok or safeError).
 * Legacy returns like `true` or `{ error: string }` are not allowed.
 */
export type ActionHookHandler = (
  context: NileContext,
  action: Action,
  payload: unknown
) => ActionHookResult | Promise<ActionHookResult>;

export function validateActionHookResult(
  result: unknown
): result is ActionHookResult {
  if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
    const obj = result as Record<string, unknown>;
    // Only accept SafeResult shape
    if (obj.isOk === true && obj.isError === false) {
      return true;
    }
    if (obj.isOk === false && obj.isError === true) {
      return true;
    }
  }
  return false;
}

export function formatInvalidHookResultError(result: unknown): string {
  return `Invalid action hook result. Expected SafeResult (Ok or safeError), got: ${JSON.stringify(result)}`;
}
