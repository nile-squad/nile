# Action-Level Hooks Documentation

**Version:** 1.0  
**Date:** October 28, 2025  
**Author:** Hussein Kizz

## 1. Overview

**Action-level hooks** are a powerful feature in the REST-RPC framework that enable you to build complex data processing workflows by chaining actions together. Unlike global action hooks (which run for every action across all services), action-level hooks are configured per-action and operate within a specific action's execution pipeline.

## 2. Core Concepts

### 2.1 What are Action-Level Hooks?

Think of action-level hooks as an assembly line for your data:

- **Hooks are Actions**: Every hook is just a reference to another action you've already defined
- **Before Hooks**: Run before your main action (validation, data cleanup, enrichment)
- **After Hooks**: Run after your main action (logging, sending emails, notifications)
- **Data Flows Forward**: Each successful hook passes its output to the next hook in the chain

### 2.2 Hook vs Global Action Hook

| Feature | Action-Level Hooks | Global Action Hooks |
|---------|-------------------|---------------------|
| **Scope** | Specific action only | All actions across all services |
| **Purpose** | Business workflow logic and data transformation | Cross-cutting concerns (auth, rate limiting, auditing) |
| **Execution** | Within action workflow | Before/after every action |
| **Configuration** | Individual action (`hooks` property) | Server config (`onBeforeActionHandler`, `onAfterActionHandler`) |
| **Data Flow** | Transforms action data in a pipeline | Approves/denies or audits execution |
| **Types** | `hooks.before`, `hooks.after` | `onBeforeActionHandler`, `onAfterActionHandler` |
| **Return Type** | `SafeResult<T>` | `Ok(data, message?) \| safeError(message, error_id, extra?)` |

**See Also:** [Global Action Hooks](./action-hooks.md) for authorization and cross-cutting concerns.

## 3. Hook Execution Flow

### 3.1 Complete Request Pipeline

```
[Client Request]
  ↓
[Authentication] - Verify WHO the user is
  ↓
[onBeforeActionHandler] - Global authorization (What they can do)
  ↓
[Payload Validation] - Validate request structure
  ↓
[Action-Level Before Hook 1] - Transform payload (data cleanup)
  ↓
[Action-Level Before Hook 2] - Transform payload (data enrichment)
  ↓
[Action Handler] - Execute business logic
  ↓
[Action-Level After Hook 1] - Transform results (logging)
  ↓
[Action-Level After Hook 2] - Transform results (notifications)
  ↓
[onAfterActionHandler] - Global logging/metrics/auditing
  ↓
[Response to Client]
```

### 3.2 Data Flow Through Hooks

```
Input: { email: "john@example.com" }
├─ Before Hook 1: validateEmail ✓ → { email: "john@example.com", valid: true }
├─ Before Hook 2: enrichProfile ✗ → [FAILED, output thrown away]
├─ Main Action gets → { email: "john@example.com", valid: true }  // From Hook 1
├─ Main Action returns → { id: "123", email: "john@example.com", created: true }
├─ After Hook 1: logCreation ✓ → { id: "123", logged: true }
└─ After Hook 2: sendWelcomeEmail ✓ → User created successfully
```

**Key Point**: When a hook fails with `canFail: true`, the pipeline "jumps over" it as if it never existed, and the next hook receives the last successful output.

## 4. Hook Failure Behavior

### 4.1 Critical Hooks (`canFail: false`)

- **Must succeed** or the whole action fails
- Used for validation, security checks, required setup
- Failure stops the entire pipeline
- Error is returned to the client

**Example:**

```json
{
  "hooks": {
    "before": [
      { "name": "validateEmail", "canFail": false }  // Must work
    ]
  }
}
```

### 4.2 Optional Hooks (`canFail: true`)

- **If they fail**, just skip them and continue
- Next hook gets the last successful output (failed hook output is discarded)
- Used for nice-to-have features like notifications, logging
- Failure is logged but doesn't stop execution

**Example:**

```json
{
  "hooks": {
    "before": [
      { "name": "enrichProfile", "canFail": true }  // Nice to have
    ],
    "after": [
      { "name": "sendNotification", "canFail": true }  // Don't fail if email breaks
    ]
  }
}
```

## 5. Pipeline Results

### 5.1 Standard Mode (`pipeline: false` - default)

- **Returns only the final result**
- Hides all the hook execution details
- Optimized for production performance

**Response Example:**

