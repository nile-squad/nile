# Security

**Version:** 1.0  
**Date:** October 28, 2025  
**Author:** Hussein Kizz

This document outlines security guidelines and best practices for the Nile framework.

## 1. Overview

Nile implements security at multiple layers to protect against common vulnerabilities including SQL injection, unauthorized access, and data exposure.

## 2. ORM Security

### 2.1 Safe Methods

The following ORM methods are safe for external exposure as they use parameterized queries and validation:

- **`findById`** - Find single record by ID
- **`findMany`** - Find multiple records with filters
- **`findFirst`** - Find first matching record
- **`findByIds`** - Find multiple records by IDs
- **`create`** - Create single record
- **`createMany`** - Create multiple records
- **`update`** - Update single record
- **`updateMany`** - Update multiple records
- **`delete`** - Soft delete single record
- **`deleteMany`** - Soft delete multiple records
- **`increment`** - Atomic increment operation
- **`decrement`** - Atomic decrement operation
- **`count`** - Count records
- **`exists`** - Check record existence
- **`distinct`** - Get distinct values

### 2.2 Internal-Only Methods

The following methods are kept internal to prevent security vulnerabilities:

- **`raw()`** - Direct SQL execution (SQL injection risk)
- **`aggregate()`** - Complex aggregation queries
- **`groupBy()`** - Complex grouping queries
- **`forceDelete()`** - Permanent record deletion

### 2.3 SQL Injection Prevention

All public ORM methods use parameterized queries through Drizzle ORM. Never expose the `raw()` method to external interfaces (REST, WebSocket, RPC).

## 3. Authentication & Authorization

### 3.1 JWT Authentication

Nile supports JWT-based authentication with multiple delivery methods:

- **Cookie-based** - Secure HTTP-only cookies
- **Header-based** - Authorization header with Bearer token
- **Payload-based** - JWT in request payload

### 3.2 Access Control

Use access control hooks to validate permissions before action execution:

```typescript
// Use global action hooks for authorization
import type { OnBeforeActionHandler } from '@nile-squad/nile/types';
import { Ok, safeError } from '@nile-squad/nile/utils/safe-try';

const authorizationHook: OnBeforeActionHandler = ({ nileContext, action, payload }) => {
  // Validate user can update this record
  const payloadData = payload as any;
  
  if (action.name === 'update' && action.serviceName === 'users') {
    if (nileContext.user?.id !== payloadData.id) {
      return safeError('Unauthorized: You can only update your own user record', 'unauthorized-update');
    }
  }
  
  return Ok(true);
};

// Configure in server.config.ts
export const serverConfig: ServerConfig = {
  onBeforeActionHandler: authorizationHook,
  // ... other config
};
```

## 4. API Security

### 4.1 Input Validation

All actions must define Zod schemas for input validation:

```typescript
const createUserAction = {
  name: 'createUser',
  schema: z.object({
    email: z.string().email(),
    name: z.string().min(1)
  })
};
```

### 4.2 Output Filtering

Use `select` to control which fields are returned:

```typescript
await userModel.findById(id, {
  select: ['id', 'name', 'email'] // Never expose passwords
});
```

## 5. Rate Limiting

Implement rate limiting at the REST/RPC layer to prevent abuse:

```typescript
const config = {
  rateLimit: {
    max: 100,
    window: '15m'
  }
};
```

## 6. Soft Delete

Soft delete prevents permanent data loss and maintains audit trails:

```typescript
const model = createModel({
  table: users,
  dbInstance: db,
  config: {
    softDelete: {
      field: 'deletedAt',
      autoFilter: true
    }
  }
});
```

Records marked as deleted are automatically filtered from queries unless explicitly included with `includeDeleted: true`.

## 7. Transaction Safety

Use transactions for operations that must succeed or fail atomically:

```typescript
await withTransaction(db, async (tx) => {
  const userModel = createModel({ table: users, dbInstance: tx });
  await userModel.create(userData);
  await userModel.update(userId, updateData);
});
```

## 8. Security Checklist

When creating new services or actions:

- [ ] Define Zod schemas for all inputs
- [ ] Use access control hooks for authorization
- [ ] Never expose `raw()` method externally
- [ ] Filter sensitive fields from outputs
- [ ] Use soft delete for data retention
- [ ] Implement rate limiting
- [ ] Use transactions for multi-step operations
- [ ] Validate user permissions in hooks
- [ ] Log security events appropriately

**Author:** [Hussein Kizz](https://github.com/Hussseinkizz) at Nile Squad Labz

*This specification reflects the current implementation and is subject to evolution. Contributions and feedback are welcome.*
