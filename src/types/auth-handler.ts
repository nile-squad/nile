import type { SafeResult } from '../utils/safe-try';

export type AuthContext = {
  request: any;
  headers?: Headers;
  cookies?: Record<string, string>;
  payload?: any;
};

export type AuthResult = {
  userId: string;
  organizationId: string;
  [key: string]: any;
};

export type AuthHandlerResult = SafeResult<AuthResult>;

export type AuthHandler = (
  context: AuthContext
) => AuthHandlerResult | Promise<AuthHandlerResult>;

export function validateAuthHandlerResult(
  result: unknown
): result is AuthHandlerResult {
  if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
    const obj = result as Record<string, unknown>;
    if (obj.isOk === true && obj.isError === false) {
      return true;
    }
    if (obj.isOk === false && obj.isError === true) {
      return true;
    }
  }
  return false;
}

export function formatInvalidAuthResultError(result: unknown): string {
  return `Invalid auth handler result. Expected SafeResult (Ok or safeError), got: ${JSON.stringify(result)}`;
}
