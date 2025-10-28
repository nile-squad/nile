import { log } from '../internal.config';
import type { Services } from '../types/actions';
import type { AuthContext } from '../types/auth-handler';
import { createPerformanceTracker } from '../utils/performance';
import { Ok, type SafeResult, safeError } from '../utils/safe-try';
import { getValidationSchema } from '../utils/validation-utils';
import { resolveAuthHandler } from './auth-handler-resolver';
import { createNileContext } from './context';
import { type DiagnosticsConfig, logDiagnostic } from './diagnostics';
import { validateHandlerSignature } from './engine/handler-validation';

type ServerConfig = {
  services: Services;
  betterAuth?: {
    instance: any;
  };
  auth?: {
    secret?: string;
    method?: 'cookie' | 'header' | 'payload';
    authHandler?: any;
  };
  onBeforeActionHandler?: any;
  onAfterActionHandler?: any;
  diagnostics?: DiagnosticsConfig;
};

function validateServerConfig(config: any): void {
  if (!config) {
    throw new Error(
      'CRITICAL: serverConfig is required but was not provided. Cannot execute actions without configuration.'
    );
  }

  if (!config.services) {
    throw new Error(
      'CRITICAL: serverConfig.services is required but missing. Define at least one service.'
    );
  }

  if (!Array.isArray(config.services)) {
    throw new Error(
      'CRITICAL: serverConfig.services must be an array. Check your service configuration.'
    );
  }

  if (config.services.length === 0) {
    throw new Error(
      'CRITICAL: serverConfig.services is empty. Register at least one service with actions.'
    );
  }

  for (const service of config.services) {
    if (!service.name) {
      throw new Error(
        'CRITICAL: All services must have a "name" property. Check your service definitions.'
      );
    }

    if (!(service.actions && Array.isArray(service.actions))) {
      throw new Error(
        `CRITICAL: Service "${service.name}" must have an "actions" array. Check your service configuration.`
      );
    }

    for (const action of service.actions) {
      if (!action.name) {
        throw new Error(
          `CRITICAL: All actions in service "${service.name}" must have a "name" property.`
        );
      }

      if (!action.handler || typeof action.handler !== 'function') {
        throw new Error(
          `CRITICAL: Action "${action.name}" in service "${service.name}" must have a "handler" function.`
        );
      }
    }
  }
}

export type UnifiedExecutionParams = {
  serviceName: string;
  actionName: string;
  payload?: any;
  serverConfig: ServerConfig;
  authInput: {
    headers?: Headers;
    cookies?: Record<string, string>;
    payloadAuthToken?: string;
  };
  interfaceContext?: {
    hono?: any;
    ws?: any;
    rpc?: any;
  };
};

export type UnifiedExecutionResult = SafeResult<any>;

async function handleAuthentication(
  action: any,
  serverConfig: ServerConfig,
  authInput: UnifiedExecutionParams['authInput'],
  nileContext: any
): Promise<SafeResult<void>> {
  if (action.isProtected === false) {
    return Ok(undefined);
  }

  const authHandler = resolveAuthHandler(serverConfig);
  if (!authHandler) {
    throw new Error(
      'CRITICAL: Action is protected but no auth handler configured. Set serverConfig.auth.authHandler or use BetterAuth.'
    );
  }

  const authContext: AuthContext = {
    request: null,
    headers: authInput.headers,
    cookies: authInput.cookies,
    payload: authInput.payloadAuthToken
      ? { auth: { token: authInput.payloadAuthToken } }
      : undefined,
  };

  const authResult = await authHandler(authContext);
  if (!authResult.status) {
    const error_id = log({
      atFunction: 'handleAuthentication',
      message: authResult.message || 'Authentication failed',
      data: { action: action.name },
      type: 'error',
    });
    return safeError(authResult.message || 'Authentication failed', error_id, {
      error_category: 'auth',
    });
  }

  nileContext.authResult = authResult.data;
  return Ok(undefined);
}

async function executeBeforeHook(
  serverConfig: ServerConfig,
  nileContext: any,
  action: any,
  payload: any
): Promise<void> {
  if (!serverConfig.onBeforeActionHandler) {
    return;
  }

  const beforeHookResult = await serverConfig.onBeforeActionHandler({
    nileContext,
    action,
    payload,
  });

  if (!beforeHookResult.status) {
    const error_id = log({
      atFunction: 'executeBeforeHook',
      message: beforeHookResult.message || 'Authorization failed',
      data: { action: action.name, payload },
      type: 'error',
    });
    const error = new Error(beforeHookResult.message || 'Authorization failed');
    (error as any).category = 'authorization';
    (error as any).error_id = error_id;
    throw error;
  }
}

