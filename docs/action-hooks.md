# Action Hook System Documentation

**Version:** 2.0  
**Date:** October 28, 2025  
**Author:** Hussein Kizz

## 1. Overview

The **Action Hook System** provides a powerful mechanism for implementing cross-cutting concerns like authentication, authorization, and audit logging at the framework level. Global action hooks execute before and/or after every service action across all services, enabling consistent security and business rule enforcement.

## 2. Core Concepts

### 2.1 Hook Architecture: Two Types of Hooks

**IMPORTANT:** Nile has TWO distinct hook systems:

1. **Global Action Hooks** (Authorization/Cross-Cutting Concerns)
   - **`onBeforeActionHandler`** - Runs BEFORE action handler executes
   - **`onAfterActionHandler`** - Runs AFTER action handler executes
   - Used for authorization, logging, metrics, auditing
   - Configured at server level in `serverConfig`
   - Before hook signature: `({ nileContext, action, payload }) => SafeResult`
   - After hook signature: `({ nileContext, action, payload, result }) => SafeResult`

2. **Action-Level Hooks** (Data Pipeline Transformations)
   - Configured per-action in `action.hooks.before` and `action.hooks.after`
   - Transform payload (before) or results (after)
   - Chain together in a pipeline
   - After hooks DO have access to previous results in the chain
   - Used for data enrichment, validation, notifications

### 2.2 Global Action Hooks

#### 2.2.1 OnBeforeActionHandler

The `onBeforeActionHandler` is a **global authorization hook** that:

- Executes BEFORE every service action handler
- Has access to authenticated user context
- Can approve or deny action execution based on permissions
- Provides custom error messages for denials
- Supports both synchronous and asynchronous logic
- Does NOT receive action results

#### 2.2.2 OnAfterActionHandler

The `onAfterActionHandler` is a **global exit gate hook** that:

- Executes AFTER every service action handler
- Has access to the action execution result
- Can log, audit, or transform final results
- Can override action results if needed
- Supports both synchronous and asynchronous logic
- Receives `{ nileContext, action, payload, result }`

### 2.3 Execution Flow

```
[Client Request] 
  ↓
[Authentication] - Verify WHO the user is
  ↓
[onBeforeActionHandler] - Check WHAT they can do (authorization)
  ↓
[Payload Validation] - Validate request structure
  ↓
[Action-Level Before Hooks] - Transform payload (optional)
  ↓
[Action Handler] - Execute business logic
  ↓
[Action-Level After Hooks] - Transform results (optional)
  ↓
[onAfterActionHandler] - Global logging/metrics/auditing (optional)
  ↓
[Response to Client]
```

**Key Points:**
- Authentication happens FIRST (identity verification)
- `onBeforeActionHandler` runs for authorization
- `onAfterActionHandler` runs for auditing/logging
- Before hook receives: `{ nileContext, action, payload }`
- After hook receives: `{ nileContext, action, payload, result }`
- Action-level hooks can transform data
- Global hooks can approve/deny or audit

## 3. Hook System Architecture

This section provides a high-level architectural overview of how hooks enable workflow composition and data flow in the Nile framework.

### 3.1 Workflow Composition

Hooks enable complex business logic through action composition:

**Before Hooks** - Data preparation, validation, enrichment
**After Hooks** - Logging, notifications, cleanup, side effects

### 3.2 Data Flow Strategy

```
Input → Before Hook 1 → Before Hook 2 → Main Action → After Hook 1 → After Hook 2 → Output
```

**Chain Behavior:**

- Each successful hook passes output to next hook
- Failed hooks with `canFail: true` are skipped
- Failed hooks with `canFail: false` stop execution
- Main action receives final successful before hook output

### 3.3 Error Handling Philosophy

**Critical Hooks** (`canFail: false`)

- Must succeed for workflow to continue
- Used for validation, security, essential setup
- Failure terminates entire action

**Optional Hooks** (`canFail: true`)  

- Failures are logged but don't stop workflow
- Next hook receives last successful output
- Used for notifications, analytics, non-essential operations

### 3.4 Pipeline Visibility

**Standard Mode** (`pipeline: false`)

- Returns only final result
- Hides hook execution details
- Optimized for production performance

**Debug Mode** (`pipeline: true`)

- Returns result plus execution logs
- Shows hook success/failure details
- Useful for debugging and auditing

**Example Hook Configuration:**

```json
{
  "hooks": {
    "before": [
      { "name": "validateInput", "canFail": false },
      { "name": "enrichData", "canFail": true }
    ],
    "after": [
      { "name": "auditLog", "canFail": true },
      { "name": "sendNotification", "canFail": true }
    ]
  },
  "result": { "pipeline": true }
}
```

