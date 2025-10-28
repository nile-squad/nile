# Action Hook System Documentation

**Version:** 1.1  
**Date:** August 28, 2025  
**Author:** Hussein Kizz

## 1. Overview

The **Action Hook System** provides a powerful mechanism for implementing cross-cutting concerns like authentication, authorization, and audit logging at the framework level. Action Hooks execute before every service action across all services, enabling consistent security and business rule enforcement.

## 2. Core Concepts

### 2.1 Hook Architecture: Two Types of Hooks

**IMPORTANT:** Nile has TWO distinct hook systems:

1. **Global `onActionHandler` Hook** (Authorization/Cross-Cutting Concerns)
   - Runs BEFORE the action handler executes
   - Used for authorization, logging, metrics
   - Does NOT transform data or receive action results
   - Signature: `({ nileContext, action, payload, stage }) => SafeResult`
   - Configured at server level in `serverConfig.onActionHandler`

2. **Action-Level Hooks** (Data Pipeline Transformations)
   - Configured per-action in `action.hooks.before` and `action.hooks.after`
   - Transform payload (before) or results (after)
   - Chain together in a pipeline
   - After hooks DO have access to previous results in the chain
   - Used for data enrichment, validation, notifications

### 2.2 What is onActionHandler?

The `onActionHandler` is a **global authorization hook** that:

- Executes BEFORE every service action handler
- Has access to authenticated user context
- Can approve or deny action execution based on permissions
- Provides custom error messages for denials
- Supports both synchronous and asynchronous logic
- Does NOT transform data or receive action results

### 2.3 Execution Flow

```
[Client Request] 
  ↓
[Authentication] - Verify WHO the user is
  ↓
[onActionHandler - 'before' stage] - Check WHAT they can do (authorization)
  ↓
[Payload Validation] - Validate request structure
  ↓
[Action-Level Before Hooks] - Transform payload (optional)
  ↓
[Action Handler] - Execute business logic
  ↓
[Action-Level After Hooks] - Transform results (optional)
  ↓
[onActionHandler - 'after' stage] - Global logging/metrics (optional)
  ↓
[Response to Client]
```

**Key Points:**
- Authentication happens FIRST (identity verification)
- `onActionHandler` runs BEFORE handler (authorization)
- `onActionHandler` receives object params: `{ nileContext, action, payload, stage }`
- `onActionHandler` does NOT receive action results
- Action-level after hooks DO receive and can transform results
- After hooks have access to previous results in the chain

### 2.4 SubService Metadata System

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

## 3. Implementation Guide

### 3.1 Basic Configuration

```typescript
// backend/server.config.ts
import type { ActionHookHandler } from '@nile-squad/nile/types';
import { Ok } from '@nile-squad/nile/utils/safe-try';

const actionHook: ActionHookHandler = ({ nileContext, action, payload, stage }) => {
  // nileContext: NileContext with user, session, request
  // action: Full action definition
  // payload: Request payload
  // stage: 'before' | 'after'
  
  if (stage === 'before') {
    // Authorization logic here
  } else if (stage === 'after') {
    // Post-execution logic (logging, metrics, etc.)
  }
  
  return Ok(true); // Allow action
};

export const serverConfig: ServerConfig = {
  onActionHandler: actionHook,
  // ... other config
};
```

### 3.2 SubService with Metadata

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

### 3.3 Hook Handler Contract

#### Input Parameters

The hook receives a **single object parameter** with the following properties:

1. **`nileContext`** - NileContext with user, session, request data
2. **`action`** - Full action definition (Action object)
3. **`payload`** - Request payload
4. **`stage`** - Stage indicator ('before' | 'after')

#### Return Value (Standardized)

The handler **must return a SafeResult** (either `Ok` or `safeError`).

- **`Ok(data, message?)`** — Allow action to proceed (data can be any value, message is optional)
- **`safeError(message, error_id, extra?)`** — Deny action with a message and error id (optionally extra data)

A SafeResult is an object with the following discriminants:
- `isOk: true` and `isError: false` for Ok results
- `isOk: false` and `isError: true` for Error results

**No other return values are allowed.**

See `@src/utils/safe-try.ts` for details.

## 4. Access Control Example

```typescript
import type { ActionHookHandler } from '@nile-squad/nile/types';

import { Ok, safeError } from '@nile-squad/nile/utils/safe-try';

export const accessControlHook: ActionHookHandler = ({ nileContext, action, stage }) => {
  const { user } = nileContext;
  
  // stage === 'before' for authorization checks
  // stage === 'after' for audit logging, metrics
  
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

---

**Author:** [Hussein Kizz](https://github.com/Hussseinkizz) at Nile Squad Labz  
**Framework:** [Nile](https://github.com/nile-squad/nile)