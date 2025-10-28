import { verify } from 'hono/jwt';
import { log } from '../internal.config';
import type {
  AuthContext,
  AuthHandler,
  AuthHandlerResult,
} from '../types/auth-handler';
import { Ok, safeError } from '../utils/safe-try';

export type BetterAuthInstance = {
  api: {
    getSession: (options: { headers: Headers }) => Promise<{
      user: any;
      session: any;
    } | null>;
  };
};

function extractUserId(user: any): string | null {
  return user?.userId || user?.id || user?.sub || null;
}

function extractOrganizationId(user: any, session: any): string | null {
  return (
    user?.organizationId ||
    user?.organization_id ||
    session?.organizationId ||
    session?.organization_id ||
    null
  );
}

export function createBetterAuthHandler(
  betterAuthInstance: BetterAuthInstance
): AuthHandler {
  return async (context: AuthContext): Promise<AuthHandlerResult> => {
    try {
      const headers = context.headers || context.request?.headers;
      if (!headers) {
        const error_id = log({
          atFunction: 'createBetterAuthHandler',
          message: 'No headers provided for betterauth authentication',
          data: { context },
          type: 'error',
        });
        return safeError(
          'No headers provided for betterauth authentication',
          error_id,
          { error_category: 'auth' }
        );
      }

      const result = await betterAuthInstance.api.getSession({ headers });

      if (!(result?.user && result?.session)) {
        const error_id = log({
          atFunction: 'createBetterAuthHandler',
          message: 'No valid betterauth session found',
          data: { result },
          type: 'error',
        });
        return safeError('No valid betterauth session found', error_id, {
          error_category: 'auth',
        });
      }

      const userId = extractUserId(result.user);
      const organizationId = extractOrganizationId(result.user, result.session);

      if (!(userId && organizationId)) {
        const error_id = log({
          atFunction: 'createBetterAuthHandler',
          message: 'Missing userId or organizationId in betterauth session',
          data: {
            userId,
            organizationId,
            user: result.user,
            session: result.session,
          },
          type: 'error',
        });
        return safeError(
          'Missing userId or organizationId in betterauth session',
          error_id,
          { error_category: 'auth' }
        );
      }

      return Ok({
        userId,
        organizationId,
        user: result.user,
        session: result.session,
        method: 'betterauth',
      });
    } catch (error) {
      const error_id = log({
        atFunction: 'createBetterAuthHandler',
        message: `BetterAuth authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: { error },
        type: 'error',
      });
      return safeError(
        `BetterAuth authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error_id,
        { error_category: 'auth' }
      );
    }
  };
}

function extractTokenFromCookie(context: AuthContext): string | null {
  return context.cookies?.auth_token || null;
}

function extractTokenFromHeader(
  context: AuthContext
): AuthHandlerResult | string | null {
  if (!context.headers) {
    return null;
  }

  const authHeader = context.headers.get('authorization');
  if (!authHeader) {
    return null;
  }

  if (!authHeader.startsWith('Bearer ')) {
    const error_id = log({
      atFunction: 'extractTokenFromHeader',
      message: 'Authorization header must use Bearer scheme',
      data: { authHeader },
      type: 'error',
    });
    return safeError('Authorization header must use Bearer scheme', error_id, {
      error_category: 'auth',
    });
  }

  return authHeader.substring(7);
}

function extractTokenFromPayload(context: AuthContext): string | null {
  return context.payload?.auth?.token || null;
}

function extractOrgIdFromPayload(payload: any): string | null {
  return (
    (payload.organizationId as string) ||
    (payload.organization_id as string) ||
    (payload.orgId as string) ||
    null
  );
}

function extractToken(
  context: AuthContext,
  method: 'cookie' | 'header' | 'payload'
): string | null | AuthHandlerResult {
  if (method === 'cookie') {
    return extractTokenFromCookie(context);
  }
  if (method === 'header') {
    const token = extractTokenFromHeader(context);
    if (token && typeof token !== 'string') {
      return token;
    }
    return token;
  }
  return extractTokenFromPayload(context);
}

function validateJWTPayload(
  payload: any,
  userId: string | null,
  organizationId: string | null
): AuthHandlerResult | null {
  if (!(userId && organizationId)) {
    const error_id = log({
      atFunction: 'createJWTHandler',
      message: 'Missing userId or organizationId in JWT token',
      data: { userId, organizationId, payload },
      type: 'error',
    });
    return safeError(
      'Missing userId or organizationId in JWT token',
      error_id,
      { error_category: 'auth' }
    );
  }
  return null;
}

export function createJWTHandler(
  secret: string,
  method: 'cookie' | 'header' | 'payload'
): AuthHandler {
  return async (context: AuthContext): Promise<AuthHandlerResult> => {
    try {
      const token = extractToken(context, method);

      if (token && typeof token !== 'string') {
        return token;
      }

      if (!token) {
        const error_id = log({
          atFunction: 'createJWTHandler',
          message: `No JWT token found in ${method}`,
          data: { method, context },
          type: 'error',
        });
        return safeError(`No JWT token found in ${method}`, error_id, {
          error_category: 'auth',
        });
      }

      const payload = await verify(token, secret);

      if (!payload) {
        const error_id = log({
          atFunction: 'createJWTHandler',
          message: 'Invalid JWT token',
          data: { method },
          type: 'error',
        });
        return safeError('Invalid JWT token', error_id, {
          error_category: 'auth',
        });
      }

      const userId = extractUserId(payload);
      const organizationId = extractOrgIdFromPayload(payload);

      const validationError = validateJWTPayload(
        payload,
        userId,
        organizationId
      );
      if (validationError) {
        return validationError;
      }

      return Ok({
        userId: userId as string,
        organizationId: organizationId as string,
        user: payload,
        method: payload.type === 'agent' ? 'agent' : 'jwt',
      });
    } catch (error) {
      const error_id = log({
        atFunction: 'createJWTHandler',
        message: `JWT authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: { error, method },
        type: 'error',
      });
      return safeError(
        `JWT authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error_id,
        { error_category: 'auth' }
      );
    }
  };
}

export function createAgentHandler(organizationId: string): AuthHandler {
  return (_context: AuthContext): AuthHandlerResult => {
    const agentUserId = `agent-${organizationId}`;

    return Ok({
      userId: agentUserId,
      organizationId,
      method: 'agent',
      type: 'agent',
    });
  };
}
