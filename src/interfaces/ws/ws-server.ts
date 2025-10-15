import { z } from 'zod';
import { newServiceActionsFactory } from '../../core/actions-factory';
import { executeUnified } from '../../core/unified-executor';
import type { Services } from '../../types/actions';
import { sanitizeForUrlSafety } from '../../utils';
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

function findService(finalServices: any[], serviceName: string) {
  return finalServices.find(
    (s) => sanitizeForUrlSafety(s.name) === sanitizeForUrlSafety(serviceName)
  );
}

function extractWSAuthInput(socket: WSSocket) {
  const authHeaders = new Headers();
  const authCookies: Record<string, string> = {};

  let token: string | undefined;
  if (socket.handshake.auth?.token) {
    token = socket.handshake.auth.token;
    if (token?.startsWith('Bearer ')) {
      authHeaders.set('Authorization', token);
    } else if (token) {
      authHeaders.set('Authorization', `Bearer ${token}`);
    }
  } else if (socket.handshake.headers.authorization) {
    authHeaders.set('Authorization', socket.handshake.headers.authorization);
  }

  if (socket.handshake.headers.cookie) {
    const cookies = socket.handshake.headers.cookie.split(';');
    for (const cookie of cookies) {
      const [key, value] = cookie.trim().split('=');
      if (key && value) {
        authCookies[key] = value;
      }
    }
  }

  return {
    headers: authHeaders,
    cookies: authCookies,
    payloadAuthToken: token,
  };
}

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

          const targetAction = targetService.actions.find(
            (a: any) => a.name === action
          );
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
          const authInput = extractWSAuthInput(socket);

          const result = await executeUnified({
            serviceName: service,
            actionName: action,
            payload,
            serverConfig,
            authInput,
            interfaceContext: {
              ws: socket,
            },
          });

          ack(result);
        } catch (error) {
          ack(handleWSError(error));
        }
      }
    );
  });
}
