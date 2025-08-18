import { sign } from 'hono/jwt';
import type { AuthResult } from '../auth-utils';
import { getAutoConfig } from '../rest-rpc';

/**
 * Create an agent authentication token
 *
 * @returns A long-lived JWT token for agent authentication
 */
export async function createAgentToken(): Promise<string> {
  const config = getAutoConfig();
  if (!config) {
    throw new Error('REST-RPC not configured');
  }

  if (!config.authSecret) {
    throw new Error('authSecret is required for agent token creation');
  }

  // Generate long-lived token for agent (1 year or until server restart)
  const payload = {
    sub: 'system-agent',
    type: 'agent',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year
  };

  return await sign(payload, config.authSecret);
}

/**
 * Attach agent authentication to payload if in agent mode
 *
 * @param payload - The original payload
 * @param agentMode - Whether agent mode is enabled
 * @returns The payload with or without agent auth attached
 */
export async function attachAgentAuth(
  payload: any,
  agentMode: boolean
): Promise<any> {
  if (!agentMode) {
    return payload;
  }

  // Auto-attach agent authentication
  const token = await createAgentToken();
  return {
    ...payload,
    auth: {
      token,
    },
  };
}

/**
 * Validate if an action can be executed by an agent
 *
 * @param action - The action to validate
 * @param authResult - Authentication result containing user/agent info
 * @returns True if agent can execute the action, false otherwise
 */
export const validateAgenticAction = (
  action: any,
  authResult?: AuthResult
): boolean => {
  // If no auth result or not an agent, allow all actions
  if (!(authResult && isAgent(authResult))) {
    return true;
  }

  // For agents, check if action allows agentic execution
  // Default to true if agentic flag is not explicitly set
  return action.agentic !== false;
};

/**
 * Check if the authenticated user is an agent
 */
export const isAgent = (authResult: AuthResult): boolean => {
  return (
    authResult.method === 'agent' ||
    (authResult.user && authResult.user.type === 'agent')
  );
};