**Note:** The example above demonstrates action-level hooks configuration. For details on action-level hooks (data pipeline transformations), see [action-level-hooks.md](./action-level-hooks.md).

### 3.5 SubService Metadata System

SubServices support a generic `meta` property for storing arbitrary metadata:

```typescript
export type SubService = {
  name: string;
  description: string;
  tableName: string;
  idName: string;
  meta?: Record<string, any>; // Generic metadata for any purpose
};
```

**Common Use Cases for Meta:**
- Access control configuration: `meta: { accessControl: {...} }`
- Caching settings: `meta: { cache: { ttl: 300 } }`
- Rate limiting: `meta: { rateLimit: { requests: 100 } }`
- Feature flags: `meta: { features: ['beta', 'experimental'] }`

## 4. Implementation Guide

### 4.1 Type Definitions

```typescript
import type { NileContext } from '@nile-squad/nile/core/context';
import type { SafeResult } from '@nile-squad/nile/utils/safe-try';
import type { Action } from '@nile-squad/nile/types/actions';

/**
 * OnBeforeActionHandler is called before action execution for authorization.
 * Must return a SafeResult (Ok or safeError).
 */
export type OnBeforeActionHandler = (params: {
  nileContext: NileContext;
  action: Action;
  payload: unknown;
}) => SafeResult<any> | Promise<SafeResult<any>>;

/**
 * OnAfterActionHandler is called after action execution as an exit gate.
 * Can be used for final cleanup, logging, or transforming the result.
 * Must return a SafeResult (Ok or safeError).
 */
export type OnAfterActionHandler = (params: {
  nileContext: NileContext;
  action: Action;
  payload: unknown;
  result: SafeResult<any>;
}) => SafeResult<any> | Promise<SafeResult<any>>;
```

### 4.2 Basic Configuration

#### 4.2.1 OnBeforeActionHandler Example

```typescript
// backend/server.config.ts
import type { OnBeforeActionHandler } from '@nile-squad/nile/types';
import { Ok, safeError } from '@nile-squad/nile/utils/safe-try';

const beforeHook: OnBeforeActionHandler = ({ nileContext, action, payload }) => {
  // nileContext: NileContext with user, session, request
  // action: Full action definition
  // payload: Request payload
  
  // Authorization logic here
  const { user } = nileContext;
  
  if (!user && action.requiresAuth) {
    return safeError('Authentication required', 'auth-required');
  }
  
  return Ok(true); // Allow action to proceed
};

export const serverConfig: ServerConfig = {
  onBeforeActionHandler: beforeHook,
  // ... other config
};
```

#### 4.2.2 OnAfterActionHandler Example

```typescript
// backend/server.config.ts
import type { OnAfterActionHandler } from '@nile-squad/nile/types';
import { Ok } from '@nile-squad/nile/utils/safe-try';

const afterHook: OnAfterActionHandler = ({ nileContext, action, payload, result }) => {
  // nileContext: NileContext with user, session, request
  // action: Full action definition
  // payload: Request payload
  // result: Result from action execution (SafeResult)
  
  // Audit logging
  console.log(`Action ${action.name} completed for user ${nileContext.user?.id}`);
  
  // Return the result unchanged (or transform it if needed)
  return Ok(result);
};

export const serverConfig: ServerConfig = {
  onAfterActionHandler: afterHook,
  // ... other config
};
```

#### 4.2.3 Using Both Hooks Together

```typescript
// backend/server.config.ts
import type { OnBeforeActionHandler, OnAfterActionHandler } from '@nile-squad/nile/types';
import { Ok, safeError } from '@nile-squad/nile/utils/safe-try';

const beforeHook: OnBeforeActionHandler = ({ nileContext, action, payload }) => {
  // Authorization
  return Ok(true);
};

const afterHook: OnAfterActionHandler = ({ nileContext, action, payload, result }) => {
  // Auditing
  return Ok(result);
};

export const serverConfig: ServerConfig = {
  onBeforeActionHandler: beforeHook,
  onAfterActionHandler: afterHook,
  // ... other config
};
```

### 4.3 SubService with Metadata

```typescript
// Using meta for access control
{
  name: 'users',
  tableName: 'users',
  idName: 'id',
  meta: {
    access: {
      create: ['owner', 'admin'],
      read: ['owner', 'admin', 'manager', 'member'],
      update: ['owner', 'admin'],
      delete: ['owner']
    }
  }
}
```

### 4.4 Hook Handler Contract

#### Input Parameters

**OnBeforeActionHandler** receives a single object parameter with:

1. **`nileContext`** - NileContext with user, session, request data
2. **`action`** - Full action definition (Action object)
3. **`payload`** - Request payload

