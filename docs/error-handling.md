# Error Handling and Logging

**Version:** 1.0  
**Date:** October 29, 2025  
**Author:** Hussein Kizz

This document describes Nile's error handling patterns, result types, and logging conventions for building reliable service handlers.

## 1. Overview

Nile encourages a consistent, robust pattern for error handling and logging in service action handlers. This ensures reliability, observability, and a great developer experience.

## 2. Result Types

### 2.1 SafeResult Pattern

The `SafeResult` type is used for service-level operations and provides a type-safe way to handle success and error states.

**Type Definition:**

```typescript
type SafeResult<T> = 
  | { isError: false; data: T; message?: string }
  | { isError: true; message: string; error_id?: string };
```

**Usage:**

```typescript
import { Ok, safeError, isError } from '@nile-squad/nile/utils';

// Success case
const result = Ok({ userId: '123', name: 'John' });
// Returns: { isError: false, data: { userId: '123', name: 'John' } }

// Error case
const errorResult = safeError('User not found', 'ERR_001');
// Returns: { isError: true, message: 'User not found', error_id: 'ERR_001' }

// Checking results
if (isError(result)) {
  console.error('Operation failed:', result.message);
  return;
}

console.log('Success:', result.data);
```

### 2.2 ModelResult Pattern

The `ModelResult` type is returned by ORM operations and database models.

**Type Definition:**

```typescript
type ModelResult<T> = {
  data: T | null;
  error: {
    message: string;
    type: 'validation' | 'database' | 'not_found';
    details?: unknown;
  } | null;
};
```

**Usage:**

```typescript
import { createModel } from '@nile-squad/nile/orm';

const userModel = createModel({ table: users, dbInstance: db });

const { data: user, error } = await userModel.findById('user-123');

if (error) {
  if (error.type === 'validation') {
    console.error('Validation failed:', error.details);
  } else {
    console.error('Database error:', error.message);
  }
  return;
}

if (!user) {
  console.log('User not found');
  return;
}

console.log('User found:', user.id);
```

## 3. Handler Semantics

### 3.1 Handler Signature

All action handlers follow a consistent signature:

```typescript
type ActionHandler = (
  data?: any,
  context?: ActionContext
) => Promise<SafeResult<any>>;
```

**Rules:**

- Handlers are always async functions
- The `data` parameter defaults to `{}`
- The `context` parameter is optional and provides request metadata
- Always return a `SafeResult` using `Ok()` or `safeError()`

### 3.2 Return Convention

**Success:**

Use the `Ok()` helper to return successful results:

```typescript
export const createUser = async (data) => {
  const user = await userModel.create(data);
  return Ok(user);
};
```

**Error:**

Use `safeError()` to return errors with optional error IDs:

```typescript
export const createUser = async (data) => {
  const { data: user, error } = await userModel.create(data);
  
  if (error) {
    return safeError('Failed to create user', error_id);
  }
  
  return Ok(user);
};
```

### 3.3 Short-Circuiting

Always return early when errors occur to avoid nested conditionals:

```typescript
export const processOrder = async (data) => {
  const { data: user, error: userError } = await userModel.findById(data.userId);
  if (userError) return safeError('Failed to get user');
  
  const { data: order, error: orderError } = await orderModel.create(data);
  if (orderError) return safeError('Failed to create order');
  
  return Ok({ user, order });
};
```

## 4. Error Detection and Propagation

### 4.1 Error Detection

Use `isError()` to check if a function returned an error:

```typescript
import { isError } from '@nile-squad/nile/utils';

const result = await getUserData(userId);

if (isError(result)) {
  // Handle error
  console.error(result.message);
  return safeError('Failed to process user data');
}

// Safe to use result.data
processUser(result.data);
```

### 4.2 Error Propagation

Always return errors in a consistent shape:

```typescript
export const getAllDashboardData = async () => {
  const functions = [getProspects, getAppointments, getActivities];
  const results = await Promise.all(functions.map((fn) => fn()));
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    
    if (isError(result)) {
      return safeError(`Failed to fetch data from ${functions[i].name}`);
    }
  }
  
  return Ok(dashboardData);
};
```

## 5. Logging

### 5.1 Logger Creation

Use `createLogger()` to create a logger instance for your handler:

```typescript
import { createLogger } from '@nile-squad/nile/logging';

export const myHandler = async (data) => {
  const logger = createLogger('main');
  
  logger.info({
    message: 'Processing request',
    data: { userId: data.userId }
  });
  
  // Handler logic...
};
```

### 5.2 Error Logging

Log errors with structured data and get an error ID for traceability:

```typescript
import { createLogger } from '@nile-squad/nile/logging';

export const processData = async (data) => {
  const logger = createLogger('main');
  const result = await fetchData();
  
  if (isError(result)) {
    const error_id = logger.error({
      message: 'Failed to fetch data',
      data: result,
      atFunction: 'processData'
    });
    
    return safeError('Failed to process data', error_id);
  }
  
  return Ok(result.data);
};
```

### 5.3 Logging Best Practices

- Log at the point of failure
- Include function name with `atFunction`
- Include relevant context data
- Always return the `error_id` to the caller
- Use appropriate log levels: `info`, `warn`, `error`

## 6. Complete Example

Here is a robust handler implementation following all patterns:

```typescript
import { createLogger } from '@nile-squad/nile/logging';
import { isError, Ok, safeError } from '@nile-squad/nile/utils';
import type { ActionTypes } from '@nile-squad/nile/types';

export const getAllDashboardData: ActionTypes.ActionHandler = async (data = {}) => {
  const logger = createLogger('main');
  const dashboardData: Record<string, any> = {};

  const functions = [getAllProspects, getAllAppointments, getAllActivities];
  const results = await Promise.all(functions.map((fn) => fn()));

  for (let i = 0; i < functions.length; i++) {
    const fn = functions[i];
    const result = results[i];

    if (isError(result)) {
      const error_id = logger.error({
        message: `Error fetching data from ${fn.name}`,
        data: result,
        atFunction: 'getAllDashboardData',
      });
      return safeError(`Failed to fetch data from ${fn.name}`, error_id);
    }

    dashboardData[fn.name as string] = result.data;
  }

  return Ok(dashboardData);
};
```

**Key Points:**

- Consistent error handling pattern
- Structured logging with error IDs
- Early returns for failures
- Type-safe results
- Traceable errors for production debugging

## 7. Working with Transactions

When using transactions with `withTransaction`, you can return either `SafeResult` or `ModelResult`:

```typescript
import { withTransaction } from '@nile-squad/nile/orm';

// Using SafeResult
const { result, error } = await withTransaction(db, async (tx) => {
  const userResult = await getUserByEmail(email, tx);
  if (userResult.isError) return userResult;
  
  return Ok({ user: userResult.data });
});

// Check transaction-level error first
if (error) {
  console.error('Transaction failed:', error.message);
  return;
}

// Check result-level error
if (result?.isError) {
  console.error('Operation failed:', result.message);
  return;
}

console.log('Success:', result.data);
```

See [Create Models](./create-models.md) for more details on transaction patterns.

**Author:** Hussein Kizz

*This specification reflects the current implementation and is subject to evolution. Contributions and feedback are welcome.*
