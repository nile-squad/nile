import { createLogger } from '../logging/index.js';
import type {
  ActionHookHandler,
  ActionHookResult,
  Context,
} from '../types/action-hook.js';
import {
  formatInvalidHookResultError,
  validateActionHookResult,
} from '../types/action-hook.js';
import { type _Error, safeError } from '../utils/safe-try.js';

const logger = createLogger('action-hooks');

export async function executeActionHook(
  handler: ActionHookHandler | undefined,
  context: Context,
  action: string,
  payload: unknown
): Promise<ActionHookResult | _Error> {
  if (!handler) {
    return true;
  }

  try {
    const result = await handler(context, action, payload);

    if (!validateActionHookResult(result)) {
      const errorMessage = formatInvalidHookResultError(result);
      const error_id = logger.error({
        message: errorMessage,
        data: { action, result },
        atFunction: 'executeActionHook',
      });
      throw safeError(errorMessage, error_id);
    }

    if (result !== true) {
      const error_id = logger.info({
        message: `Action denied by hook: ${result.error}`,
        data: { action, context: { user: context.user?.id } },
        atFunction: 'executeActionHook',
      });
      return safeError(result.error, error_id);
    }

    return true;
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
      data: { action, error },
      atFunction: 'executeActionHook',
    });
    throw safeError('Action hook execution failed', error_id);
  }
}
