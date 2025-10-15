import type { Services } from '../types/actions';
import type { AuthContext } from '../types/auth-handler';
import { Ok, type SafeResult, safeError } from '../utils/safe-try';
import { getValidationSchema } from '../utils/validation-utils';
import { resolveAuthHandler } from './auth-handler-resolver';
import { createNileContext } from './context';

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
  onActionHandler?: any;
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
    return safeError(
      authResult.message || 'Authentication failed',
      'auth-failed'
    );
  }

  nileContext.authResult = authResult.data;
  return Ok(undefined);
}

async function executeBeforeHook(
  serverConfig: ServerConfig,
  serviceName: string,
  actionName: string,
  action: any,
  payload: any
): Promise<void> {
  if (!serverConfig.onActionHandler) {
    return;
  }

  const beforeHookResult = await serverConfig.onActionHandler(
    {
      actionName,
      serviceName,
      payload,
      stage: 'before',
    },
    action,
    payload
  );

  if (!beforeHookResult.status) {
    throw new Error(beforeHookResult.message || 'Before hook failed');
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
  serviceName: string,
  actionName: string,
  action: any,
  payload: any,
  actionResult: any
): Promise<void> {
  if (!serverConfig.onActionHandler) {
    return;
  }

  const afterHookResult = await serverConfig.onActionHandler(
    {
      actionName,
      serviceName,
      payload,
      result: actionResult,
      stage: 'after',
    },
    action,
    payload
  );

  if (!afterHookResult.status) {
    throw new Error(afterHookResult.message || 'After hook failed');
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
    return safeError(`Service '${serviceName}' not found`, 'service-not-found');
  }

  const action = service.actions.find((a) => a.name === actionName);
  if (!action) {
    return safeError(
      `Action '${actionName}' not found in service '${serviceName}'`,
      'action-not-found'
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

    await executeBeforeHook(
      serverConfig,
      serviceName,
      actionName,
      action,
      payload
    );
    validatePayload(action, payload);

    const actionResult = await action.handler(payload, nileContext as any);

    await executeAfterHook(
      serverConfig,
      serviceName,
      actionName,
      action,
      payload,
      actionResult
    );

    // remove isOk and isError from actionResult if present
    if ('isOk' in actionResult) {
      (actionResult as any).isOk = undefined;
    }
    if ('isError' in actionResult) {
      (actionResult as any).isError = undefined;
    }

    return actionResult;
  } catch (error) {
    return safeError(
      error instanceof Error ? error.message : 'Unknown error',
      'execution-error'
    );
  }
}
