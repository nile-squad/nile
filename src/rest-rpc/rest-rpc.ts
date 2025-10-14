import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { type Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import { rateLimiter } from 'hono-rate-limiter';
import { z } from 'zod';
import { executeActionHook } from '../hooks/action-hooks.js';
import type { Action, Service, Services } from '../types/actions';
import { isError } from '../utils';
import { formatError } from '../utils/erorr-formatter';
import { getValidationSchema } from '../utils/validation-utils';
import { authenticate } from './auth-utils';
import { createHookExecutor } from './hooks';
import { processServices } from './rpc-utils/service-utils';
import type { WSConfig } from './ws/types';

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
  };
  websocket?: WSConfig;
  onActionHandler?: import('../types/action-hook.js').ActionHookHandler;
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
  const createdRoutes: Record<string, any>[] = [];
  const prefix = `${config.baseUrl}/${config.apiVersion}/services`;
  const host = config.host || '0.0.0.0';
  const port = config.port || '8000';

  // Build a clean origin (scheme + host [+ port]) without duplications
  const origin = (() => {
    try {
      const u = new URL(host);
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

  app.use(
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

  app.use('*', authMiddleware);

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

  // Process services using the reusable utility
  const finalServices = processServices(config);

  async function checkAction({
    actionName,
    s,
    c,
    config: _config,
  }: {
    actionName: string;
    s: Service;
    c: Context<AppContext>;
    config: ServerConfig;
  }): Promise<Action | Response> {
    const targetAction = s.actions.find(
      (a) => a.name === actionName && a.visibility?.rest !== false
    );
    if (!targetAction) {
      return c.json({
        status: false,
        message: `Action ${actionName} not found in service ${s.name}`,
        data: {},
      });
    }

    // Default to protected unless explicitly set to false
    // This implements secure-by-default for all POST service actions
    const shouldProtect = targetAction.isProtected !== false;

    if (shouldProtect) {
      // Get request data for payload-based auth
      let requestData: any = null;
      try {
        const contentType = c.req.header('content-type') ?? '';
        if (contentType.includes('application/json')) {
          requestData = await c.req.json().catch(() => null);
        }
      } catch {
        // Ignore errors, requestData will remain null
      }

      const authResult = await authenticate(c, _config, requestData);

      if (!authResult.isAuthenticated) {
        return c.json(
          {
            status: false,
            message: 'Unauthorized',
            data: { error: authResult.error },
          },
          401
        );
      }

      // Store auth result in context for later use
      c.set('authResult', authResult);
    }

    return targetAction;
  }

  const isAction = (value: unknown): value is Action =>
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'handler' in value;

  // Create hook executor with all actions from all services
  const allActions: Action[] = finalServices.flatMap((s) =>
    s.actions.filter((a) => a.visibility?.rpc !== false)
  );
  const hookExecutor = createHookExecutor(allActions);
  const handleFormRequest = async (c: Context<AppContext>) => {
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

  const handleJsonRequest = async (
    c: Context<AppContext>,
    _config: ServerConfig
  ) => {
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

  /**
   * Enrich payload with user context from authentication
   */
  const enrichPayloadWithUserContext = (payload: any, authResult: any) => {
    if (!authResult?.isAuthenticated) {
      return payload || {};
    }

    // Extract user and organization context from auth result
    // For JWT auth: user contains the JWT payload with userId/organizationId
    // For Better Auth: user has id, session has organizationId
    const userId =
      authResult.user?.userId || authResult.user?.id || authResult.user?.sub;
    const organizationId =
      authResult.user?.organizationId ||
      authResult.user?.organization_id ||
      authResult.session?.organizationId;

    if (!(userId && organizationId)) {
      return payload || {};
    }

    let enrichedPayload = {
      ...(payload || {}),
      user_id: userId,
      organization_id: organizationId,
      userId,
      organizationId,
    };

    // inject better auth casing claims, it works with camelCase and snake_case
    if (config.betterAuth?.instance) {
      enrichedPayload = {
        ...enrichedPayload,
        userId,
        organizationId,
      };
    }

    // Add triggered_by for agent users
    if (
      authResult.method === 'agent' &&
      (authResult.session?.triggeredBy || authResult.user?.triggeredBy)
    ) {
      enrichedPayload.triggered_by =
        authResult.session?.triggeredBy || authResult.user?.triggeredBy;
    }

    return enrichedPayload;
  };

  const executeHookIfConfigured = async (
    _config: ServerConfig,
    c: Context<AppContext>,
    action: Action,
    enrichedPayload: any,
    service?: Service
  ) => {
    if (!_config.onActionHandler) {
      return null; // No hook to execute
    }

    try {
      const hookContext = {
        user: c.get('user'),
        session: c.get('session'),
        request: c.req,
        service,
      };

      const hookResult = await executeActionHook(
        _config.onActionHandler,
        hookContext,
        action,
        enrichedPayload
      );

      if (hookResult.isError === true) {
        return c.json(hookResult, 200);
      }
      // If isOk, allow action to proceed
      return null;
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        (error as any).status === false
      ) {
        return c.json(error, 200);
      }
      throw error;
    }
  };

  const validateActionPayload = (
    enrichedPayload: any,
    targetAction: Action,
    c: Context<AppContext>
  ) => {
    if (enrichedPayload && Object.keys(enrichedPayload).length > 0) {
      const actionPayloadValidation = getValidationSchema(
        targetAction.validation
      );
      const actionPayloadParsed =
        actionPayloadValidation.safeParse(enrichedPayload);
      if (!actionPayloadParsed.success) {
        return c.json({
          status: false,
          message: 'Invalid request format',
          data: formatError(actionPayloadParsed.error),
        });
      }
    }
    return null; // Validation passed
  };

  const executeActionHandler = async (
    targetAction: Action,
    enrichedPayload: any,
    c: Context<AppContext>,
    actionHookExecutor: ReturnType<typeof createHookExecutor>,
    actionName: string,
    serviceName: string
  ) => {
    if (!targetAction.handler) {
      throw new Error(
        `Handler not found for action ${actionName} of service ${serviceName}`
      );
    }

    // remove isOk and isError stuff - only needed internally
    const cleanResult = <T extends Record<string, any>>(oldResult: T) => {
      const { isOk: _isOk, isError: _isError, ...rest } = oldResult;
      return rest;
    };

    // Use hook executor if action has hooks, otherwise execute normally
    if (targetAction.hooks?.before || targetAction.hooks?.after) {
      const result = await actionHookExecutor.executeActionWithHooks(
        targetAction,
        enrichedPayload,
        c
      );
      if (isError(result)) {
        return c.json(cleanResult(result), 200);
      }
      return c.json(cleanResult(result));
    }

    const result = await targetAction.handler(enrichedPayload, c);
    if (isError(result)) {
      return c.json(cleanResult(result), 200);
    }
    return c.json(cleanResult(result));
  };

  const processAction = async (
    c: Context<AppContext>,
    s: Service,
    actionName: string,
    _payload: any,
    _config: ServerConfig,
    actionHookExecutor: ReturnType<typeof createHookExecutor>
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

    // Enrich payload with user context from authentication
    const authResult = c.var.authResult;
    const enrichedPayload = enrichPayloadWithUserContext(_payload, authResult);

    // Execute action hook if configured
    const hookResponse = await executeHookIfConfigured(
      _config,
      c,
      targetAction,
      enrichedPayload,
      s
    );
    if (hookResponse) {
      return hookResponse;
    }

    // Validate payload
    const validationResponse = validateActionPayload(
      enrichedPayload,
      targetAction,
      c
    );
    if (validationResponse) {
      return validationResponse;
    }

    // Execute action handler
    return executeActionHandler(
      targetAction,
      enrichedPayload,
      c,
      actionHookExecutor,
      actionName,
      s.name
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

      return processAction(c, s, actionName, payload, config, hookExecutor);
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
    app.get(`${prefix}/${sanitizeForUrlSafety(s.name)}`, (c) => {
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
      app.get(
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
    app.get(
      '/assets/*',
      serveStatic({
        root: path.resolve(process.cwd(), 'assets'),
        rewriteRequestPath: (p) => p.replace(ASSETS_REGEX, ''),
      })
    );
  }

  // Agentic endpoint under services prefix
  app.post(`${prefix}/agentic`, async (c) => {
    const requestDetails = await handleJsonRequest(c, config);
    const { actionName, payload, error } = requestDetails;

    if (error) {
      return error;
    }

    if (!actionName || actionName !== 'agent') {
      return c.json({
        status: false,
        message: "Agentic endpoint requires action: 'agent'",
        data: {},
      });
    }

    // Authentication check for agentic endpoint
    const authResult = await authenticate(c, config, payload);
    if (!authResult.isAuthenticated) {
      return c.json(
        {
          status: false,
          message: 'Unauthorized',
          data: { error: authResult.error },
        },
        401
      );
    }

    if (!config.agenticConfig?.handler) {
      return c.json({
        status: false,
        message: 'Agentic handler not configured',
        data: {},
      });
    }

    if (!payload?.input || typeof payload.input !== 'string') {
      return c.json({
        status: false,
        message: 'Input required in payload',
        data: {},
      });
    }

    try {
      // Enrich payload with auth context (user/org)
      const enriched = enrichPayloadWithUserContext(payload, authResult);
      const userId =
        enriched.user_id ??
        authResult.user?.userId ??
        authResult.user?.sub ??
        authResult.user?.id;
      const organizationId =
        enriched.organization_id ??
        authResult.user?.organizationId ??
        authResult.user?.organization_id ??
        authResult.session?.organizationId;

      const agentPayload = {
        input: enriched.input,
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
    app.on(['GET', 'POST'], '/auth/*', (c) => {
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
    app.get('/status', (c) => {
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

  app.notFound((c) => {
    return c.text(
      'Oops, route not found, remember GET is for services info and POST is for actions!',
      404
    );
  });

  return app;
};

/** Get the main Hono app instance */
export const useAppInstance = () => app;

/** Get the current server configuration */
export const getAutoConfig = () => CONFIG;

/** Execute onStart callback if configured */
export const onAppStart = () => CONFIG?.onStart?.();
export type AppInstance = typeof app;
