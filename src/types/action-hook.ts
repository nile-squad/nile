import type { NileContext } from '../core/context';
import type { SafeResult } from '../utils/safe-try';
import type { Action } from './actions';
export type ActionHookResult = SafeResult<any>;

/**
 * OnBeforeActionHandler is called before action execution for authorization.
 * Must return a SafeResult (Ok or safeError).
 */
export type OnBeforeActionHandler = (params: {
  nileContext: NileContext;
  action: Action;
  payload: unknown;
}) => ActionHookResult | Promise<ActionHookResult>;

/**
 * OnAfterActionHandler is called after action execution as an exit gate.
 * Can be used for final cleanup, logging, or transforming the result.
 * Must return a SafeResult (Ok or safeError).
 */
export type OnAfterActionHandler = (params: {
  nileContext: NileContext;
  action: Action;
  payload: unknown;
  result: SafeResult<any>;
}) => ActionHookResult | Promise<ActionHookResult>;

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
