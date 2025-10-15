import { z } from 'zod';
import { newServiceActionsFactory } from '../../core/actions-factory';
import type { Service, Services } from '../../types/actions';
import { sanitizeForUrlSafety } from '../../utils/url-safety';
import { getAutoConfig, type ServerConfig } from '../rest/rest-server';
import type { ResultsMode, RPCResult } from './types';

/**
 * Process services with the same logic as rest-rpc.ts
 * Handles auto-generation, metadata merging, and final processing
 */
export const processServices = (serverConfig?: ServerConfig): Service[] => {
  const config = serverConfig || getAutoConfig();
  if (!config) {
    throw new Error('REST-RPC not configured');
  }

  const services = config.services;
  const generatedServices: Services = [];
  const db = config.db?.instance || null;
  const db_tables = config.db?.tables || null;

  // Process each service for auto-generation
  services.forEach((s) => {
    if (s.autoService && s.subs?.length) {
      if (!(db && db_tables)) {
        throw new Error(
          'No database instance or tables provided for auto services to work properly!'
        );
      }
      s.subs.forEach((sub) => {
        if (sub.disabled?.includes('*')) {
          return; // Skip this sub-service entirely
        }
        const { actions: newActions, errors: newErrors } =
          newServiceActionsFactory(sub, db, db_tables);

        if (newErrors.length) {
          throw new Error(
            `Error while generating actions for service ${
              sub.name
            }: ${newErrors.join(', ')}`
          );
        }
        const finalActions = newActions.filter(
          (a) => !sub.disabled?.includes(a.name as any)
        );
        generatedServices.push({
          ...sub,
          actions: [...sub.actions, ...finalActions],
        });
      });
    }
  });

  const finalServices = [...services, ...generatedServices].filter(
    (s) => s.actions.length
  );

  // Pre-process all actions to merge service-level meta with action-level meta.
  // This ensures that all actions, whether custom or auto-generated,
  // have a consistent and merged view of metadata from both the service and action levels.
  finalServices.forEach((service) => {
    service.actions = service.actions.map((action) => {
      const mergedMeta = { ...(service.meta || {}), ...(action.meta || {}) };
      // Default the action type to 'custom' if not explicitly set.
      // This ensures that all actions have a reliable type for the access control hook.
      const actionType = action.type || 'custom';
      return {
        ...action,
        meta: mergedMeta,
        type: actionType,
      };
    });
  });

  return finalServices;
};

const getFinalServices = (serverConfig?: ServerConfig): Service[] => {
  return processServices(serverConfig);
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
    availableActions: service.actions
      .filter((a) => a.visibility?.rpc !== false)
      .map((a) => a.name),
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

  const action = service.actions
    .filter((a) => a.visibility?.rpc !== false)
    .find(
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
    meta: action.meta ?? null,
  };

  return formatResult(actionData, 'Action Details', resultsMode);
};

export const getSchemas = <TMode extends ResultsMode = 'data'>(
  resultsMode: TMode = 'data' as TMode,
  serverConfig?: ServerConfig
): RPCResult<TMode> => {
  const config = serverConfig || getAutoConfig();
  if (!config) {
    throw new Error('REST-RPC not configured');
  }

  const finalServices = processServices(serverConfig);

  const schemaData = finalServices.map((finalService) => ({
    [finalService.name]: finalService.actions.map((a) => {
      try {
        return {
          name: a.name,
          description: a.description,
          validation: a.validation?.zodSchema
            ? z.toJSONSchema(a.validation?.zodSchema, {
                unrepresentable: 'any',
              })
            : null,
          hooks: a.hooks
            ? {
                before: a.hooks.before || [],
                after: a.hooks.after || [],
              }
            : null,
          pipeline: a.result?.pipeline,
          meta: a.meta ?? null,
        };
      } catch (error) {
        console.error(
          `Error generating schema for service: ${finalService.name}, action: ${a.name}, make sure the unrecognized key exists and is set correctly in sub service.`
        );
        throw error;
      }
    }),
  }));

  return formatResult(
    schemaData,
    `${config.serverName} Services actions zod Schemas`,
    resultsMode
  );
};
