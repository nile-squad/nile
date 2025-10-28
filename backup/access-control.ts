import type { ActionHookHandler } from '@nile-squad/nile/types';
import { Ok, safeError } from '@nile-squad/nile/utils';
import { log } from '@/config';

export const accessControlHook: ActionHookHandler = (
  context,
  action,
  _payload
) => {
  const { user } = context;

  // Skip access control for unauthenticated users - let the framework handle public actions
  if (!user) {
    return Ok({}); // Framework will handle public/private action checking
  }

  const userRole = user.role || 'user'; // Default to 'user' role if not specified

  if (!action.meta?.access) {
    // If no access meta is defined, deny access by default for protected routes.
    const message = 'Access denied: No permissions defined for this action.';
    const error_id = log.error({
      atFunction: 'accessControlHook',
      message,
      data: { action },
    });
    return safeError(message, error_id);
  }

  const accessMeta = action.meta.access;
  let allowedRoles: string[] | undefined;

  // allow all user types for all syntax "*"
  if (Array.isArray(accessMeta) && accessMeta.includes('*')) {
    return Ok({});
  }

  // For auto-generated actions, the action name is the CRUD verb (e.g., 'create')
  // and the access meta is an object mapping verbs to roles.
  if (action.type === 'auto') {
    if (typeof accessMeta === 'object' && accessMeta !== null) {
      allowedRoles = accessMeta[action.name];
    }
  }
  // For custom actions, the access meta is a direct array of roles.
  else if (Array.isArray(accessMeta)) {
    allowedRoles = accessMeta;
  }

  if (allowedRoles?.includes(userRole)) {
    return Ok({});
  }

  const message = 'Access denied';
  const error_id = log.error({
    atFunction: 'accessControlHook',
    message,
    data: { action },
  });
  return safeError(message, error_id);
};
