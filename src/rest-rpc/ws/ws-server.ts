import { z } from 'zod';
import type { Action, Services } from '../../types/actions';
import { isError } from '../../utils';
import { formatError } from '../../utils/erorr-formatter';
import { getValidationSchema } from '../../utils/validation-utils';
import { newServiceActionsFactory } from '../actions-factory';
import { createHookExecutor } from '../hooks';
import type {
  WSExecuteActionRequest,
  WSGetActionDetailsRequest,
  WSGetSchemasRequest,
  WSGetServiceDetailsRequest,
  WSListServicesRequest,
  WSServerOptions,
  WSSocket,
} from './types';
import { authenticateWS } from './ws-auth';
import {
  createErrorResponse,
  createSuccessResponse,
  handleWSError,
} from './ws-utils';

const sanitizeForUrlSafety = (s: string) => {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const enrichPayloadWithUserContext = (payload: any, authResult: any) => {
  if (!authResult?.isAuthenticated) {
    return payload || {};
  }

  const userId =
    authResult.user?.userId || authResult.user?.id || authResult.user?.sub;
  const organizationId =
    authResult.user?.organizationId ||
    authResult.user?.organization_id ||
    authResult.session?.organizationId;

  if (!(userId && organizationId)) {
    return payload || {};
  }

  const enrichedPayload = {
    ...(payload || {}),
    user_id: userId,
    organization_id: organizationId,
    userId,
    organizationId,
  };

  if (
    authResult.method === 'agent' &&
    (authResult.session?.triggeredBy || authResult.user?.triggeredBy)
  ) {
    enrichedPayload.triggered_by =
      authResult.session?.triggeredBy || authResult.user?.triggeredBy;
  }

  return enrichedPayload;
};

/**
 * Helper function to find and validate service
 */
function findService(finalServices: any[], serviceName: string) {
  return finalServices.find(
    (s) => sanitizeForUrlSafety(s.name) === sanitizeForUrlSafety(serviceName)
  );
}

/**
 * Helper function to find and validate action
 */
function findAction(service: any, actionName: string) {
  return service.actions.find((a: any) => a.name === actionName);
}

/**
 * Helper function to check action protection
 */
function checkActionProtection(action: any, authResult: any) {
  const shouldProtect = action.isProtected !== false;
  if (shouldProtect && !authResult?.isAuthenticated) {
    return { isAuthorized: false, error: authResult?.error };
  }
  return { isAuthorized: true };
}

/**
 * Helper function to validate payload
 */
function validateActionPayload(payload: any, action: any) {
  if (payload && Object.keys(payload).length > 0) {
    const actionPayloadValidation = getValidationSchema(action.validation);
    const actionPayloadParsed = actionPayloadValidation.safeParse(payload);
    if (!actionPayloadParsed.success) {
      return {
        isValid: false,
        error: formatError(actionPayloadParsed.error),
      };
    }
  }
  return { isValid: true };
}

/**
 * Helper function to execute action with or without hooks
 */
async function executeActionHandler(
  action: any,
  payload: any,
  hookExecutor: any
) {
  if (!action.handler) {
    throw new Error(`Handler not found for action ${action.name}`);
  }

  if (action.hooks?.before || action.hooks?.after) {
    return await hookExecutor.executeActionWithHooks(
      action,
      payload,
      undefined // WS doesn't have Hono context
    );
  }

  return await action.handler(payload, undefined);
}

const _isAction = (value: unknown): value is Action =>
  typeof value === 'object' &&
  value !== null &&
  'name' in value &&
  'handler' in value;

export function createWSRPCServer(options: WSServerOptions): void {
  const { io, namespace = '/ws/rpc', serverConfig } = options;
  const nsp = io.of(namespace);

  // Reuse service preparation logic from rest-rpc.ts
  const services = serverConfig.services;
  const generatedServices: Services = [];
  const db = serverConfig.db?.instance || null;
  const db_tables = serverConfig.db?.tables || null;

  // Build finalServices with auto-generated services (reuse from rest-rpc.ts lines 170-201)
  services.forEach((s) => {
    if (s.autoService && s.subs?.length) {
      if (!(db && db_tables)) {
        throw new Error(
          'No database instance or tables provided for auto services to work properly!'
        );
      }
      s.subs.forEach((sub) => {
        const { actions: newActions, errors: newErrors } =
          newServiceActionsFactory(sub, db, db_tables);

        if (newErrors.length) {
          throw new Error(
            `Error while generating actions for service ${
              sub.name
            }: ${newErrors.join(', ')}`
          );
        }
        generatedServices.push({
          ...sub,
          actions: [...sub.actions, ...newActions],
        });
      });
    }
  });

  const finalServices = [...services, ...generatedServices].filter(
    (s) => s.actions.length
  );

  // Create hook executor (reuse from rest-rpc.ts line 201)
  const allActions: Action[] = finalServices.flatMap((s) => s.actions);
  const hookExecutor = createHookExecutor(allActions);

  // Authentication middleware
  nsp.use(async (socket: WSSocket, next: (err?: Error) => void) => {
    try {
      const authResult = await authenticateWS(socket, serverConfig);
      socket.data.authResult = authResult;

      // If authentication failed, reject the connection immediately
      // since consumer should do HTTP auth first before WS connection
      if (!authResult.isAuthenticated) {
        next(new Error('UNAUTHORIZED'));
        return;
      }

      next();
    } catch (_error) {
      next(new Error('UNAUTHORIZED'));
    }
  });

  nsp.on('connection', (socket: WSSocket) => {
    // Event: listServices
    socket.on(
      'listServices',
      (request: WSListServicesRequest, ack: (response: any) => void) => {
        try {
          const serviceNames = finalServices.map((s) =>
            sanitizeForUrlSafety(s.name)
          );
          ack(
            createSuccessResponse(
              'List of all available services',
              serviceNames
            )
          );
        } catch (error) {
          ack(handleWSError(error));
        }
      }
    );

    // Event: getServiceDetails
    socket.on(
      'getServiceDetails',
      (request: WSGetServiceDetailsRequest, ack: (response: any) => void) => {
        try {
          const { service } = request;
          const targetService = findService(finalServices, service);

          if (!targetService) {
            ack(createErrorResponse(`Service ${service} not found`));
            return;
          }

          const serviceDetails = {
            name: targetService.name,
            description: targetService.description,
            availableActions: targetService.actions.map((a: any) => a.name),
          };

          ack(createSuccessResponse('Service Details', serviceDetails));
        } catch (error) {
          ack(handleWSError(error));
        }
      }
    );

    // Event: getActionDetails
    socket.on(
      'getActionDetails',
      (request: WSGetActionDetailsRequest, ack: (response: any) => void) => {
        try {
          const { service, action } = request;
          const targetService = findService(finalServices, service);

          if (!targetService) {
            ack(createErrorResponse(`Service ${service} not found`));
            return;
          }

          const targetAction = findAction(targetService, action);
          if (!targetAction) {
            ack(
              createErrorResponse(
                `Action ${action} not found in service ${service}`
              )
            );
            return;
          }

          const jsonSchema = targetAction.validation?.zodSchema
            ? z.toJSONSchema(targetAction.validation.zodSchema)
            : null;

          const actionDetails = {
            name: targetAction.name,
            description: targetAction.description,
            validation: jsonSchema,
            isProtected: targetAction.isProtected,
            isSpecial: targetAction.isSpecial,
            hooks: targetAction.hooks
              ? {
                  before: targetAction.hooks.before || [],
                  after: targetAction.hooks.after || [],
                }
              : null,
            pipeline: targetAction.result?.pipeline,
          };

          ack(createSuccessResponse('Action Details', actionDetails));
        } catch (error) {
          ack(handleWSError(error));
        }
      }
    );

    // Event: getSchemas
    socket.on(
      'getSchemas',
      (request: WSGetSchemasRequest, ack: (response: any) => void) => {
        try {
          const schemas = finalServices.map((finalService) => ({
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

          ack(createSuccessResponse('Services actions zod Schemas', schemas));
        } catch (error) {
          ack(handleWSError(error));
        }
      }
    );

    // Event: executeAction
    socket.on(
      'executeAction',
      async (request: WSExecuteActionRequest, ack: (response: any) => void) => {
        try {
          const { service, action, payload } = request;

          // Find service
          const targetService = findService(finalServices, service);
          if (!targetService) {
            ack(createErrorResponse(`Service ${service} not found`));
            return;
          }

          // Find action
          const targetAction = findAction(targetService, action);
          if (!targetAction) {
            ack(
              createErrorResponse(
                `Action ${action} not found in service ${service}`
              )
            );
            return;
          }

          // Check protection
          const authResult = socket.data.authResult;
          const authCheck = checkActionProtection(targetAction, authResult);
          if (!authCheck.isAuthorized) {
            ack(createErrorResponse('Unauthorized', authCheck.error));
            return;
          }

          // Enrich payload with user context
          const enrichedPayload = enrichPayloadWithUserContext(
            payload,
            authResult
          );

          // Validate payload
          const validation = validateActionPayload(
            enrichedPayload,
            targetAction
          );
          if (!validation.isValid) {
            ack(
              createErrorResponse('Invalid request format', validation.error)
            );
            return;
          }

          // Execute action
          console.log(
            '[WS SERVER] Executing action:',
            service,
            action,
            enrichedPayload
          );
          const result = await executeActionHandler(
            targetAction,
            enrichedPayload,
            hookExecutor
          );
          console.log('[WS SERVER] Action result:', result);

          // Handle result
          if (isError(result)) {
            ack(result);
          } else {
            ack(result);
          }
        } catch (error) {
          ack(handleWSError(error));
        }
      }
    );
  });
}
