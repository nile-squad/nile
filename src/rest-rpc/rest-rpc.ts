import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Action, Service, Services } from '@nile/src/types/actions';
import { formatError } from '@nile/src/utils/erorr-formatter';
import { isError } from '@nile/src/utils/safe-try';
import { getValidationSchema } from '@nile/src/utils/validation-utils';
import { type Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { verify } from 'hono/jwt';
import { rateLimiter } from 'hono-rate-limiter';
import { z } from 'zod';
import { newServiceActionsFactory } from './actions-factory';

export const app = new Hono();

let CONFIG: ServerConfig | null = null;

export type ServerConfig = {
  serverName: string;
  baseUrl: string;
  apiVersion: string;
  services: Services;
  authSecret: string;
  host?: string;
  port?: string;
  onStart?: () => void;
  db?: {
    instance: any;
    tables: any;
  };
  payloadSchema?: z.ZodType<any> | any;
  enableStatic?: boolean;
  enableStatus?: boolean;
  rateLimiting?: {
    windowMs?: number;
    limit?: number;
    standardHeaders?: boolean;
    limitingHeader: string;
    store?: any;
  };
  allowedOrigins: string[];
  middlewares?: any[];
};

const postRequestSchema = z.object({
  resourceId: z.string().optional(),
  action: z.string(),
  payload: z.object({}),
});

const sanitizeForUrlSafety = (s: string) => {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-') // replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '-') // remove special characters except hyphens
    .replace(/-+/g, '-') // replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // remove hyphens from start and end
};

const ASSETS_REGEX = /^\/assets\//;

export const useRestRPC = (config: ServerConfig) => {
  CONFIG = config;
  const createdRoutes: Record<string, any>[] = [];
  const prefix = `${config.baseUrl}/${config.apiVersion}/services`;
  const host = config.host || '0.0.0.0';
  const port = config.port || '8000';
  const db = config.db?.instance || null;
  const db_tables = config.db?.tables || null;

  app.use('*', cors());

  if (config.rateLimiting?.limitingHeader) {
    app.use(
      rateLimiter({
        windowMs: config.rateLimiting.windowMs || 15 * 60 * 1000, // 15 minutes
        limit: config.rateLimiting.limit || 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
        standardHeaders: true, // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
        keyGenerator: (c) => {
          const _key = c.req.header(config.rateLimiting?.limitingHeader || '');
          if (!_key) {
            throw new Error('Limiting header not provided!');
          }
          return _key;
        },
        store: config.rateLimiting.store ?? undefined, // Redis, MemoryStore, etc. See below.
      })
    );
  }

  app.get('/', (c) => {
    return c.text('OK');
  });

  const services = config.services;

  // const finalServices = services.filter((s) => !s.autoActions);
  const generatedServices: Services = [];

  async function checkAction({
    actionName,
    s,
    c,
    config: _config,
  }: {
    actionName: string;
    s: Service;
    c: Context;
    config: ServerConfig;
  }) {
    const targetAction = s.actions.find((a) => a.name === actionName);
    if (!targetAction) {
      return c.json({
        status: false,
        message: `Action ${actionName} not found in service ${s.name}`,
        data: {},
      });
    }
    if (targetAction.isProtected) {
      const authHeader = c.req.header('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return c.text('Unauthorized', 401);
      }
      const token = authHeader.substring(7);
      const payload = await verify(token, _config.authSecret);
      if (!payload) {
        return c.json(
          {
            status: false,
            message: 'Unauthorized',
            data: {},
          },
          401
        );
      }
    }
    return targetAction;
  }

  const isAction = (value: unknown): value is Action =>
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'handler' in value;

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
  const handleFormRequest = async (c: Context) => {
    const formData = await c.req.formData().catch(() => null);
    if (!formData) {
      return {
        actionName: null,
        payload: null,
        error: c.json({
          status: false,
          message: 'No form data provided',
          data: {},
        }),
      };
    }
    const requestAction = formData.get('action');
    if (!requestAction || typeof requestAction !== 'string') {
      return {
        actionName: null,
        payload: null,
        error: c.json({
          status: false,
          message: 'No action specified or invalid in form fields!',
          data: {},
        }),
      };
    }
    return { actionName: requestAction, payload: null, error: null };
  };

  const handleJsonRequest = async (c: Context, _config: ServerConfig) => {
    const requestData = await c.req.json().catch(() => null);
    if (!requestData) {
      return {
        actionName: null,
        payload: null,
        error: c.json({
          status: false,
          message: 'No json data provided',
          data: {},
        }),
      };
    }

    let extendedSchema = postRequestSchema;
    if (_config.payloadSchema) {
      extendedSchema = postRequestSchema.extend({
        payload: _config.payloadSchema,
      });
    }
    const parsedData = extendedSchema.safeParse(requestData);
    if (!parsedData.success) {
      return {
        actionName: null,
        payload: null,
        error: c.json({
          status: false,
          message: 'Invalid request format',
          data: formatError(parsedData.error),
        }),
      };
    }
    const { action, payload } = requestData;
    return { actionName: action, payload, error: null };
  };

  const processAction = async (
    c: Context,
    s: Service,
    actionName: string,
    _payload: any,
    _config: ServerConfig
  ) => {
    const targetAction = await checkAction({
      actionName,
      s,
      c,
      config: _config,
    });

    if (!isAction(targetAction)) {
      return targetAction;
    }

    if (_payload) {
      const actionPayloadValidation = getValidationSchema(
        targetAction.validation
      );
      const actionPayloadParsed = actionPayloadValidation.safeParse(_payload);
      if (!actionPayloadParsed.success) {
        return c.json({
          status: false,
          message: 'Invalid request format',
          data: formatError(actionPayloadParsed.error),
        });
      }
    }
    if (targetAction.handler) {
      const result = await targetAction.handler(_payload, c);
      if (isError(result)) {
        return c.json(result, 200);
      }
      return c.json(result);
    }
    throw new Error(
      `Handler not found for action ${actionName} of service ${s.name}`
    );
  };

  // console.log(finalServices);
  finalServices.forEach((s) => {
    // POST - /services/service
    app.post(`${prefix}/${sanitizeForUrlSafety(s.name)}`, async (c) => {
      const contentType = c.req.header('content-type') ?? '';
      const isFormRequest =
        contentType.includes('multipart/form-data') ||
        contentType.includes('application/x-www-form-urlencoded');

      let requestDetails: {
        actionName: string | null;
        payload: any;
        error: any;
      };
      if (isFormRequest) {
        requestDetails = await handleFormRequest(c);
      } else {
        requestDetails = await handleJsonRequest(c, config);
      }

      const { actionName, payload, error } = requestDetails;

      if (error) {
        return error;
      }

      if (!actionName) {
        return c.json({
          status: false,
          message: 'Action not found in request',
          data: {},
        });
      }

      return processAction(c, s, actionName, payload, config);
    });
    createdRoutes.push(s);
  });

  // GET - /services
  app.get(`${prefix}`, (c) => {
    return c.json({
      status: true,
      message: `List of all available services on ${config.serverName}.`,
      data: finalServices.map((s) => sanitizeForUrlSafety(s.name)),
    });
  });

  // Generate Docs
  console.log('Generating Services Docs...');
  finalServices.forEach((s) => {
    // GET - /services/schema
    app.get(`${prefix}/schema`, (c) => {
      return c.json({
        status: true,
        message: `${config.serverName} Services actions zod Schemas`,
        data: finalServices.map((finalService) => ({
          [s.name]: finalService.actions.map((a) => ({
            name: a.name,
            description: a.description,
            validation: a.validation?.zodSchema
              ? z.toJSONSchema(a.validation?.zodSchema)
              : null,
          })),
        })),
      });
    });

    // GET - /services/service
    app.get(`${prefix}/${sanitizeForUrlSafety(s.name)}`, (c) => {
      return c.json({
        status: true,
        message: 'Service Details',
        data: {
          name: s.name,
          description: s.description,
          availableActions: s.actions.map((a) => a.name),
        },
      });
    });

    // GET - /services/service/action
    s.actions.forEach((a) => {
      app.get(
        `${prefix}/${sanitizeForUrlSafety(s.name)}/${sanitizeForUrlSafety(
          a.name
        )}`,
        (c) => {
          const jsonSchema = a.validation?.zodSchema
            ? z.toJSONSchema(a.validation.zodSchema)
            : null;
          return c.json({
            status: true,
            message: 'Action Details',
            data: {
              name: a.name,
              description: a.description,
              validation: jsonSchema,
              isProtected: a.isProtected,
              isSpecial: a.isSpecial,
            },
          });
        }
      );
    });
  });
  console.log(
    `Services Docs generated (${finalServices.length}): ${host}:${port}/${prefix}`
  );

  // services preview
  console.table(
    finalServices.map((s) => ({
      service: s.name,
      description: s.description,
      // availableActions: s.actions.map((a) => a.name),
    }))
  );

  // handle any other businesses
  if (config.enableStatic) {
    app.get(
      '/assets/*',
      serveStatic({
        root: path.resolve(process.cwd(), 'assets'),
        rewriteRequestPath: (p) => p.replace(ASSETS_REGEX, ''),
      })
    );
  }

  if (config.enableStatus) {
    app.get('/status', (c) => {
      return c.json({
        status: true,
        message: `${config.serverName} Server running well 😎`,
        data: {},
      });
    });
  }

  console.log(`static assets are served at: ${host}:${port}/assets/*`);
  console.log(`Full action zod schemas: ${host}:${port}/${prefix}/schema`);
  console.log(`check server status: ${host}:${port}/status`);

  app.notFound((c) => {
    return c.text(
      'Oops, route not found, remember GET is for services info and POST is for actions!',
      404
    );
  });

  return app;
};

export const useAppInstance = () => app;
export const useAutoConfig = () => CONFIG;
export const onAppStart = () => CONFIG?.onStart?.();
export type AppInstance = typeof app;
