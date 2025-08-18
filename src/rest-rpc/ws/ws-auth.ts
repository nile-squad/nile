import type { Socket } from 'socket.io';
import type { ServerConfig } from '../rest-rpc';
import type { WSAuthResult } from './types';

interface WSContext {
  req: {
    header: (name: string) => string | undefined;
  };
}

const _createWSContext = (socket: Socket): WSContext => {
  return {
    req: {
      header: (name: string) => {
        const headers = socket.handshake.headers;
        return headers[name.toLowerCase()] as string | undefined;
      },
    },
  };
};

const extractWSSessionToken = (
  socket: Socket,
  cookieName = 'better-auth.session_token'
): string | null => {
  // Try handshake auth token first
  if (
    socket.handshake.auth?.token &&
    typeof socket.handshake.auth.token === 'string'
  ) {
    const token = socket.handshake.auth.token;
    if (token.startsWith('Bearer ')) {
      return token.substring(7);
    }
    return token;
  }

  // Try cookies from handshake
  const cookies = socket.handshake.headers.cookie;
  if (cookies) {
    const cookieMatch = cookies.match(new RegExp(`${cookieName}=([^;]+)`));
    if (cookieMatch) {
      return cookieMatch[1];
    }
  }

  // Try Authorization header
  const authHeader = socket.handshake.headers.authorization;
  if (authHeader?.startsWith('Session ')) {
    return authHeader.substring(8);
  }

  return null;
};

async function authenticateWSWithBetterAuth(
  socket: Socket,
  betterAuthInstance: any,
  cookieName?: string
): Promise<WSAuthResult> {
  try {
    const sessionToken = extractWSSessionToken(socket, cookieName);
    if (!sessionToken) {
      return { isAuthenticated: false, error: 'No session token found' };
    }

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

async function authenticateWSWithJWT(
  socket: Socket,
  authSecret: string
): Promise<WSAuthResult> {
  try {
    let token: string | null = null;

    // Try handshake auth token
    if (
      socket.handshake.auth?.token &&
      typeof socket.handshake.auth.token === 'string'
    ) {
      const authToken = socket.handshake.auth.token;
      if (authToken.startsWith('Bearer ')) {
        token = authToken.substring(7);
      } else {
        token = authToken;
      }
    }

    // Try Authorization header
    if (!token) {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return { isAuthenticated: false, error: 'No Bearer token found' };
    }

    // Use dynamic import to avoid bundling issues
    const { verify } = await import('hono/jwt');
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

export async function authenticateWS(
  socket: Socket,
  config: ServerConfig
): Promise<WSAuthResult> {
  let lastError = 'No valid authentication found';

  // Try Better Auth first if configured
  if (config.betterAuth?.instance) {
    const betterAuthResult = await authenticateWSWithBetterAuth(
      socket,
      config.betterAuth.instance,
      config.betterAuth.sessionCookieName
    );

    if (betterAuthResult.isAuthenticated) {
      return betterAuthResult;
    }

    // Store specific error from BetterAuth
    lastError = betterAuthResult.error || 'Better Auth validation failed';
  }

  // Fallback to JWT authentication if authSecret is provided
  if (config.authSecret) {
    const jwtResult = await authenticateWSWithJWT(socket, config.authSecret);
    if (jwtResult.isAuthenticated) {
      return jwtResult;
    }

    // Use JWT specific error if it's the only method or if BetterAuth also failed
    lastError = jwtResult.error || 'JWT validation failed';
  }

  // Return with the most specific error message
  return {
    isAuthenticated: false,
    error: lastError,
  };
}
