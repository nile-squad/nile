import type { AuthHandler } from '../types/auth-handler';
import type { BetterAuthInstance } from './auth-handlers';
import { createBetterAuthHandler, createJWTHandler } from './auth-handlers';

type ServerConfig = {
  betterAuth?: {
    instance: BetterAuthInstance;
  };
  auth?: {
    secret?: string;
    method?: 'cookie' | 'header' | 'payload';
    authHandler?: AuthHandler | 'betterauth' | 'jwt' | 'agent';
  };
};

export function resolveAuthHandler(config: ServerConfig): AuthHandler | null {
  if (!config.auth?.authHandler) {
    return null;
  }

  if (typeof config.auth.authHandler === 'function') {
    return config.auth.authHandler;
  }

  if (config.auth.authHandler === 'betterauth') {
    if (!config.betterAuth?.instance) {
      throw new Error(
        'betterauth handler selected but no betterAuth instance provided'
      );
    }
    return createBetterAuthHandler(config.betterAuth.instance);
  }

  if (config.auth.authHandler === 'jwt') {
    if (!config.auth.secret) {
      throw new Error('jwt handler selected but no auth.secret provided');
    }
    const method = config.auth.method || 'payload';
    return createJWTHandler(config.auth.secret, method);
  }

  if (config.auth.authHandler === 'agent') {
    throw new Error(
      'agent handler requires organizationId - use createAgentHandler() directly'
    );
  }

  throw new Error(`Unknown auth handler: ${config.auth.authHandler}`);
}

export {
  createAgentHandler,
  createBetterAuthHandler,
  createJWTHandler,
} from './auth-handlers';
