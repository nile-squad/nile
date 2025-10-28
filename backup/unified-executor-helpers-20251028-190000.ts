import { log } from '../internal.config';
import type { SafeResult } from '../utils/safe-try';
import { Ok, safeError } from '../utils/safe-try';
import { type DiagnosticsConfig, logDiagnostic } from './diagnostics';

type ServerConfig = {
  services: any[];
  diagnostics?: DiagnosticsConfig;
};

export function findServiceAndAction(
  serverConfig: ServerConfig,
  serviceName: string,
  actionName: string,
  tracker: any
): SafeResult<{ service: any; action: any }> {
  tracker.startStage('service-action-lookup');

  const service = serverConfig.services.find((s) => s.name === serviceName);
  if (!service) {
    const error_id = log({
      atFunction: 'findServiceAndAction',
      message: `Service '${serviceName}' not found`,
      data: { serviceName },
      type: 'error',
    });
    logDiagnostic(
      serverConfig.diagnostics,
      'service-lookup-failed',
      serviceName,
      actionName,
      { status: false, error: `Service '${serviceName}' not found` }
    );
    return safeError(`Service '${serviceName}' not found`, error_id, {
      error_category: 'not-found',
    });
  }

  const action = service.actions.find((a: any) => a.name === actionName);
  if (!action) {
    const error_id = log({
      atFunction: 'findServiceAndAction',
      message: `Action '${actionName}' not found in service '${serviceName}'`,
      data: { serviceName, actionName },
      type: 'error',
    });
    logDiagnostic(
      serverConfig.diagnostics,
      'action-lookup-failed',
      serviceName,
      actionName,
      { status: false, error: `Action '${actionName}' not found` }
    );
    return safeError(
      `Action '${actionName}' not found in service '${serviceName}'`,
      error_id,
      { error_category: 'not-found' }
    );
  }

  tracker.endStage();

  const lookupReport = tracker.getReport();
  const lookupDuration = lookupReport.stages.at(-1)?.duration;
  logDiagnostic(
    serverConfig.diagnostics,
    'service-action-lookup',
    serviceName,
    actionName,
    { duration: lookupDuration, status: true }
  );

  return Ok({ service, action });
}

export async function executeActionBeforeHooks(
  action: any,
  service: any,
  payload: any,
  nileContext: any,
  tracker: any,
  serverConfig: ServerConfig,
  serviceName: string,
  actionName: string
): Promise<SafeResult<any>> {
  if (!action.hooks?.before || action.hooks.before.length === 0) {
    return Ok(payload);
  }

  tracker.startStage('action-before-hooks');

  // Create action map for hook lookup
  const actionsMap = new Map(
    service.actions.map((act: any) => [act.name, act])
  );
  let transformedPayload = payload;

  // biome-ignore lint/nursery/noAwaitInLoop: Hooks must execute sequentially - each hook transforms data for the next
  for (const hookDef of action.hooks.before) {
    tracker.startStage(`before-hook:${hookDef.name}`);
    const hookAction = actionsMap.get(hookDef.name);

    if (!hookAction) {
      tracker.endStage();
      const error_id = log({
        type: 'error',
        message: `Before hook action '${hookDef.name}' not found`,
        data: { actionName: action.name, hookName: hookDef.name },
        atFunction: 'executeActionBeforeHooks',
      });
      logDiagnostic(
        serverConfig.diagnostics,
        'before-hook-lookup-failed',
        serviceName,
        actionName,
        { hookName: hookDef.name, status: false }
      );
      return safeError(
        `Before hook action '${hookDef.name}' not found`,
        error_id,
        { error_category: 'execution' }
      );
    }

    // Execute hook action
    const hookResult = await (hookAction as any).handler(
      transformedPayload,
      nileContext as any
    );
    tracker.endStage();

    const hookReport = tracker.getReport();
    const hookDuration = hookReport.stages.at(-1)?.duration;

    // Handle hook failure
    if (!hookResult.status) {
      logDiagnostic(
        serverConfig.diagnostics,
        'before-hook',
        serviceName,
        actionName,
        {
          hookName: hookDef.name,
          duration: hookDuration,
          status: false,
          canFail: hookDef.canFail,
        }
      );

      if (hookDef.canFail) {
        // Skip this hook, continue with previous payload
        continue;
      }
      // Critical hook failed, return error
      return hookResult;
    }

    logDiagnostic(
      serverConfig.diagnostics,
      'before-hook',
      serviceName,
      actionName,
      { hookName: hookDef.name, duration: hookDuration, status: true }
    );

    // Use transformed output for next hook or main handler
    transformedPayload = hookResult.data;
  }

  tracker.endStage();
  const beforeHooksReport = tracker.getReport();
  const beforeHooksTotalDuration = beforeHooksReport.stages.find(
    (s: any) => s.stage === 'action-before-hooks'
  )?.duration;
  logDiagnostic(
    serverConfig.diagnostics,
    'action-before-hooks-complete',
    serviceName,
    actionName,
    {
      duration: beforeHooksTotalDuration,
      status: true,
      hooksCount: action.hooks.before.length,
    }
  );

  return Ok(transformedPayload);
}

