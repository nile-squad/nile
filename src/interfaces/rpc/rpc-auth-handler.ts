import { verify } from 'hono/jwt';
import { createLogger } from '../../logging/create-log';
import type {
  AuthContext,
  AuthHandler,
  AuthHandlerResult,
} from '../../types/auth-handler';
import { Ok, safeError, safeTry } from '../../utils';
import type { ServerConfig } from '../rest/rest-server';

const logger = createLogger('nile-rpc-auth');

export type RPCAuthContext = {
  request: any;
  headers?: Headers;
  cookies?: Record<string, string>;
  payload?: any;
  agentMode?: boolean;
  organizationId?: string;
  auth?: { token: string };
  context?: any;
};

export const extractAuthToken = (params: {
  auth?: { token: string };
  context?: any;
  config: ServerConfig;
}): string | null => {
  const { auth, context, config } = params;

  if (!config.auth) {
    return auth?.token || null;
  }

  const {
    method,
    cookieName = 'auth_token',
    headerName = 'authorization',
  } = config.auth;

  switch (method) {
    case 'cookie':
      return context?.req?.cookie?.(cookieName) || null;

    case 'payload':
      return auth?.token || null;

    case 'header': {
      const authHeader = context?.req?.header?.(headerName);
      return authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    }

    default:
      return null;
  }
};

async function extractAuthClaims(
  token: string | null,
  config: ServerConfig
): Promise<any> {
  if (!(token && config)) {
    return null;
  }

  const authSecret = config.auth?.secret || config.authSecret;
  if (!authSecret) {
    return null;
  }

  const { error, result } = await safeTry(() => verify(token, authSecret));
  if (error || !result) {
    return null;
  }

  return result;
}

export function createRPCAuthHandler(config: ServerConfig): AuthHandler {
  return async (authContext: AuthContext): Promise<AuthHandlerResult> => {
    const rpcContext = authContext as RPCAuthContext;
    const {
      agentMode = false,
      organizationId: explicitOrgId,
      auth,
      context,
    } = rpcContext;

    const token = extractAuthToken({ auth, context, config });
    const authClaims = await extractAuthClaims(token, config);

    if (agentMode) {
      const orgId =
        explicitOrgId ||
        authClaims?.organizationId ||
        authClaims?.organization_id;

      if (!orgId) {
        const error_id = logger.error({
          message:
            'No organization context available for agent - provide organizationId or ensure auth token contains org claims',
          data: { authClaims, agentMode, explicitOrgId },
          atFunction: 'createRPCAuthHandler',
        });
        return safeError(
          'No organization context available for agent',
          error_id
        );
      }

      const triggeredBy =
        authClaims?.userId || authClaims?.user_id || authClaims?.sub;

      return Ok(
        {
          userId: `agent-${orgId}`,
          organizationId: orgId,
          isAuthenticated: true,
          user: {
            id: `agent-${orgId}`,
            userId: `agent-${orgId}`,
            type: 'agent',
            triggeredBy,
          },
          session: {
            organizationId: orgId,
            triggeredBy,
          },
          method: 'agent',
        },
        'Agent authenticated'
      );
    }

    if (explicitOrgId) {
      const orgId =
        explicitOrgId ||
        authClaims?.organizationId ||
        authClaims?.organization_id;

      if (!orgId) {
        const error_id = logger.error({
          message:
            'No organization context - specify organizationId or ensure auth token contains org claims',
          data: { explicitOrgId, authClaims },
          atFunction: 'createRPCAuthHandler',
        });
        return safeError(
          'No organization context - specify organizationId or ensure auth token contains org claims',
          error_id
        );
      }

      return Ok(
        {
          userId: 'system',
          organizationId: orgId,
          isAuthenticated: true,
          user: {
            id: 'system',
            userId: 'system',
            type: 'system',
          },
          session: {
            organizationId: orgId,
          },
          method: 'system',
        },
        'System authenticated'
      );
    }

    if (!token) {
      const error_id = logger.error({
        message: 'Unauthorized - no authentication token found',
        data: { authContext },
        atFunction: 'createRPCAuthHandler',
      });
      return safeError(
        'Unauthorized - no authentication token found',
        error_id
      );
    }

    const authSecret = config.auth?.secret || config.authSecret;
    if (!authSecret) {
      const error_id = logger.error({
        message: 'Server configuration error - auth secret not configured',
        atFunction: 'createRPCAuthHandler',
      });
      return safeError(
        'Server configuration error - auth secret not configured',
        error_id
      );
    }

    const { error } = await safeTry(() => verify(token, authSecret));
    if (error) {
      const error_id = logger.error({
        message: 'Unauthorized - token verification failed',
        data: { error: error.message },
        atFunction: 'createRPCAuthHandler',
      });
      return safeError('Unauthorized - token verification failed', error_id);
    }

    if (!authClaims) {
      const error_id = logger.error({
        message: 'Invalid token claims',
        atFunction: 'createRPCAuthHandler',
      });
      return safeError('Invalid token claims', error_id);
    }

    const userId = authClaims.userId || authClaims.user_id || authClaims.sub;
    const organizationId =
      authClaims.organizationId || authClaims.organization_id;

    return Ok(
      {
        userId,
        organizationId,
        isAuthenticated: true,
        user: {
          id: userId,
          userId,
          type: 'user',
          ...authClaims,
        },
        session: {
          organizationId,
        },
        method: 'jwt',
      },
      'User authenticated'
    );
  };
}
