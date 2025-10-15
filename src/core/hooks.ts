import { createLog } from '../logging';
import type {
  Action,
  HookContext,
  HookDefinition,
  HookLogEntry,
} from '../types/actions';
import { isError, isOk, Ok, safeError } from '../utils';
import type { SafeResult } from '../utils/safe-try';

/**
 * Creates a hook executor that manages action pipeline execution with before/after hooks
 */
export const createHookExecutor = (actions: Action[]) => {
  const actionsMap = new Map<string, Action>();

  for (const action of actions) {
    actionsMap.set(action.name, action);
  }

  const validateHookExists = (hookName: string): void => {
    if (!actionsMap.has(hookName)) {
      throw new Error(
        `Hook action '${hookName}' not found in registered actions`
      );
    }
  };

  const executeHook = async (
    hookDef: HookDefinition,
    input: any,
    hookContext: HookContext,
    originalContext?: any
  ): Promise<{ success: boolean; output: any; logEntry: HookLogEntry }> => {
    validateHookExists(hookDef.name);

    const action = actionsMap.get(hookDef.name);
    if (!action) {
      throw new Error(
        `Hook action '${hookDef.name}' not found in registered actions`
      );
    }

    const logEntry: HookLogEntry = {
      name: hookDef.name,
      input,
      output: null,
      passed: false,
    };

    try {
      const enhancedContext = originalContext
        ? {
            ...originalContext,
            hookState: hookContext.state,
          }
        : {
            hookState: hookContext.state,
          };

      const result = await action.handler(input, enhancedContext);

      if (isOk(result)) {
        logEntry.output = result.data;
        logEntry.passed = true;
        return { success: true, output: result.data, logEntry };
      }

      logEntry.output = result.data;
      logEntry.passed = false;

      if (!hookDef.canFail) {
        return { success: false, output: result, logEntry };
      }

      return { success: true, output: input, logEntry };
    } catch (error) {
      const errorId = createLog({
        message: `Hook '${hookDef.name}' threw an error`,
        data: { error, input },
        type: 'error',
        atFunction: 'executeHook',
        appName: 'main',
      });

      logEntry.output = error;
      logEntry.passed = false;

      if (!hookDef.canFail) {
        return {
          success: false,
          output: safeError(`Hook '${hookDef.name}' failed`, errorId),
          logEntry,
        };
      }

      return { success: true, output: input, logEntry };
    }
  };

  const executeHooks = async (
    hooks: HookDefinition[],
    initialInput: any,
    hookContext: HookContext,
    originalContext: any,
    phase: 'before' | 'after'
  ): Promise<{ success: boolean; output: any }> => {
    let currentInput = initialInput;

    for (const hookDef of hooks) {
      // biome-ignore lint/nursery/noAwaitInLoop: Sequential execution required for hook chaining
      const { success, output, logEntry } = await executeHook(
        hookDef,
        currentInput,
        hookContext,
        originalContext
      );

      hookContext.log[phase].push(logEntry);

      if (!success) {
        return { success: false, output };
      }

      currentInput = output;
    }

    return { success: true, output: currentInput };
  };

  const executeActionWithHooks = async (
    action: Action,
    data: any,
    originalContext?: any
  ): Promise<SafeResult<any>> => {
    const hookContext: HookContext = {
      actionName: action.name,
      input: data,
      state: {},
      log: {
        before: [],
        after: [],
      },
    };

    try {
      let currentInput = data;

      if (action.hooks?.before) {
        const beforeResult = await executeHooks(
          action.hooks.before,
          currentInput,
          hookContext,
          originalContext,
          'before'
        );

        if (!beforeResult.success) {
          return beforeResult.output;
        }

        currentInput = beforeResult.output;
      }

      const mainResult = await action.handler(
        currentInput,
        originalContext || hookContext
      );
      hookContext.output = isOk(mainResult) ? mainResult.data : undefined;

      if (isError(mainResult)) {
        hookContext.error = new Error(mainResult.message);
        return mainResult;
      }

      let finalOutput = mainResult.data;

      if (action.hooks?.after) {
        const afterResult = await executeHooks(
          action.hooks.after,
          finalOutput,
          hookContext,
          originalContext,
          'after'
        );

        if (!afterResult.success) {
          return afterResult.output;
        }

        finalOutput = afterResult.output;
      }

      if (action.result?.pipeline) {
        return Ok({
          result: finalOutput,
          pipeline: {
            state: hookContext.state,
            log: hookContext.log,
          },
        });
      }

      return Ok(finalOutput);
    } catch (error) {
      const errorId = createLog({
        message: `Action '${action.name}' pipeline failed`,
        data: { error, hookContext },
        type: 'error',
        atFunction: 'executeActionWithHooks',
        appName: 'main',
      });

      return safeError(`Action '${action.name}' pipeline failed`, errorId);
    }
  };

  return {
    executeActionWithHooks,
  };
};
