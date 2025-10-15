import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { type Context, Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import { rateLimiter } from 'hono-rate-limiter';
import { z } from 'zod';
import { executeUnified } from '../../core/unified-executor';
import type { Services } from '../../types/actions';
import { formatError } from '../../utils/erorr-formatter';
import { sanitizeForUrlSafety } from '../../utils/url-safety';
import { processServices } from '../rpc/service-utils';
import type { WSConfig } from '../ws/types';

// Extend Hono context type to include custom variables
export type AppContext = {
  Variables: {
    user: any | null;
    session: any | null;
    authResult?: any;
  };
};

export const app = new Hono<AppContext>();

let CONFIG: ServerConfig | null = null;
let CURRENT_APP: Hono<AppContext> | null = null;

export type AgenticHandler = (payload: {
  input: string;
  organization_id: string;
  user_id: string;
}) => Promise<string>;

export type ServerConfig = {
  serverName: string;
  baseUrl: string;
  apiVersion: string;
  services: Services;
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
  agenticConfig?: {
    handler: AgenticHandler;
  };
  betterAuth?: {
    instance: {
      api: {
        getSession: (options: { headers: Headers }) => Promise<{
          user: any;
          session: any;
        } | null>;
      };
      handler: (request: Request) => Promise<Response> | Response;
    };
  };
  authSecret?: string; // Deprecated: use auth.secret instead
  auth?: {
    secret: string;
    method: 'cookie' | 'payload' | 'header';
    cookieName?: string;
    headerName?: string;
    authHandler?:
      | import('../../types/auth-handler.js').AuthHandler
      | 'betterauth'
      | 'jwt';
  };
  websocket?: WSConfig;
  onActionHandler?: import('../../types/action-hook.js').ActionHookHandler;
};

const postRequestSchema = z.object({
  resourceId: z.string().optional(),
  action: z.string(),
  payload: z.object({}),
  auth: z
    .object({
      token: z.string(),
    })
    .optional(),
});

const ASSETS_REGEX = /^\/assets\//;
const TRAILING_SLASH_REGEX = /\/+$/;
const HTTP_SCHEME_REGEX = /^https?:\/\//;
const JOIN_TRAILING_SLASH_REGEX = /\/+$/;
const JOIN_EDGE_SLASHES_REGEX = /^\/+|\/+$/g;

/**
 * Main configuration function for REST-RPC server
 * Sets up routes, authentication, and service handlers
 */
export const createRestRPC = (config: ServerConfig) => {
  CONFIG = config;
  const restApp = new Hono<AppContext>();
  CURRENT_APP = restApp;
  const createdRoutes: Record<string, any>[] = [];
  const prefix = `${config.baseUrl}/${config.apiVersion}/services`;
  const host = config.host || '0.0.0.0';
  const port = config.port || '8000';

  // Build a clean origin (scheme + host [+ port]) without duplications
  const origin = (() => {
    try {
      const u = new URL(host);
      // Ensure port is included if not already present
      if (!u.port && port !== '80' && port !== '443') {
        u.port = port;
      }
      return u.origin;
    } catch {
      const h = host.replace(TRAILING_SLASH_REGEX, '');
      if (HTTP_SCHEME_REGEX.test(h)) {
        try {
          const url = new URL(h);
          // Ensure port is included if not already present
          if (!url.port && port !== '80' && port !== '443') {
            url.port = port;
          }
          return url.origin;
        } catch {
          return h;
        }
      }
      if (h.includes(':')) {
        return `http://${h}`;
      }
      return `http://${h}:${port}`;
    }
  })();

  const joinUrl = (...parts: string[]) =>
    parts
      .filter(Boolean)
      .map((p, i) =>
        i === 0
          ? p.replace(JOIN_TRAILING_SLASH_REGEX, '')
          : p.replace(JOIN_EDGE_SLASHES_REGEX, '')
      )
      .join('/');

  restApp.use(
    '*',
    cors({
      origin: (reqOrigin) => {
        if (config.allowedOrigins.length > 0) {
          return config.allowedOrigins.includes(reqOrigin ?? '')
            ? reqOrigin
            : '';
        }
        return '*';
      },
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['POST', 'GET', 'OPTIONS'],
      exposeHeaders: ['Content-Length'],
      maxAge: 600,
    })
  );

  const authMiddleware = createMiddleware<{
    Variables: {
      user: any | null;
      session: any | null;
    };
  }>(async (c, next) => {
    // console.log('Auth middleware running for path:', c.req.path);

    if (!config.betterAuth?.instance) {
      c.set('user', null);
      c.set('session', null);
      await next();
      return;
    }

    const session = await config.betterAuth.instance.api.getSession({
      headers: c.req.raw.headers,
    });

    if (session) {
      c.set('user', session.user);
      c.set('session', session.session);
    } else {
      c.set('user', null);
      c.set('session', null);
    }

    await next();
  });

  restApp.use('*', authMiddleware);

  if (config.rateLimiting?.limitingHeader) {
    restApp.use(
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

  restApp.get('/', (c) => {
    return c.text('OK');
  });

  // Process services using the reusable utility
  const finalServices = processServices(config);

  // Update config to use processed services so executeUnified() sees the generated actions
  config.services = finalServices;

  const handleFormRequest = async (c: Context<AppContext>) => {
    const formData = await c.req.formData().catch(() => null);
    if (!formData) {
      return {
        actionName: null,
        payload: null,
        payloadAuthToken: null,
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
        payloadAuthToken: null,
        error: c.json({
          status: false,
          message: 'No action specified or invalid in form fields',
          data: {},
        }),
      };
    }

    // Convert FormData to payload object
    const payload: Record<string, any> = {};
    formData.forEach((value, key) => {
      if (key !== 'action') {
        payload[key] = value;
      }
    });

    const authToken = formData.get('auth_token');
    return {
      actionName: requestAction,
      payload,
      payloadAuthToken: authToken ? String(authToken) : null,
      error: null,
    };
  };

  const handleJsonRequest = async (c: Context<AppContext>) => {
    const requestData = await c.req.json().catch(() => null);
    if (!requestData) {
      return {
        actionName: null,
        payload: null,
        payloadAuthToken: null,
        error: c.json(
          {
            status: false,
            message: 'No json data provided',
            data: {},
          },
          400
        ),
      };
    }

    const parsedData = postRequestSchema.safeParse(requestData);
    if (!parsedData.success) {
      return {
        actionName: null,
        payload: null,
        payloadAuthToken: null,
        error: c.json(
          {
            status: false,
            message: 'Invalid request format',
            data: formatError(parsedData.error),
          },
          400
        ),
      };
    }
    const { action, payload, auth } = requestData;
    return {
      actionName: action,
      payload,
      payloadAuthToken: auth?.token,
      error: null,
    };
  };

  finalServices.forEach((s) => {
    restApp.post(`${prefix}/${sanitizeForUrlSafety(s.name)}`, async (c) => {
      // Determine content type and handle accordingly
      const contentType = c.req.header('content-type') || '';
      const isFormData =
        contentType.includes('multipart/form-data') ||
        contentType.includes('application/x-www-form-urlencoded');

      const requestDetails = isFormData
        ? await handleFormRequest(c)
        : await handleJsonRequest(c);

      const { actionName, payload, payloadAuthToken, error } = requestDetails;

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

      const result = await executeUnified({
        serviceName: sanitizeForUrlSafety(s.name),
        actionName,
        payload,
        serverConfig: config,
        authInput: {
          headers: c.req.raw.headers,
          cookies: getCookie(c),
          payloadAuthToken,
        },
        interfaceContext: { hono: c },
      });

      let statusCode: 200 | 400 | 401 = 200;
      if (!result.status) {
        if (
          result.data?.error_id === 'auth-failed' ||
          result.data?.error_id === 'no-auth-handler'
        ) {
          statusCode = 401;
        } else {
          statusCode = 400;
        }
      }
      return c.json(result, statusCode);
    });
    createdRoutes.push(s);
  });

  // GET - /services
  restApp.get(`${prefix}`, (c) => {
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
    restApp.get(`${prefix}/schema`, (c) => {
      return c.json({
        status: true,
        message: `${config.serverName} Services actions zod Schemas`,
        data: finalServices.map((finalService) => ({
          [s.name]: finalService.actions.map((a) => ({
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
          })),
        })),
      });
    });

    // GET - /services/service
    restApp.get(`${prefix}/${sanitizeForUrlSafety(s.name)}`, (c) => {
      return c.json({
        status: true,
        message: 'Service Details',
        data: {
          name: s.name,
          description: s.description,
          availableActions: s.actions
            .filter((a) => a.visibility?.rest !== false)
            .map((a) => a.name),
        },
      });
    });

    // GET - /services/service/action
    s.actions.forEach((a) => {
      restApp.get(
        `${prefix}/${sanitizeForUrlSafety(s.name)}/${sanitizeForUrlSafety(
          a.name
        )}`,
        (c) => {
          const jsonSchema = a.validation?.zodSchema
            ? z.toJSONSchema(a.validation.zodSchema, { unrepresentable: 'any' })
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
              hooks: a.hooks
                ? {
                    before: a.hooks.before || [],
                    after: a.hooks.after || [],
                  }
                : null,
              pipeline: a.result?.pipeline,
              meta: a.meta ?? null,
            },
          });
        }
      );
    });
  });
  console.log(
    `Services Docs generated (${finalServices.length}): ${joinUrl(origin, prefix)}`
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
    restApp.get(
      '/assets/*',
      serveStatic({
        root: path.resolve(process.cwd(), 'assets'),
        rewriteRequestPath: (p) => p.replace(ASSETS_REGEX, ''),
      })
    );
  }

  // Agentic endpoint - Special case: bypasses unified execution flow
  // This endpoint uses betterauth middleware directly instead of the unified auth handler
  // to provide a simplified interface for agentic/AI interactions
  restApp.post(`${prefix}/agentic`, async (c) => {
    if (!config.agenticConfig?.handler) {
      return c.json({
        status: false,
        message: 'Agentic handler not configured',
        data: {},
      });
    }

    const requestDetails = await handleJsonRequest(c);
    const { payload, error } = requestDetails;

    if (error) {
      return error;
    }

    if (!payload?.input || typeof payload.input !== 'string') {
      return c.json({
        status: false,
        message: 'Input required in payload',
        data: {},
      });
    }

    const user = c.get('user');
    const session = c.get('session');

    if (!(user && session)) {
      return c.json(
        {
          status: false,
          message: 'Unauthorized',
          data: {},
        },
        401
      );
    }

    try {
      const userId = user.id || user.userId;
      const organizationId = session.organizationId;

      const agentPayload = {
        input: payload.input,
        user_id: userId,
        organization_id: organizationId,
      };

      const response = await config.agenticConfig.handler(agentPayload);
      return c.json({
        status: true,
        message: 'Agent response',
        data: { response },
      });
    } catch (agentError) {
      return c.json({
        status: false,
        message: 'Agent processing error',
        data: {
          error:
            agentError instanceof Error ? agentError.message : 'Unknown error',
        },
      });
    }
  });

  // Better Auth endpoints
  if (config.betterAuth?.instance) {
    // Mount Better Auth handler at /auth/* - this is the single handler approach
    restApp.on(['GET', 'POST'], '/auth/*', (c) => {
      const auth = config.betterAuth?.instance;
      if (!auth) {
        return c.json({ status: false, message: 'Auth not configured' }, 500);
      }
      return auth.handler(c.req.raw);
    });

    console.log(
      `Better Auth endpoints available at: ${joinUrl(origin, 'auth/*')}`
    );
  }

  if (config.enableStatus) {
    restApp.get('/status', (c) => {
      return c.json({
        status: true,
        message: `${config.serverName} Server running well 😎`,
        data: {},
      });
    });
  }

  console.log(`static assets are served at: ${joinUrl(origin, 'assets/*')}`);
  console.log(`Full action zod schemas: ${joinUrl(origin, prefix, 'schema')}`);
  console.log(`Access agent at: ${joinUrl(origin, prefix, 'agentic')}`);
  console.log(`check server status: ${joinUrl(origin, 'status')}`);

  restApp.notFound((c) => {
    return c.json(
      {
        status: false,
        message:
          'Route not found. GET is for service info, POST is for actions.',
        data: {},
      },
      404
    );
  });

  return restApp;
};

/** Get the main Hono app instance */
export const useAppInstance = () => CURRENT_APP || app;

/** Get the current server configuration */
export const getAutoConfig = () => CONFIG;

/** Execute onStart callback if configured */
export const onAppStart = () => CONFIG?.onStart?.();
export type AppInstance = typeof app;