**OnAfterActionHandler** receives a single object parameter with:

1. **`nileContext`** - NileContext with user, session, request data
2. **`action`** - Full action definition (Action object)
3. **`payload`** - Request payload
4. **`result`** - Result from action execution (SafeResult)

#### Return Value (Standardized)

Both handlers **must return a SafeResult** (either `Ok` or `safeError`).

- **`Ok(data, message?)`** — Allow action to proceed (data can be any value, message is optional)
- **`safeError(message, error_id, extra?)`** — Deny action with a message and error id (optionally extra data)

A SafeResult is an object with the following discriminants:
- `isOk: true` and `isError: false` for Ok results
- `isOk: false` and `isError: true` for Error results

**No other return values are allowed.**

See `@src/utils/safe-try.ts` for details.

## 5. Complete Access Control Example

```typescript
// backend/hooks/access-control.ts
import type { OnBeforeActionHandler } from '@nile-squad/nile/types';
import { Ok, safeError } from '@nile-squad/nile/utils/safe-try';

export const accessControlHook: OnBeforeActionHandler = ({ nileContext, action, payload }) => {
  const { user } = nileContext;
  
  // Skip access control for unauthenticated users - let framework handle public actions
  if (!user) {
    return Ok(true, 'No user, let framework handle public/private');
  }
  
  const userRole = user.role || 'member'; // Default role if not specified
  
  if (!action.meta?.access) {
    // If no access meta is defined, deny access by default for protected routes
    return safeError('Access denied: No permissions defined for this action.', 'access-denied-no-meta');
  }
  
  const accessMeta = action.meta.access;
  let allowedRoles: string[] | undefined;
  
  // Universal access pattern ("*" allows all authenticated users)
  if (Array.isArray(accessMeta) && accessMeta.includes('*')) {
    return Ok(true, 'Universal access');
  }
  
  // For auto-generated actions, the action name is the CRUD verb (e.g., 'create')
  // and the access meta is an object mapping verbs to roles
  if (action.type === 'auto') {
    if (typeof accessMeta === 'object' && accessMeta !== null) {
      allowedRoles = accessMeta[action.name];
    }
  }
  // For custom actions, the access meta is a direct array of roles
  else if (Array.isArray(accessMeta)) {
    allowedRoles = accessMeta;
  }
  
  if (allowedRoles?.includes(userRole)) {
    return Ok(true, 'Role allowed');
  }
  
  return safeError('Access denied', 'access-denied-role');
};
```

## 6. Complete Audit Logging Example

```typescript
// backend/hooks/audit-logging.ts
import type { OnAfterActionHandler } from '@nile-squad/nile/types';
import { Ok } from '@nile-squad/nile/utils/safe-try';

export const auditLoggingHook: OnAfterActionHandler = ({ nileContext, action, payload, result }) => {
  const { user } = nileContext;
  
  // Log all action executions
  const logEntry = {
    timestamp: new Date().toISOString(),
    userId: user?.id || 'anonymous',
    action: action.name,
    service: action.serviceName,
    success: result.status,
    payload: JSON.stringify(payload),
  };
  
  // Send to logging service
  console.log('[AUDIT]', logEntry);
  
  // You could also store in database, send to external service, etc.
  
  // Return the result unchanged
  return Ok(result);
};
```

## 7. Using Hooks in Server Config

```typescript
// backend/server.config.ts
import { accessControlHook } from './hooks/access-control';
import { auditLoggingHook } from './hooks/audit-logging';

export const serverConfig: ServerConfig = {
  port: 3000,
  onBeforeActionHandler: accessControlHook,
  onAfterActionHandler: auditLoggingHook,
  // ... other config
};
```

## 8. Best Practices

1. **Separation of Concerns**
   - Use `onBeforeActionHandler` for authorization only
   - Use `onAfterActionHandler` for auditing/logging only
   - Keep hooks focused and single-purpose

2. **Error Handling**
   - Always return SafeResult (Ok or safeError)
   - Provide meaningful error messages for denials
   - Include error IDs for debugging

3. **Performance**
   - Keep hooks lightweight and fast
   - Avoid heavy computations or blocking operations
   - Use async operations when needed

4. **Security**
   - Never trust client-provided role information
   - Always verify user identity from `nileContext.user`
   - Use metadata for role configuration, not hardcoded values

5. **Testing**
   - Test hooks independently from actions
   - Mock nileContext for different user scenarios
   - Verify both approval and denial paths

---

**Author:** [Hussein Kizz](https://github.com/Hussseinkizz) at Nile Squad Labz  
**Framework:** [Nile](https://github.com/nile-squad/nile)