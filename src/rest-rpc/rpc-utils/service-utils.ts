import { z } from 'zod';
import type { Service } from '../../types/actions';
import { getAutoConfig, type ServerConfig } from '../rest-rpc';
import type { ResultsMode, RPCResult } from './types';

const sanitizeForUrlSafety = (s: string) => {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-') // replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '-') // remove special characters except hyphens
    .replace(/-+/g, '-') // replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // remove hyphens from start and end
};

const getFinalServices = (serverConfig?: ServerConfig): Service[] => {
  const config = serverConfig || getAutoConfig();
  if (!config) {
    throw new Error('REST-RPC not configured');
  }

  const services = config.services;
  const generatedServices: Service[] = [];

  // Add logic for generated services if needed
  // This would include the same logic from rest-rpc.ts for auto-generated services

  const finalServices = [...services, ...generatedServices].filter(
    (s) => s.actions.length
  );

  return finalServices;
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

const formatError = <TMode extends ResultsMode>(
  message: string,
  errorId: string,
  resultsMode: TMode
): RPCResult<TMode> => {
  const errorResult = {
    status: false as const,
    message,
    data: { error_id: errorId },
  };

  if (resultsMode === 'json') {
    return JSON.stringify(errorResult) as RPCResult<TMode>;
  }
  return errorResult as RPCResult<TMode>;
};

export const getServices = <TMode extends ResultsMode = 'data'>(
  resultsMode: TMode = 'data' as TMode,
  serverConfig?: ServerConfig
): RPCResult<TMode> => {
  const config = serverConfig || getAutoConfig();
  if (!config) {
    throw new Error('REST-RPC not configured');
  }

  const finalServices = getFinalServices(serverConfig);
  const serviceNames = finalServices.map((s) => sanitizeForUrlSafety(s.name));

  return formatResult(
    serviceNames,
    `List of all available services on ${config.serverName}.`,
    resultsMode
  );
};

export const getServiceDetails = <TMode extends ResultsMode = 'data'>(
  serviceName: string,
  resultsMode: TMode = 'data' as TMode,
  serverConfig?: ServerConfig
): RPCResult<TMode> => {
  const finalServices = getFinalServices(serverConfig);
  const service = finalServices.find(
    (s) => sanitizeForUrlSafety(s.name) === sanitizeForUrlSafety(serviceName)
  );

  if (!service) {
    return formatError(
      `Service '${serviceName}' not found`,
      'SERVICE_NOT_FOUND',
      resultsMode
    );
  }

  const serviceData = {
    name: service.name,
    description: service.description,
    availableActions: service.actions.map((a) => a.name),
  };

  return formatResult(serviceData, 'Service Details', resultsMode);
};

export const getActionDetails = <TMode extends ResultsMode = 'data'>(
  serviceName: string,
  actionName: string,
  resultsMode: TMode = 'data' as TMode,
  serverConfig?: ServerConfig
): RPCResult<TMode> => {
  const finalServices = getFinalServices(serverConfig);
  const service = finalServices.find(
    (s) => sanitizeForUrlSafety(s.name) === sanitizeForUrlSafety(serviceName)
  );

  if (!service) {
    return formatError(
      `Service '${serviceName}' not found`,
      'SERVICE_NOT_FOUND',
      resultsMode
    );
  }

  const action = service.actions.find(
    (a) => sanitizeForUrlSafety(a.name) === sanitizeForUrlSafety(actionName)
  );

  if (!action) {
    return formatError(
      `Action '${actionName}' not found in service '${serviceName}'`,
      'ACTION_NOT_FOUND',
      resultsMode
    );
  }

  const jsonSchema = action.validation?.zodSchema
    ? z.toJSONSchema(action.validation.zodSchema)
    : null;

  const actionData = {
    name: action.name,
    description: action.description,
    validation: jsonSchema,
    isProtected: action.isProtected,
    isSpecial: action.isSpecial,
    hooks: action.hooks
      ? {
          before: action.hooks.before || [],
          after: action.hooks.after || [],
        }
      : null,
    pipeline: action.result?.pipeline,
  };

  return formatResult(actionData, 'Action Details', resultsMode);
};

export const getSchema = <TMode extends ResultsMode = 'data'>(
  resultsMode: TMode = 'data' as TMode,
  serverConfig?: ServerConfig
): RPCResult<TMode> => {
  const config = serverConfig || getAutoConfig();
  if (!config) {
    throw new Error('REST-RPC not configured');
  }

  const finalServices = getFinalServices(serverConfig);

  const schemaData = finalServices.map((finalService) => ({
    [finalService.name]: finalService.actions.map((a) => ({
      name: a.name,
      description: a.description,
      validation: a.validation?.zodSchema
        ? z.toJSONSchema(a.validation?.zodSchema)
        : null,
      hooks: a.hooks
        ? {
            before: a.hooks.before || [],
            after: a.hooks.after || [],
          }
        : null,
      pipeline: a.result?.pipeline,
    })),
  }));

  return formatResult(
    schemaData,
    `${config.serverName} Services actions zod Schemas`,
    resultsMode
  );
};
