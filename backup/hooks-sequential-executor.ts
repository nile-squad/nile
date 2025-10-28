// Alternative hook execution using recursion instead of loops
// This avoids await-in-loop lint errors while maintaining sequential execution

import type { SafeResult } from '../utils/safe-try';
import { Ok, safeError } from '../utils/safe-try';

type HookDef = { name: string; canFail: boolean };

export async function executeHooksRecursive(params: {
  hooks: HookDef[];
  index: number;
  currentData: any;
  actionsMap: Map<string, any>;
  nileContext: any;
  tracker: any;
  diagnostics: any;
  serviceName: string;
  actionName: string;
  hookType: 'before' | 'after';
  log: any;
  logDiagnostic: any;
  getLastStageDuration: any;
}): Promise<SafeResult<any>> {
  const {
    hooks,
    index,
    currentData,
    actionsMap,
    nileContext,
    tracker,
    diagnostics,
    serviceName,
    actionName,
    hookType,
    log,
    logDiagnostic,
    getLastStageDuration,
  } = params;

  // Base case: all hooks executed
  if (index >= hooks.length) {
    return Ok(currentData);
  }

  const hookDef = hooks[index];
  tracker.startStage(`${hookType}-hook:${hookDef.name}`);
  const hookAction = actionsMap.get(hookDef.name);

  if (!hookAction) {
    tracker.endStage();
    const error_id = log({
      type: 'error',
      message: `${hookType} hook action '${hookDef.name}' not found`,
      data: { actionName, hookName: hookDef.name },
      atFunction: 'executeHooksRecursive',
    });
    logDiagnostic(diagnostics, `${hookType}-hook-lookup-failed`, serviceName, actionName, {
      hookName: hookDef.name,
      status: false,
    });
    return safeError(
      `${hookType} hook action '${hookDef.name}' not found`,
      error_id,
      { error_category: 'execution' }
    );
  }

  const hookResult = await hookAction.handler(currentData, nileContext);
  tracker.endStage();

  const hookDuration = getLastStageDuration(tracker);

  if (!hookResult.status) {
    logDiagnostic(diagnostics, `${hookType}-hook`, serviceName, actionName, {
      hookName: hookDef.name,
      duration: hookDuration,
      status: false,
      canFail: hookDef.canFail,
    });

    if (hookDef.canFail) {
      // Skip this hook, continue with current data
      return executeHooksRecursive({
        ...params,
        index: index + 1,
        currentData, // Keep current data unchanged
      });
    }
    return hookResult;
  }

  logDiagnostic(diagnostics, `${hookType}-hook`, serviceName, actionName, {
    hookName: hookDef.name,
    duration: hookDuration,
    status: true,
  });

  // Recursive case: execute next hook with transformed data
  return executeHooksRecursive({
    ...params,
    index: index + 1,
    currentData: hookResult.data,
  });
}
