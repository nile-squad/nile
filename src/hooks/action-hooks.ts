import type { NileContext } from '../core/context.js';
import { log } from '../internal.config.js';
import type {
  ActionHookResult,
  OnAfterActionHandler,
  OnBeforeActionHandler,
} from '../types/action-hook.js';
import { formatInvalidHookResultError } from '../types/action-hook.js';
import type { Action } from '../types/actions.js';
import { Ok, type SafeResult, safeError } from '../utils/safe-try.js';

export async function executeBeforeActionHook(
  handler: OnBeforeActionHandler | undefined,
  context: NileContext,
  action: Action,
  payload: unknown
): Promise<ActionHookResult> {
  if (!handler) {
    return Ok(true, 'No handler provided');
  }

  try {
    const result = await handler({
      nileContext: context,
      action,
      payload,
    });

    // Validate that the result is a SafeResult
    if (
      !result ||
      typeof result !== 'object' ||
      typeof result.status !== 'boolean' ||
      typeof result.isOk !== 'boolean' ||
      typeof result.isError !== 'boolean'
    ) {
      const errorMessage = formatInvalidHookResultError(result);
      const error_id = log({
        type: 'error',
        message: errorMessage,
        data: { action: action.name, result },
        atFunction: 'executeBeforeActionHook',
      });
      throw safeError(errorMessage, error_id);
    }

    return result;
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      error.status === false
    ) {
      throw error;
    }

    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unknown error in before action hook';
    const error_id = log({
      type: 'error',
      message: `Before action hook execution failed: ${errorMessage}`,
      data: { action: action.name, error },
      atFunction: 'executeBeforeActionHook',
    });
    throw safeError('Before action hook execution failed', error_id);
  }
}

export async function executeAfterActionHook(
  handler: OnAfterActionHandler | undefined,
  context: NileContext,
  action: Action,
  payload: unknown,
  result: SafeResult<any>
): Promise<ActionHookResult> {
  if (!handler) {
    return Ok(true, 'No handler provided');
  }

  try {
    const hookResult = await handler({
      nileContext: context,
      action,
      payload,
      result,
    });

    // Validate that the result is a SafeResult
    if (
      !hookResult ||
      typeof hookResult !== 'object' ||
      typeof hookResult.status !== 'boolean' ||
      typeof hookResult.isOk !== 'boolean' ||
      typeof hookResult.isError !== 'boolean'
    ) {
      const errorMessage = formatInvalidHookResultError(hookResult);
      const error_id = log({
        type: 'error',
        message: errorMessage,
        data: { action: action.name, hookResult },
        atFunction: 'executeAfterActionHook',
      });
      throw safeError(errorMessage, error_id);
    }

    return hookResult;
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      error.status === false
    ) {
      throw error;
    }

    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unknown error in after action hook';
    const error_id = log({
      type: 'error',
      message: `After action hook execution failed: ${errorMessage}`,
      data: { action: action.name, error },
      atFunction: 'executeAfterActionHook',
    });
    throw safeError('After action hook execution failed', error_id);
  }
}