function validatePayload(action: any, payload: any): void {
  if (!action.validation) {
    return;
  }

  const schema = getValidationSchema(action.validation);
  const validationResult = schema.safeParse(payload);

  if (!validationResult.success) {
    throw new Error(
      `Validation failed: ${JSON.stringify(validationResult.error.issues)}`
    );
  }
}

async function executeAfterHook(
  serverConfig: ServerConfig,
  nileContext: any,
  action: any,
  payload: any,
  result: SafeResult<any>
): Promise<void> {
  if (!serverConfig.onAfterActionHandler) {
    return;
  }

  const afterHookResult = await serverConfig.onAfterActionHandler({
    nileContext,
    action,
    payload,
    result,
  });

  if (!afterHookResult.status) {
    const error_id = log({
      atFunction: 'executeAfterHook',
      message: afterHookResult.message || 'After hook failed',
      data: { action: action.name, payload },
      type: 'error',
    });
    const error = new Error(afterHookResult.message || 'After hook failed');
    (error as any).category = 'execution';
    (error as any).error_id = error_id;
    throw error;
  }
}

async function executeActionBeforeHooks(
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
  const actionsMap = new Map(
    service.actions.map((act: any) => [act.name, act])
  );
  let transformedPayload = payload;

  // Execute before hooks sequentially
  for (const hookDef of action.hooks.before) {
    tracker.startStage(`before-hook:${hookDef.name}`);
    const hookAction = actionsMap.get(hookDef.name) as any;

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

    // biome-ignore lint/nursery/noAwaitInLoop: Hooks must execute sequentially to transform data in pipeline
    const hookResult = await hookAction.handler(
      transformedPayload,
      nileContext as any
    );
    tracker.endStage();

    const hookReport = tracker.getReport();
    const hookDuration = hookReport.stages.at(-1)?.duration;

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
        continue;
      }
      return hookResult;
    }

    logDiagnostic(
      serverConfig.diagnostics,
      'before-hook',
      serviceName,
      actionName,
      { hookName: hookDef.name, duration: hookDuration, status: true }
    );

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

async function executeActionAfterHooks(
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
  const actionsMap = new Map(
    service.actions.map((act: any) => [act.name, act])
  );
  let transformedOutput = actionResult.data;

  // Execute after hooks sequentially
  for (const hookDef of action.hooks.after) {
    tracker.startStage(`after-hook:${hookDef.name}`);
    const hookAction = actionsMap.get(hookDef.name) as any;

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

    // biome-ignore lint/nursery/noAwaitInLoop: Sequential execution required for hook chain where each hook transforms output for the next
    const hookResult = await hookAction.handler(
      transformedOutput,
      nileContext as any
    );
    tracker.endStage();

    const hookReport = tracker.getReport();
    const hookDuration = hookReport.stages.at(-1)?.duration;

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
        continue;
      }
      return hookResult;
    }

    logDiagnostic(
      serverConfig.diagnostics,
      'after-hook',
      serviceName,
      actionName,
      { hookName: hookDef.name, duration: hookDuration, status: true }
    );

    transformedOutput = hookResult.data;
  }

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

