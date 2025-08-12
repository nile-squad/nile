import { z } from 'zod';
import type { Service } from '../../types/actions';
import { getAutoConfig } from '../rest-rpc';
import type { ResultsMode, RPCResult } from './types';

function sanitizeForUrlSafety(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-') // replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '-') // remove special characters except hyphens
    .replace(/-+/g, '-') // replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // remove hyphens from start and end
}

function getFinalServices(): Service[] {
  const config = getAutoConfig();
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

export function getServices(resultsMode: ResultsMode = 'data'): RPCResult {
  const config = getAutoConfig();
  if (!config) {
    throw new Error('REST-RPC not configured');
  }

  const finalServices = getFinalServices();
  const serviceNames = finalServices.map((s) => sanitizeForUrlSafety(s.name));

  return formatResult(
    serviceNames,
    `List of all available services on ${config.serverName}.`,
    resultsMode
  );
}

export function getServiceDetails(
  serviceName: string,
  resultsMode: ResultsMode = 'data'
): RPCResult {
  const finalServices = getFinalServices();
  const service = finalServices.find(
    (s) => sanitizeForUrlSafety(s.name) === sanitizeForUrlSafety(serviceName)
  );

  if (!service) {
    const errorResult = {
      status: false as const,
      message: `Service '${serviceName}' not found`,
      data: { error_id: 'SERVICE_NOT_FOUND' },
    };

    if (resultsMode === 'json') {
      return JSON.stringify(errorResult);
    }
    return errorResult;
  }

  const serviceData = {
    name: service.name,
    description: service.description,
    availableActions: service.actions.map((a) => a.name),
  };

  return formatResult(serviceData, 'Service Details', resultsMode);
}

export function getActionDetails(
  serviceName: string,
  actionName: string,
  resultsMode: ResultsMode = 'data'
): RPCResult {
  const finalServices = getFinalServices();
  const service = finalServices.find(
    (s) => sanitizeForUrlSafety(s.name) === sanitizeForUrlSafety(serviceName)
  );

  if (!service) {
    const errorResult = {
      status: false as const,
      message: `Service '${serviceName}' not found`,
      data: { error_id: 'SERVICE_NOT_FOUND' },
    };

    if (resultsMode === 'json') {
      return JSON.stringify(errorResult);
    }
    return errorResult;
  }

  const action = service.actions.find(
    (a) => sanitizeForUrlSafety(a.name) === sanitizeForUrlSafety(actionName)
  );

  if (!action) {
    const errorResult = {
      status: false as const,
      message: `Action '${actionName}' not found in service '${serviceName}'`,
      data: { error_id: 'ACTION_NOT_FOUND' },
    };

    if (resultsMode === 'json') {
      return JSON.stringify(errorResult);
    }
    return errorResult;
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
}

export function getSchema(resultsMode: ResultsMode = 'data'): RPCResult {
  const config = getAutoConfig();
  if (!config) {
    throw new Error('REST-RPC not configured');
  }

  const finalServices = getFinalServices();

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
}