```json
{
  "status": true,
  "message": "User created successfully",
  "data": {
    "id": "123",
    "email": "john@example.com",
    "created": true
  }
}
```

### 5.2 Debug Mode (`pipeline: true`)

- **Returns the final result PLUS execution logs**
- Shows which hooks ran, what they received/returned
- Useful for debugging and audit trails

**Response Example:**

```json
{
  "status": true,
  "message": "User created successfully",
  "data": {
    "result": {
      "id": "123",
      "email": "john@example.com",
      "created": true
    },
    "pipeline": [
      {
        "hook": "validateEmail",
        "status": "success",
        "input": { "email": "john@example.com" },
        "output": { "email": "john@example.com", "valid": true }
      },
      {
        "hook": "enrichProfile",
        "status": "failed",
        "error": "External API unavailable"
      },
      {
        "hook": "createUser",
        "status": "success",
        "input": { "email": "john@example.com", "valid": true },
        "output": { "id": "123", "email": "john@example.com", "created": true }
      }
    ]
  }
}
```

## 6. Configuration Examples

### 6.1 Simple Hook Configuration

```json
{
  "name": "createUser",
  "description": "Create a new user account",
  "handler": createUserHandler,
  "hooks": {
    "before": [
      { "name": "validateEmail", "canFail": false },
      { "name": "enrichProfile", "canFail": true }
    ],
    "after": [
      { "name": "sendWelcomeEmail", "canFail": true }
    ]
  },
  "result": { "pipeline": false }
}
```

**What happens:**

1. `validateEmail` runs first - if it fails, everything stops
2. `enrichProfile` tries to run - if it fails, we continue with `validateEmail`'s output
3. `createUser` (main action) runs with the latest good data
4. `sendWelcomeEmail` tries to run - if it fails, we still return success

### 6.2 Advanced Hook Configuration with Pipeline

```typescript
import type { Action } from '@nile-squad/nile/types';
import { createUserHandler, validateEmailHandler, enrichProfileHandler, sendWelcomeEmailHandler } from './handlers';

export const createUserAction: Action = {
  name: 'createUser',
  description: 'Create a new user with email validation and profile enrichment',
  handler: createUserHandler,
  hooks: {
    before: [
      {
        name: 'validateEmail',
        canFail: false,  // Critical - must succeed
      },
      {
        name: 'enrichProfile',
        canFail: true,   // Optional - can fail
      }
    ],
    after: [
      {
        name: 'logUserCreation',
        canFail: true,   // Optional
      },
      {
        name: 'sendWelcomeEmail',
        canFail: true,   // Optional
      }
    ]
  },
  result: {
    pipeline: true  // Enable debug mode to see execution details
  }
};
```

### 6.3 Hook with Multiple Before and After Hooks

```json
{
  "name": "processOrder",
  "description": "Process customer order with inventory check and payment",
  "hooks": {
    "before": [
      { "name": "validateOrderData", "canFail": false },
      { "name": "checkInventory", "canFail": false },
      { "name": "calculateShipping", "canFail": true },
      { "name": "applyDiscounts", "canFail": true }
    ],
    "after": [
      { "name": "updateInventory", "canFail": false },
      { "name": "sendOrderConfirmation", "canFail": true },
      { "name": "notifyWarehouse", "canFail": true },
      { "name": "trackAnalytics", "canFail": true }
    ]
  },
  "result": { "pipeline": true }
}
```

**Execution Flow:**

```
Input: { items: [...], customerId: "123" }
  ↓
validateOrderData ✓ → { items: [...], customerId: "123", validated: true }
  ↓
checkInventory ✓ → { items: [...], customerId: "123", validated: true, inStock: true }
  ↓
calculateShipping ✗ → [FAILED - shipping API down, continue with previous data]
  ↓
applyDiscounts ✓ → { items: [...], customerId: "123", validated: true, inStock: true, discount: 10% }
  ↓
processOrder (main) → { orderId: "456", total: 90, status: "pending" }
  ↓
updateInventory ✓ → { orderId: "456", inventoryUpdated: true }
  ↓
sendOrderConfirmation ✓ → { orderId: "456", emailSent: true }
  ↓
notifyWarehouse ✓ → { orderId: "456", warehouseNotified: true }
  ↓
trackAnalytics ✗ → [FAILED - analytics service down, but order still succeeds]
  ↓
Final Result: { orderId: "456", total: 90, status: "pending", warehouseNotified: true }
```

## 7. Implementing Hook Handlers

