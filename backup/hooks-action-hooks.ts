import type { NileContext } from '../core/context.js';
import { createLogger } from '../logging/index.js';
import type {
  ActionHookHandler,
  ActionHookResult,
} from '../types/action-hook.js';
import { formatInvalidHookResultError } from '../types/action-hook.js';
import type { Action } from '../types/actions.js';
import { Ok, safeError } from '../utils/safe-try.js';

const logger = createLogger('action-hooks');

export async function executeActionHook(
  handler: ActionHookHandler | undefined,
  context: NileContext,
  action: Action,
  payload: unknown
): Promise<ActionHookResult> {
  if (!handler) {
    return Ok(true, 'No handler provided');
  }

  try {
    const result = await handler(context, action, payload);

    // Validate that the result is a SafeResult
    if (
      !result ||
      typeof result !== 'object' ||
      typeof result.status !== 'boolean' ||
      typeof result.isOk !== 'boolean' ||
      typeof result.isError !== 'boolean'
    ) {
      const errorMessage = formatInvalidHookResultError(result);
      const error_id = logger.error({
        message: errorMessage,
        data: { action: action.name, result },
        atFunction: 'executeActionHook',
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
      error instanceof Error ? error.message : 'Unknown error in action hook';
    const error_id = logger.error({
      message: `Action hook execution failed: ${errorMessage}`,
      data: { action: action.name, error },
      atFunction: 'executeActionHook',
    });
    throw safeError('Action hook execution failed', error_id);
  }
}
