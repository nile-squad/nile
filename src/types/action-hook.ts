import type { Action } from './actions';

export type Context = {
  user: any | null;
  session: any | null;
  request: any;
  service?: any;
};

export type ActionHookResult = true | { error: string };

export type ActionHookHandler = (
  context: Context,
  action: Action,
  payload: unknown
) => ActionHookResult | Promise<ActionHookResult>;

export function validateActionHookResult(
  result: unknown
): result is ActionHookResult {
  if (result === true) {
    return true;
  }

  if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
    const obj = result as Record<string, unknown>;
    return typeof obj.error === 'string' && Object.keys(obj).length === 1;
  }

  return false;
}

export function formatInvalidHookResultError(result: unknown): string {
  return `Invalid action hook result. Expected true or { error: string }, got: ${JSON.stringify(result)}`;
}
