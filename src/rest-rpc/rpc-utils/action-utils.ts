import { verify } from 'hono/jwt';
import { createLogger } from '../../logging/create-log';
import type { Action, Service } from '../../types/actions';
import { isError, safeTry } from '../../utils';
import { formatError as utilFormatError } from '../../utils/erorr-formatter';

const logger = createLogger('nile-rpc-utils');

import { getValidationSchema } from '../../utils/validation-utils';
import { createHookExecutor } from '../hooks';
import { getAutoConfig, type ServerConfig } from '../rest-rpc';
import { attachAgentAuth, validateAgenticAction } from './agent-auth';
import type { ActionPayload, ResultsMode, RPCResult } from './types';

const sanitizeForUrlSafety = (s: string): string => {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const extractAuthToken = (params: {
  auth?: { token: string };
  context?: any;
  config: ServerConfig;
}): string | null => {
  const { auth, context, config } = params;

  // If no auth config, fall back to payload (backward compatibility)
  if (!config.auth) {
    return auth?.token || null;
  }

  const {
    method,
    cookieName = 'auth_token',
    headerName = 'authorization',
  } = config.auth;

  switch (method) {
    case 'cookie':
      return context?.req?.cookie?.(cookieName) || null;

    case 'payload':
      return auth?.token || null;

    case 'header': {
      const authHeader = context?.req?.header?.(headerName);
      return authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    }

    default:
      return null;
  }
};

const getFinalServices = (serverConfig?: ServerConfig): Service[] => {
  const config = serverConfig || getAutoConfig();
  if (!config) {
    throw new Error('REST-RPC not configured');
  }

  const services = config.services;
  const generatedServices: Service[] = [];

  return [...services, ...generatedServices].filter((s) => s.actions.length);
};

/**
 * Resolve user context for RPC call based on mode and auth claims
 * Industry standard approach: extract user/org from auth token claims
 */
export const resolveUserContext = async (params: {
  agentMode?: boolean;
  organizationId?: string;
  auth?: { token: string };
  context?: any;
  serverConfig?: ServerConfig;
}) => {
  const {
    agentMode = false,
    organizationId: explicitOrgId,
    auth,
    context,
    serverConfig,
  } = params;

  const config = serverConfig || getAutoConfig();
  let authClaims: any = null;

  // Extract claims from auth token if available
  const token = config ? extractAuthToken({ auth, context, config }) : null;

  if (token && config) {
    const authSecret = config.auth?.secret || config.authSecret;
    if (authSecret) {
      try {
        const { error, result } = await safeTry(() =>
          verify(token, authSecret)
        );
        if (!error && result) {
          authClaims = result;
        }
      } catch {
        // Token verification failed, continue without claims
      }
    }
  }

  if (agentMode) {
    // Agent mode: create agent user with org from claims or explicit org
    const orgId =
      explicitOrgId ||
      authClaims?.organizationId ||
      authClaims?.organization_id;
    if (!orgId) {
      const error_id = logger.error({
        message:
          'No organization context available for agent - provide organizationId or ensure auth token contains org claims',
        data: { authClaims, agentMode, explicitOrgId },
        atFunction: 'resolveUserContext',
      });
      return {
        err: 'No organization context available for agent',
        errorId: error_id,
      };
    }

    return {
      result: {
        userId: `agent-${orgId}`,
        organizationId: orgId,
        isAgent: true,
        triggeredBy:
          authClaims?.userId || authClaims?.user_id || authClaims?.sub,
      },
    };
  }

  // System mode: use explicit org or claims org
  const orgId =
    explicitOrgId || authClaims?.organizationId || authClaims?.organization_id;
  if (!orgId) {
    const error_id = logger.error({
      message:
        'No organization context - specify organizationId or ensure auth token contains org claims',
      data: { explicitOrgId, authClaims },
      atFunction: 'resolveUserContext',
    });
    return {
      err: 'No organization context - specify organizationId or ensure auth token contains org claims',
      errorId: error_id,
    };
  }

  return {
    result: {
      userId: 'system',
      organizationId: orgId,
      isAgent: false,
    },
  };
};

export const checkAction = async (params: {
  actionName: string;
  service: Service;
  userContext: {
    userId: string;
    organizationId: string;
    isAgent: boolean;
    triggeredBy?: string;
  };
  auth?: { token: string };
  context?: any;
  serverConfig?: ServerConfig;
}) => {
  const { actionName, service, userContext, auth, context, serverConfig } =
    params;
  const config = serverConfig || getAutoConfig();

  if (!config) {
    throw new Error('REST-RPC not configured');
  }

  const targetAction = service.actions.find((a) => a.name === actionName);

  if (!targetAction) {
    const error_id = logger.error({
      message: `Action ${actionName} not found in service ${service.name}`,
      data: {
        actionName,
        serviceName: service.name,
        availableActions: service.actions.map((a) => a.name),
      },
      atFunction: 'checkAction',
    });
    return {
      status: false,
      message: `Action ${actionName} not found in service ${service.name}`,
      data: { error_id },
    };
  }

  // Check if agent can execute this action
  if (userContext.isAgent && !validateAgenticAction(targetAction)) {
    const error_id = logger.error({
      message: `Action ${actionName} not available for agent execution`,
      data: { actionName, serviceName: service.name, userContext },
      atFunction: 'checkAction',
    });
    return {
      status: false,
      message: `Action ${actionName} not available for agent execution`,
      data: { error_id },
    };
  }

  // Default to protected unless explicitly set to false
  const shouldProtect = targetAction.isProtected !== false;

  if (shouldProtect) {
    // For agent/system mode, skip token verification
    if (userContext.isAgent || userContext.userId === 'system') {
      // Authentication passed via user context resolution
      return targetAction;
    }

    // Standard user authentication (HTTP layer)
    const token = extractAuthToken({ auth, context, config });

    if (!token) {
      const error_id = logger.error({
        message: 'Unauthorized - no authentication token found',
        data: {
          actionName,
          serviceName: service.name,
          userContext,
          authMethod: config.auth?.method,
        },
        atFunction: 'checkAction',
      });
      return {
        status: false,
        message: 'Unauthorized - no authentication token found',
        data: { error_id },
      };
    }

    if (!(config.auth?.secret || config.authSecret)) {
      const error_id = logger.error({
        message:
          'Server configuration error - auth.secret or authSecret not configured',
        data: { actionName, serviceName: service.name },
        atFunction: 'checkAction',
      });
      return {
        status: false,
        message:
          'Server configuration error - auth.secret or authSecret not configured',
        data: { error_id },
      };
    }

    const authSecret = config.auth?.secret || config.authSecret;
    if (!authSecret) {
      const error_id = logger.error({
        message: 'Server configuration error - auth secret not found',
        data: { actionName, serviceName: service.name },
        atFunction: 'checkAction',
      });
      return {
        status: false,
        message: 'Server configuration error - auth secret not found',
        data: { error_id },
      };
    }

    const { error } = await safeTry(() => verify(token, authSecret));
    if (error) {
      const error_id = logger.error({
        message: 'Unauthorized - token verification failed',
        data: { actionName, serviceName: service.name, error: error.message },
        atFunction: 'checkAction',
      });
      return {
        status: false,
        message: 'Unauthorized - token verification failed',
        data: { error_id },
      };
    }
  }

  return targetAction;
};

const isAction = (value: unknown): value is Action => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'handler' in value
  );
};

