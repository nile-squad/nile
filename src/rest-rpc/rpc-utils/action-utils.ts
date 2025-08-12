import { verify } from 'hono/jwt';
import type { Action, Service } from '../../types/actions';
import { isError } from '../../utils';
import { formatError as utilFormatError } from '../../utils/erorr-formatter';
import { getValidationSchema } from '../../utils/validation-utils';
import { createHookExecutor } from '../hooks';
import { getAutoConfig } from '../rest-rpc';
import { attachAgentAuth, validateAgenticAction } from './agent-auth';
import type { ActionPayload, ResultsMode, RPCResult } from './types';

function sanitizeForUrlSafety(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getFinalServices(): Service[] {
  const config = getAutoConfig();
  if (!config) {
    throw new Error('REST-RPC not configured');
  }

  const services = config.services;
  const generatedServices: Service[] = [];

  const finalServices = [...services, ...generatedServices].filter(
    (s) => s.actions.length
  );

  return finalServices;
}

async function checkAction(params: {
  actionName: string;
  service: Service;
  auth?: { token: string };
  isAgent?: boolean;
}): Promise<Action | { status: false; message: string; data: any }> {
  const { actionName, service, auth, isAgent = false } = params;
  const config = getAutoConfig();

  if (!config) {
    throw new Error('REST-RPC not configured');
  }

  const targetAction = service.actions.find((a) => a.name === actionName);

  if (!targetAction) {
    return {
      status: false,
      message: `Action ${actionName} not found in service ${service.name}`,
      data: { error_id: 'ACTION_NOT_FOUND' },
    };
  }

  // Check if agent can execute this action
  if (isAgent && !validateAgenticAction(targetAction, isAgent)) {
    return {
      status: false,
      message: `Action ${actionName} not available for agent execution`,
      data: { error_id: 'AGENT_ACTION_BLOCKED' },
    };
  }

  // Check authentication for protected actions
  if (targetAction.isProtected) {
    if (!auth?.token) {
      return {
        status: false,
        message: 'Unauthorized - token required',
        data: { error_id: 'UNAUTHORIZED' },
      };
    }

    try {
      const payload = await verify(auth.token, config.authSecret);
      if (!payload) {
        return {
          status: false,
          message: 'Unauthorized - invalid token',
          data: { error_id: 'INVALID_TOKEN' },
        };
      }
    } catch (_error) {
      return {
        status: false,
        message: 'Unauthorized - token verification failed',
        data: { error_id: 'TOKEN_VERIFICATION_FAILED' },
      };
    }
  }

  return targetAction;
}

function isAction(value: unknown): value is Action {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'handler' in value
  );
}

function formatResult<T>(
  data: T,
  message: string,
  resultsMode: ResultsMode
): RPCResult {
  const result = {
    status: true as const,
    message,
    data,
  };

  if (resultsMode === 'json') {
    return JSON.stringify(result);
  }

  return result;
}

function formatActionError(
  data: any,
  message: string,
  resultsMode: ResultsMode
): RPCResult {
  const result = {
    status: false as const,
    message,
    data,
  };

  if (resultsMode === 'json') {
    return JSON.stringify(result);
  }

  return result;
}

/**
 * Execute a service action with proper authentication and validation
 *
 * @param params - The execution parameters
 * @returns Promise resolving to the action result
 */
export async function executeServiceAction(params: {
  serviceName: string;
  payload: ActionPayload;
  resultsMode?: ResultsMode;
  agentMode?: boolean;
}): Promise<RPCResult> {
  const {
    serviceName,
    payload,
    resultsMode = 'data',
    agentMode = false,
  } = params;

  const finalServices = getFinalServices();
  const service = finalServices.find(
    (s) => sanitizeForUrlSafety(s.name) === sanitizeForUrlSafety(serviceName)
  );

  if (!service) {
    return formatActionError(
      { error_id: 'SERVICE_NOT_FOUND' },
      `Service '${serviceName}' not found`,
      resultsMode
    );
  }

  // Auto-attach agent auth if in agent mode
  const processedPayload = await attachAgentAuth(payload, agentMode);

  const targetAction = await checkAction({
    actionName: processedPayload.action,
    service,
    auth: processedPayload.auth,
    isAgent: agentMode,
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
    const actionPayloadValidation = getValidationSchema(
      targetAction.validation
    );
    const actionPayloadParsed = actionPayloadValidation.safeParse(
      processedPayload.payload
    );

    if (!actionPayloadParsed.success) {
      return formatActionError(
        utilFormatError(actionPayloadParsed.error),
        'Invalid request format',
        resultsMode
      );
    }
  }

  if (!targetAction.handler) {
    return formatActionError(
      { error_id: 'HANDLER_NOT_FOUND' },
      `Handler not found for action ${processedPayload.action} of service ${service.name}`,
      resultsMode
    );
  }

  try {
    let actionResult: any;

    // Use hook executor if action has hooks, otherwise execute normally
    if (targetAction.hooks?.before || targetAction.hooks?.after) {
      const allActions: Action[] = finalServices.flatMap((s) => s.actions);
      const hookExecutor = createHookExecutor(allActions);

      // Create a mock context for hook execution
      const mockContext = {
        req: {
          header: () =>
            processedPayload.auth?.token
              ? `Bearer ${processedPayload.auth.token}`
              : undefined,
        },
      };

      actionResult = await hookExecutor.executeActionWithHooks(
        targetAction,
        processedPayload.payload,
        mockContext as any
      );
    } else {
      // Create a mock context for action execution
      const mockContext = {
        req: {
          header: () =>
            processedPayload.auth?.token
              ? `Bearer ${processedPayload.auth.token}`
              : undefined,
        },
      };

      actionResult = await targetAction.handler(
        processedPayload.payload,
        mockContext as any
      );
    }

    if (isError(actionResult)) {
      return formatActionError(
        actionResult.data,
        actionResult.message,
        resultsMode
      );
    }

    return formatResult(actionResult.data, actionResult.message, resultsMode);
  } catch (error: any) {
    return formatActionError(
      { error_id: 'EXECUTION_ERROR', details: error.message },
      'Action execution failed',
      resultsMode
    );
  }
}
