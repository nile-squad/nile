import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';
import type { ServerConfig } from './rest-rpc';

export interface AuthResult {
  isAuthenticated: boolean;
  user?: any;
  session?: any;
  method?: 'better-auth' | 'jwt' | 'agent';
  error?: string;
}

/**
 * Extract session token from request
 * Supports both Cookie and Authorization header
 */
export const extractSessionToken = (
  c: Context,
  cookieName = 'better-auth.session_token'
): string | null => {
  // Try cookie first
  const cookieToken = getCookie(c, cookieName);
  if (cookieToken) {
    return cookieToken;
  }

  // Try Authorization header with "Session" scheme
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Session ')) {
    return authHeader.substring(8);
  }

  return null;
};

/**
 * Authenticate using Better Auth session
 */
export async function authenticateWithBetterAuth(
  c: Context,
  betterAuthInstance: any,
  cookieName?: string
): Promise<AuthResult> {
  try {
    const sessionToken = extractSessionToken(c, cookieName);
    if (!sessionToken) {
      return { isAuthenticated: false, error: 'No session token found' };
    }

    // Validate session with Better Auth
    const session = await betterAuthInstance.api.getSession({
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
    });

    if (!(session?.data?.session && session?.data?.user)) {
      return { isAuthenticated: false, error: 'Invalid session' };
    }

    return {
      isAuthenticated: true,
      user: session.data.user,
      session: session.data.session,
      method: 'better-auth',
    };
  } catch (error) {
    return {
      isAuthenticated: false,
      error:
        error instanceof Error
          ? error.message
          : 'Better Auth validation failed',
    };
  }
}

/**
 * Authenticate using JWT (legacy method)
 */
export async function authenticateWithJWT(
  c: Context,
  authSecret: string
): Promise<AuthResult> {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return { isAuthenticated: false, error: 'No Bearer token found' };
    }

    const token = authHeader.substring(7);
    const payload = await verify(token, authSecret);

    if (!payload) {
      return { isAuthenticated: false, error: 'Invalid JWT token' };
    }

    return {
      isAuthenticated: true,
      user: payload,
      method: payload.type === 'agent' ? 'agent' : 'jwt',
    };
  } catch (error) {
    return {
      isAuthenticated: false,
      error: error instanceof Error ? error.message : 'JWT validation failed',
    };
  }
}

/**
 * Unified authentication function
 * Tries Better Auth first, then falls back to JWT
 */
export async function authenticate(
  c: Context,
  config: ServerConfig
): Promise<AuthResult> {
  // Try Better Auth first if configured
  if (config.betterAuth?.instance) {
    const betterAuthResult = await authenticateWithBetterAuth(
      c,
      config.betterAuth.instance,
      config.betterAuth.sessionCookieName
    );

    if (betterAuthResult.isAuthenticated) {
      return betterAuthResult;
    }
  }

  // Fallback to JWT authentication if authSecret is provided
  if (config.authSecret) {
    const jwtResult = await authenticateWithJWT(c, config.authSecret);
    if (jwtResult.isAuthenticated) {
      return jwtResult;
    }
  }

  // No authentication method available
  return {
    isAuthenticated: false,
    error: 'No valid authentication found',
  };
}

/**
 * Check if user is an agent (for agentic actions)
 */
export const isAgent = (authResult: AuthResult): boolean => {
  return (
    authResult.method === 'agent' ||
    (authResult.user && authResult.user.type === 'agent')
  );
};
