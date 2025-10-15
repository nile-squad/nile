import { executeUnified } from '../../core/unified-executor';
import { createLogger } from '../../logging/create-log';
import { sanitizeForUrlSafety } from '../../utils';
import type { ServerConfig } from '../rest/rest-server';
import { attachAgentAuth } from './agent-auth';
import { processServices } from './service-utils';
import type { ActionPayload, ResultsMode, RPCResult } from './types';

const logger = createLogger('nile-rpc-utils');

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

  if (!serverConfig) {
    const error_id = logger.error({
      message: 'Server configuration not provided',
      atFunction: 'executeServiceAction',
    });
    return formatActionError(
      { error_id },
      'Server configuration not provided',
      resultsMode
    );
  }

  const finalServices = processServices(serverConfig);
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

  const processedPayload =
    agentMode || organizationId
      ? payload
      : await attachAgentAuth(payload, false);

  const executionResult = await executeUnified({
    serviceName,
    actionName: processedPayload.action,
    payload: processedPayload.payload,
    serverConfig,
    authInput: {
      headers: context?.req?.headers || {},
      cookies: context?.req?.cookies || {},
      payloadAuthToken: processedPayload.auth?.token,
    },
    interfaceContext: context,
  });

  if (!executionResult.status) {
    return formatActionError(
      executionResult.data,
      executionResult.message,
      resultsMode
    );
  }

  return formatResult(
    executionResult.data,
    executionResult.message,
    resultsMode
  );
};