const formatResult = <T, TMode extends ResultsMode>(
  data: T,
  message: string,
  resultsMode: TMode
): RPCResult<TMode> => {
  const result = {
    status: true as const,
    message,
    data,
  };

  if (resultsMode === 'json') {
    return JSON.stringify(result) as RPCResult<TMode>;
  }

  return result as RPCResult<TMode>;
};

const formatActionError = <TMode extends ResultsMode>(
  data: any,
  message: string,
  resultsMode: TMode
): RPCResult<TMode> => {
  const result = {
    status: false as const,
    message,
    data,
  };

  if (resultsMode === 'json') {
    return JSON.stringify(result) as RPCResult<TMode>;
  }

  return result as RPCResult<TMode>;
};

/**
 * Execute a service action with proper authentication and validation
 * Supports two modes:
 * 1. Agent mode: agentMode=true → agent user + org from auth claims or explicit organizationId
 * 2. System mode: organizationId provided or from auth claims → system user + org
 */
export const executeServiceAction = async <
  TMode extends ResultsMode = 'data',
>(params: {
  serviceName: string;
  payload: ActionPayload;
  context?: any;
  resultsMode?: TMode;
  agentMode?: boolean;
  organizationId?: string;
  serverConfig?: ServerConfig;
}): Promise<RPCResult<TMode>> => {
  const {
    serviceName,
    payload,
    context,
    resultsMode = 'data' as TMode,
    agentMode = false,
    organizationId,
    serverConfig,
  } = params;

  // Resolve user context based on mode and auth claims
  const userContextResult = await resolveUserContext({
    agentMode,
    organizationId,
    auth: payload.auth,
    context,
    serverConfig,
  });

  if (userContextResult.err || !userContextResult.result) {
    return formatActionError(
      { error_id: userContextResult.errorId },
      userContextResult.err || 'Failed to resolve user context',
      resultsMode
    );
  }

  const userContext = userContextResult.result;

  const finalServices = getFinalServices(serverConfig);
  const service = finalServices.find(
    (s) => sanitizeForUrlSafety(s.name) === sanitizeForUrlSafety(serviceName)
  );

  if (!service) {
    const error_id = logger.error({
      message: `Service '${serviceName}' not found`,
      data: {
        serviceName,
        availableServices: finalServices.map((s) => s.name),
      },
      atFunction: 'executeServiceAction',
    });
    return formatActionError(
      { error_id },
      `Service '${serviceName}' not found`,
      resultsMode
    );
  }

  // For agent/system mode, don't attach JWT auth
  const processedPayload =
    agentMode || userContext.userId === 'system'
      ? payload
      : await attachAgentAuth(payload, false);

  const targetAction = await checkAction({
    actionName: processedPayload.action,
    service,
    userContext,
    auth: processedPayload.auth,
    context,
    serverConfig,
  });

  if (!isAction(targetAction)) {
    return formatActionError(
      targetAction.data,
      targetAction.message,
      resultsMode
    );
  }

  // Validate payload if validation schema exists
  if (processedPayload.payload) {
    // First enrich payload for agent/system modes
    let enrichedPayload = processedPayload.payload;

    if (agentMode || userContext.userId === 'system') {
      enrichedPayload = {
        ...enrichedPayload,
        user_id: userContext.userId,
        organization_id: userContext.organizationId,
        userId: userContext.userId,
        organizationId: userContext.organizationId,
      };

      if (userContext.isAgent && userContext.triggeredBy) {
        enrichedPayload.triggered_by = userContext.triggeredBy;
      }
    }

    // Then validate the enriched payload
    const actionPayloadValidation = getValidationSchema(
      targetAction.validation
    );
    const actionPayloadParsed =
      actionPayloadValidation.safeParse(enrichedPayload);

    if (!actionPayloadParsed.success) {
      return formatActionError(
        utilFormatError(actionPayloadParsed.error),
        'Invalid request format',
        resultsMode
      );
    }

    // Update the processed payload with enriched data
    processedPayload.payload = enrichedPayload;
  }

  if (!targetAction.handler) {
    const error_id = logger.error({
      message: `Handler not found for action ${processedPayload.action} of service ${service.name}`,
      data: { actionName: processedPayload.action, serviceName: service.name },
      atFunction: 'executeServiceAction',
    });
    return formatActionError(
      { error_id },
      `Handler not found for action ${processedPayload.action} of service ${service.name}`,
      resultsMode
    );
  }

  const { error: executionErr, result: actionResult } = await safeTry(
    async () => {
      // Create context object that actions will receive
      const mockContext = {
        req: {
          header: () =>
            processedPayload.auth?.token
              ? `Bearer ${processedPayload.auth.token}`
              : undefined,
        },
        get: (key: string) => {
          if (key === 'authResult') {
            return {
              isAuthenticated: true,
              user: {
                id: userContext.userId,
                type: (() => {
                  if (userContext.isAgent) {
                    return 'agent';
                  }
                  if (userContext.userId === 'system') {
                    return 'system';
                  }
                  return 'user';
                })(),
              },
              session: {
                organizationId: userContext.organizationId,
                triggeredBy: userContext.triggeredBy,
              },
              method: userContext.isAgent ? 'agent' : 'system',
            };
          }
          return;
        },
        set: () => {
          // Mock set function - no operation needed
        },
      };

      // Use hook executor if action has hooks, otherwise execute normally
      if (targetAction.hooks?.before || targetAction.hooks?.after) {
        const allActions: Action[] = finalServices.flatMap((s) => s.actions);
        const hookExecutor = createHookExecutor(allActions);

        return await hookExecutor.executeActionWithHooks(
          targetAction,
          processedPayload.payload,
          mockContext as any
        );
      }

      return await targetAction.handler(
        processedPayload.payload,
        mockContext as any
      );
    }
  );

  if (executionErr) {
    const error_id = logger.error({
      message: 'Action execution failed',
      data: {
        error: executionErr.message,
        serviceName,
        actionName: processedPayload.action,
        userContext,
      },
      atFunction: 'executeServiceAction',
    });

    return formatActionError(
      { error_id, details: executionErr.message },
      'Action execution failed',
      resultsMode
    );
  }

  if (!actionResult || isError(actionResult)) {
    if (actionResult) {
      return formatActionError(
        actionResult.data,
        actionResult.message,
        resultsMode
      );
    }
    // actionResult is null, meaning execution failed
    return formatActionError(
      { error: 'Execution returned null' },
      'Action execution failed',
      resultsMode
    );
  }

  return formatResult(actionResult.data, actionResult.message, resultsMode);
};