export async function executeActionAfterHooks(
  action: any,
  service: any,
  actionResult: SafeResult<any>,
  nileContext: any,
  tracker: any,
  serverConfig: ServerConfig,
  serviceName: string,
  actionName: string
): Promise<SafeResult<any>> {
  if (!action.hooks?.after || action.hooks.after.length === 0) {
    return actionResult;
  }

  tracker.startStage('action-after-hooks');

  // Create action map for hook lookup
  const actionsMap = new Map(
    service.actions.map((act: any) => [act.name, act])
  );
  let transformedOutput = actionResult.data;

  // biome-ignore lint/nursery/noAwaitInLoop: Hooks must execute sequentially - each hook transforms data for the next
  for (const hookDef of action.hooks.after) {
    tracker.startStage(`after-hook:${hookDef.name}`);
    const hookAction = actionsMap.get(hookDef.name);

    if (!hookAction) {
      tracker.endStage();
      const error_id = log({
        type: 'error',
        message: `After hook action '${hookDef.name}' not found`,
        data: { actionName: action.name, hookName: hookDef.name },
        atFunction: 'executeActionAfterHooks',
      });
      logDiagnostic(
        serverConfig.diagnostics,
        'after-hook-lookup-failed',
        serviceName,
        actionName,
        { hookName: hookDef.name, status: false }
      );
      return safeError(
        `After hook action '${hookDef.name}' not found`,
        error_id,
        { error_category: 'execution' }
      );
    }

    // Execute hook action
    const hookResult = await (hookAction as any).handler(
      transformedOutput,
      nileContext as any
    );
    tracker.endStage();

    const hookReport = tracker.getReport();
    const hookDuration = hookReport.stages.at(-1)?.duration;

    // Handle hook failure
    if (!hookResult.status) {
      logDiagnostic(
        serverConfig.diagnostics,
        'after-hook',
        serviceName,
        actionName,
        {
          hookName: hookDef.name,
          duration: hookDuration,
          status: false,
          canFail: hookDef.canFail,
        }
      );

      if (hookDef.canFail) {
        // Skip this hook, continue with previous output
        continue;
      }
      // Critical hook failed, return error
      return hookResult;
    }

    logDiagnostic(
      serverConfig.diagnostics,
      'after-hook',
      serviceName,
      actionName,
      { hookName: hookDef.name, duration: hookDuration, status: true }
    );

    // Use transformed output for next hook
    transformedOutput = hookResult.data;
  }

  // Update final result with transformed output
  const finalResult = Ok(transformedOutput, actionResult.message);

  tracker.endStage();
  const afterHooksReport = tracker.getReport();
  const afterHooksTotalDuration = afterHooksReport.stages.find(
    (s: any) => s.stage === 'action-after-hooks'
  )?.duration;
  logDiagnostic(
    serverConfig.diagnostics,
    'action-after-hooks-complete',
    serviceName,
    actionName,
    {
      duration: afterHooksTotalDuration,
      status: true,
      hooksCount: action.hooks.after.length,
    }
  );

  return finalResult;
}
