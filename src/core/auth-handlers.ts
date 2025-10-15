import { verify } from 'hono/jwt';
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
        return safeError(
          'No headers provided for betterauth authentication',
          'betterauth-no-headers'
        );
      }

      const result = await betterAuthInstance.api.getSession({ headers });

      if (!(result?.user && result?.session)) {
        return safeError(
          'No valid betterauth session found',
          'betterauth-no-session'
        );
      }

      const userId = extractUserId(result.user);
      const organizationId = extractOrganizationId(result.user, result.session);

      if (!(userId && organizationId)) {
        return safeError(
          'Missing userId or organizationId in betterauth session',
          'betterauth-missing-fields'
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
      return safeError(
        `BetterAuth authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'betterauth-error'
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
    return safeError(
      'Authorization header must use Bearer scheme',
      'jwt-invalid-header-format'
    );
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

export function createJWTHandler(
  secret: string,
  method: 'cookie' | 'header' | 'payload'
): AuthHandler {
  return async (context: AuthContext): Promise<AuthHandlerResult> => {
    try {
      let token: string | null | AuthHandlerResult = null;

      if (method === 'cookie') {
        token = extractTokenFromCookie(context);
      } else if (method === 'header') {
        token = extractTokenFromHeader(context);
        if (token && typeof token !== 'string') {
          return token;
        }
      } else if (method === 'payload') {
        token = extractTokenFromPayload(context);
      }

      if (!token) {
        return safeError(`No JWT token found in ${method}`, 'jwt-no-token');
      }

      const payload = await verify(token as string, secret);

      if (!payload) {
        return safeError('Invalid JWT token', 'jwt-invalid-token');
      }

      const userId = extractUserId(payload);
      const organizationId = extractOrgIdFromPayload(payload);

      if (!(userId && organizationId)) {
        return safeError(
          'Missing userId or organizationId in JWT token',
          'jwt-missing-fields'
        );
      }

      return Ok({
        userId,
        organizationId,
        user: payload,
        method: payload.type === 'agent' ? 'agent' : 'jwt',
      });
    } catch (error) {
      return safeError(
        `JWT authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'jwt-error'
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
