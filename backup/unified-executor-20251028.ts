import { log } from '../internal.config';
import type { Services } from '../types/actions';
import type { AuthContext } from '../types/auth-handler';
import { Ok, type SafeResult, safeError } from '../utils/safe-try';
import { getValidationSchema } from '../utils/validation-utils';
import { resolveAuthHandler } from './auth-handler-resolver';
import { createNileContext } from './context';
import { validateHandlerSignature } from './engine/handler-validation';
import { createHookExecutor } from './hooks';

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

  const nileContext = createNileContext(interfaceContext);

  const service = serverConfig.services.find((s) => s.name === serviceName);
  if (!service) {
    const error_id = log({
      atFunction: 'executeUnified',
      message: `Service '${serviceName}' not found`,
      data: { serviceName },
      type: 'error',
    });
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
    return safeError(
      `Action '${actionName}' not found in service '${serviceName}'`,
      error_id,
      { error_category: 'not-found' }
    );
  }

  try {
    const authResult = await handleAuthentication(
      action,
      serverConfig,
      authInput,
      nileContext
    );
    if (!authResult.status) {
      return authResult;
    }

    await executeBeforeHook(serverConfig, nileContext, action, payload);
    validatePayload(action, payload);

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
    let transformedPayload = payload;
    if (action.hooks?.before && action.hooks.before.length > 0) {
      const hookExecutor = createHookExecutor(service.actions);
      const hookResult = await hookExecutor.executeActionWithHooks(
        action,
        transformedPayload,
        nileContext
      );

      if (!hookResult.status) {
        return hookResult;
      }

      transformedPayload = hookResult.data;
    }

    // Execute main handler with transformed payload
    const actionResult = await action.handler(
      transformedPayload,
      nileContext as any
    );

    // Execute action-level after hooks if configured
    let finalResult = actionResult;
    if (action.hooks?.after && action.hooks.after.length > 0) {
      const hookExecutor = createHookExecutor(service.actions);
      const hookResult = await hookExecutor.executeActionWithHooks(
        action,
        finalResult.data,
        nileContext
      );

      if (!hookResult.status) {
        return hookResult;
      }

      finalResult = Ok(hookResult.data, finalResult.message);
    }

    await executeAfterHook(
      serverConfig,
      nileContext,
      action,
      payload,
      finalResult
    );

    return finalResult;
  } catch (error) {
    const error_id = log({
      atFunction: 'executeUnified',
      message: error instanceof Error ? error.message : 'Unknown error',
      data: { serviceName, actionName, error },
      type: 'error',
    });
    return safeError(
      error instanceof Error ? error.message : 'Unknown error',
      error_id,
      { error_category: 'execution' }
    );
  }
}
