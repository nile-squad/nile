# Action Hook System Documentation

**Version:** 1.1  
**Date:** August 28, 2025  
**Author:** Hussein Kizz

## 1. Overview

The **Action Hook System** provides a powerful mechanism for implementing cross-cutting concerns like authentication, authorization, and audit logging at the framework level. Action Hooks execute before every service action across all services, enabling consistent security and business rule enforcement.

## 2. Core Concepts

### 2.1 What are Action Hooks?

Action Hooks are **global pre-action interceptors** that:

- Execute before every service action
- Have access to authenticated user context
- Can approve or deny action execution
- Provide custom error messages for denials
- Support both synchronous and asynchronous logic

### 2.2 Execution Flow

```
[Client Request] → [Authentication] → [Action Hook] → [Payload Validation] → [Action Handler]
```

### 2.3 SubService Metadata System

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

const actionHook: ActionHookHandler = (context, action, payload) => {
  return true; // Allow action
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

1. **`context`** - Execution context
2. **`action`** - Action identifier (e.g., "users.create")
3. **`payload`** - Request payload

#### Return Values

- **`true`** - Allow action to proceed
- **`{ error: string }`** - Deny action with message

## 4. Access Control Example

```typescript
import type { ActionHookHandler } from '@nile-squad/nile/types';

export const accessControlHook: ActionHookHandler = (context, action, _payload) => {
  const { user } = context;
  
  // Skip access control for unauthenticated users - let framework handle public actions
  if (!user) {
    return true; // Framework will handle public/private action checking
  }
  
  const userRole = user.role || 'member'; // Default role if not specified
  
  if (!action.meta?.access) {
    // If no access meta is defined, deny access by default for protected routes
    return { error: 'Access denied: No permissions defined for this action.' };
  }
  
  const accessMeta = action.meta.access;
  let allowedRoles: string[] | undefined;
  
  // Universal access pattern ("*" allows all authenticated users)
  if (Array.isArray(accessMeta) && accessMeta.includes('*')) {
    return true;
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
    return true;
  }
  
  return { error: 'Access denied' };
};
```

---

**Author:** [Hussein Kizz](https://github.com/Hussseinkizz) at Nile Squad Labz  
**Framework:** [Nile](https://github.com/nile-squad/nile)