### 7.1 Hook Handler Contract

All hook handlers must follow the same contract as regular action handlers:

```typescript
import type { ActionHandler } from '@nile-squad/nile/types';
import { Ok, safeError } from '@nile-squad/nile/utils/safe-try';

export const validateEmailHandler: ActionHandler = async (payload) => {
  // Perform validation
  const email = payload.email;
  
  if (!email || !email.includes('@')) {
    return safeError('Invalid email format', 'invalid-email');
  }
  
  // Return transformed data
  return Ok({
    ...payload,
    email: email.toLowerCase(),  // Normalize email
    valid: true
  });
};
```

### 7.2 Before Hook Example

```typescript
import type { ActionHandler } from '@nile-squad/nile/types';
import { Ok, safeError, safeTry } from '@nile-squad/nile/utils/safe-try';

export const enrichProfileHandler: ActionHandler = async (payload) => {
  // Call external API to enrich user data
  const { err, result } = await safeTry(async () => {
    const response = await fetch(`https://api.example.com/enrich?email=${payload.email}`);
    return response.json();
  });
  
  if (err) {
    // This hook can fail gracefully if canFail: true
    return safeError('Failed to enrich profile data', 'enrich-failed');
  }
  
  // Merge enriched data with payload
  return Ok({
    ...payload,
    firstName: result.firstName,
    lastName: result.lastName,
    company: result.company
  });
};
```

### 7.3 After Hook Example

```typescript
import type { ActionHandler } from '@nile-squad/nile/types';
import { Ok, safeError, safeTry } from '@nile-squad/nile/utils/safe-try';

export const sendWelcomeEmailHandler: ActionHandler = async (payload) => {
  // Send welcome email
  const { err } = await safeTry(async () => {
    await emailService.send({
      to: payload.email,
      subject: 'Welcome to our platform!',
      template: 'welcome',
      data: {
        name: payload.firstName || 'User',
        userId: payload.id
      }
    });
  });
  
  if (err) {
    // Log the error but don't fail the action if canFail: true
    console.error('Failed to send welcome email:', err);
    return safeError('Failed to send welcome email', 'email-failed');
  }
  
  // Return the payload unchanged (or add email sent flag)
  return Ok({
    ...payload,
    welcomeEmailSent: true
  });
};
```

## 8. Best Practices

### 8.1 Hook Design Principles

1. **Single Responsibility**: Each hook should do one thing well
2. **Reusable**: Design hooks to be reused across multiple actions
3. **Testable**: Write hooks that can be tested independently
4. **Fail Gracefully**: Use `canFail: true` for non-critical hooks
5. **Transform, Don't Mutate**: Return new objects rather than mutating input

### 8.2 When to Use Hooks

**Use Before Hooks For:**
- Input validation
- Data normalization
- Data enrichment from external sources
- Business rule validation
- Authorization checks specific to this action

**Use After Hooks For:**
- Logging and auditing
- Sending notifications
- Triggering side effects
- Updating related data
- Analytics tracking

**Don't Use Hooks For:**
- Global authorization (use global action hooks instead)
- Cross-cutting concerns (use global action hooks instead)
- Simple data transformations (do it in the main handler)

### 8.3 Error Handling

1. **Always return SafeResult**: Use `Ok()` or `safeError()`, never throw
2. **Use safeTry**: Wrap external calls in `safeTry` to catch unexpected errors
3. **Meaningful error messages**: Provide clear, actionable error messages
4. **Error IDs**: Include error IDs for tracking and debugging

### 8.4 Performance Considerations

1. **Keep hooks lightweight**: Hooks run in sequence, avoid heavy computations
2. **Async operations**: Use async/await for I/O operations
3. **Timeout handling**: Set timeouts for external API calls
4. **Caching**: Cache external data where appropriate

## 9. Testing Hook Workflows

### 9.1 Testing Individual Hooks

```typescript
import { describe, it, expect } from 'vitest';
import { validateEmailHandler } from './validate-email-handler';

describe('validateEmailHandler', () => {
  it('should validate and normalize email', async () => {
    const result = await validateEmailHandler({
      email: 'JOHN@EXAMPLE.COM'
    });
    
    expect(result.status).toBe(true);
    expect(result.data.email).toBe('john@example.com');
    expect(result.data.valid).toBe(true);
  });
  
  it('should reject invalid email', async () => {
    const result = await validateEmailHandler({
      email: 'invalid-email'
    });
    
    expect(result.status).toBe(false);
    expect(result.message).toContain('Invalid email');
  });
});
```

### 9.2 Testing Hook Chains

```typescript
import { describe, it, expect } from 'vitest';
import { executeActionWithHooks } from '@nile-squad/nile/core';