export async function executeUnified(
  params: UnifiedExecutionParams
): Promise<UnifiedExecutionResult> {
  const {
    serviceName,
    actionName,
    payload,
    serverConfig,
    authInput,
    interfaceContext,
  } = params;

  validateServerConfig(serverConfig);

  // Initialize performance tracker for diagnostics
  const tracker = createPerformanceTracker();
  tracker.startStage('total-execution');

  logDiagnostic(
    serverConfig.diagnostics,
    'execution-start',
    serviceName,
    actionName,
    { payload: serverConfig.diagnostics?.includePayloads ? payload : undefined }
  );

  const nileContext = createNileContext(interfaceContext);

  tracker.startStage('service-action-lookup');
  const service = serverConfig.services.find((s) => s.name === serviceName);
  if (!service) {
    const error_id = log({
      atFunction: 'executeUnified',
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

  const action = service.actions.find((a) => a.name === actionName);
  if (!action) {
    const error_id = log({
      atFunction: 'executeUnified',
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

  try {
    tracker.startStage('authentication');
    const authResult = await handleAuthentication(
      action,
      serverConfig,
      authInput,
      nileContext
    );
    tracker.endStage();

    const authReport = tracker.getReport();
    const authDuration = authReport.stages.at(-1)?.duration;

    if (!authResult.status) {
      logDiagnostic(
        serverConfig.diagnostics,
        'authentication',
        serviceName,
        actionName,
        { duration: authDuration, status: false, error: authResult.message }
      );
      return authResult;
    }

    logDiagnostic(
      serverConfig.diagnostics,
      'authentication',
      serviceName,
      actionName,
      { duration: authDuration, status: true }
    );

    tracker.startStage('global-before-hook');
    await executeBeforeHook(serverConfig, nileContext, action, payload);
    tracker.endStage();

    const beforeHookReport = tracker.getReport();
    const beforeHookDuration = beforeHookReport.stages.at(-1)?.duration;
    logDiagnostic(
      serverConfig.diagnostics,
      'global-before-hook',
      serviceName,
      actionName,
      { duration: beforeHookDuration, status: true }
    );

    tracker.startStage('payload-validation');
    validatePayload(action, payload);
    tracker.endStage();

    const validationReport = tracker.getReport();
    const validationDuration = validationReport.stages.at(-1)?.duration;
    logDiagnostic(
      serverConfig.diagnostics,
      'payload-validation',
      serviceName,
      actionName,
      { duration: validationDuration, status: true }
    );

    // Validate handler signature before execution
    try {
      validateHandlerSignature(
        action.handler as (...args: unknown[]) => unknown
      );
    } catch (error) {
      const error_id = log({
        atFunction: 'executeUnified',
        message: `Handler signature validation failed for action '${action.name}'`,
        data: { actionName: action.name, error },
        type: 'error',
      });
      return safeError(
        `Handler signature validation failed for action '${action.name}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        error_id,
        { error_category: 'execution' }
      );
    }

    // Execute action-level before hooks if configured
    const beforeHooksResult = await executeActionBeforeHooks(
      action,
      service,
      payload,
      nileContext,
      tracker,
      serverConfig,
      serviceName,
      actionName
    );
    if (!beforeHooksResult.status) {
      return beforeHooksResult;
    }
    const transformedPayload = beforeHooksResult.data;

    // Execute main handler with transformed payload
    tracker.startStage('main-handler');
    const actionResult = await action.handler(
      transformedPayload,
      nileContext as any
    );
    tracker.endStage();

    const handlerReport = tracker.getReport();
    const handlerDuration = handlerReport.stages.at(-1)?.duration;
    logDiagnostic(
      serverConfig.diagnostics,
      'main-handler',
      serviceName,
      actionName,
      { duration: handlerDuration, status: actionResult.status }
    );

    // Execute action-level after hooks if configured
    const finalResult = await executeActionAfterHooks(
      action,
      service,
      actionResult,
      nileContext,
      tracker,
      serverConfig,
      serviceName,
      actionName
    );

    tracker.startStage('global-after-hook');
    await executeAfterHook(
      serverConfig,
      nileContext,
      action,
      payload,
      finalResult
    );
    tracker.endStage();

    const afterHookReport = tracker.getReport();
    const afterHookDuration = afterHookReport.stages.at(-1)?.duration;
    logDiagnostic(
      serverConfig.diagnostics,
      'global-after-hook',
      serviceName,
      actionName,
      { duration: afterHookDuration, status: true }
    );

    tracker.endStage(); // End total-execution
    const totalReport = tracker.getReport();
    logDiagnostic(
      serverConfig.diagnostics,
      'execution-complete',
      serviceName,
      actionName,
      { duration: totalReport.totalDuration, status: finalResult.status }
    );

    return finalResult;
  } catch (error) {
    tracker.endStage(); // End total-execution on error
    const totalReport = tracker.getReport();

    const error_id = log({
      atFunction: 'executeUnified',
      message: error instanceof Error ? error.message : 'Unknown error',
      data: { serviceName, actionName, error },
      type: 'error',
    });

    logDiagnostic(
      serverConfig.diagnostics,
      'execution-error',
      serviceName,
      actionName,
      {
        duration: totalReport.totalDuration,
        status: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    );

    return safeError(
      error instanceof Error ? error.message : 'Unknown error',
      error_id,
      { error_category: 'execution' }
    );
  }
}