describe('createUser action with hooks', () => {
  it('should execute full hook pipeline', async () => {
    const result = await executeActionWithHooks({
      action: 'createUser',
      payload: { email: 'john@example.com' },
      pipeline: true  // Get execution details
    });
    
    expect(result.status).toBe(true);
    expect(result.data.pipeline).toHaveLength(4);  // 2 before + 1 main + 1 after
    expect(result.data.pipeline[0].hook).toBe('validateEmail');
    expect(result.data.pipeline[0].status).toBe('success');
  });
  
  it('should continue when optional hook fails', async () => {
    // Mock enrichProfile to fail
    const result = await executeActionWithHooks({
      action: 'createUser',
      payload: { email: 'john@example.com' },
      mockHooks: {
        enrichProfile: () => safeError('API unavailable')
      }
    });
    
    // Action should still succeed
    expect(result.status).toBe(true);
    expect(result.data.id).toBeDefined();
  });
});
```

## 10. Common Patterns

### 10.1 Validation Chain

```json
{
  "name": "updateProfile",
  "hooks": {
    "before": [
      { "name": "validateEmail", "canFail": false },
      { "name": "validatePhone", "canFail": false },
      { "name": "validateAddress", "canFail": false }
    ]
  }
}
```

### 10.2 Enrichment Chain

```json
{
  "name": "createLead",
  "hooks": {
    "before": [
      { "name": "enrichFromCRM", "canFail": true },
      { "name": "enrichFromSocial", "canFail": true },
      { "name": "scoreLead", "canFail": true }
    ]
  }
}
```

### 10.3 Notification Chain

```json
{
  "name": "approveOrder",
  "hooks": {
    "after": [
      { "name": "sendCustomerEmail", "canFail": true },
      { "name": "notifyWarehouse", "canFail": true },
      { "name": "updateCRM", "canFail": true },
      { "name": "trackAnalytics", "canFail": true }
    ]
  }
}
```

### 10.4 Multi-Stage Workflow

```json
{
  "name": "onboardUser",
  "hooks": {
    "before": [
      { "name": "validateUserData", "canFail": false },
      { "name": "checkDuplicates", "canFail": false },
      { "name": "enrichProfile", "canFail": true },
      { "name": "assignTeam", "canFail": true }
    ],
    "after": [
      { "name": "createDefaultSettings", "canFail": false },
      { "name": "sendWelcomeEmail", "canFail": true },
      { "name": "notifyTeam", "canFail": true },
      { "name": "scheduleOnboarding", "canFail": true }
    ]
  },
  "result": { "pipeline": true }
}
```

## 11. Troubleshooting

### 11.1 Common Issues

**Issue:** Hook not executing
- **Solution**: Verify hook name matches an existing action
- **Solution**: Check that the action is registered in the service

**Issue:** Pipeline stops unexpectedly
- **Solution**: Check if a hook with `canFail: false` is failing
- **Solution**: Enable `pipeline: true` to see execution details

**Issue:** Wrong data passed to main action
- **Solution**: Verify each hook returns the expected data structure
- **Solution**: Use `pipeline: true` to inspect data flow

**Issue:** After hooks not transforming result
- **Solution**: Ensure after hooks return the transformed data
- **Solution**: Check that the hook is not silently failing

### 11.2 Debugging Tips

1. **Enable pipeline mode**: Set `pipeline: true` to see execution logs
2. **Test hooks independently**: Write unit tests for each hook handler
3. **Check hook order**: Ensure hooks are in the correct sequence
4. **Verify canFail settings**: Make sure critical hooks have `canFail: false`
5. **Log data flow**: Add console.log in hooks to trace data transformations

## 12. See Also

- [Global Action Hooks](./action-hooks.md) - For authorization and cross-cutting concerns
- [REST-RPC Specification](./rest-rpc.spec.md) - Complete protocol specification
- [Architecture](./architecture.md) - Overall system architecture
- [Authentication](./auth.md) - Authentication and authorization patterns

---

**Author:** [Hussein Kizz](https://github.com/Hussseinkizz) at Nile Squad Labz  
**Framework:** [Nile](https://github.com/nile-squad/nile)
