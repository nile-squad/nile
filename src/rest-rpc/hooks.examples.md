# Hook System Usage Examples

This file demonstrates how to use the newly implemented hook system in the nile/src/rest-rpc framework.

## Basic Hook Usage

```typescript
import type { Action } from '@nile-squad/nile/types';

// Define reusable hook actions
const validateEmailAction: Action = {
  name: 'validateEmail',
  description: 'Validate email format',
  handler: async (data) => {
    if (!data.email || !data.email.includes('@')) {
      return safeError('Invalid email format', 'VALIDATION_ERROR');
    }
    return Ok(data);
  },
  validation: {},
};

const auditLogAction: Action = {
  name: 'auditLog',
  description: 'Log action for audit trail',
  handler: async (data, context) => {
    console.log(`Action ${context.actionName} executed with:`, data);
    return Ok({ logged: true });
  },
  validation: {},
};

// Define main action with hooks
const createUserAction: Action = {
  name: 'createUser',
  description: 'Create a new user account',
  handler: async (data) => {
    // Main business logic
    const user = {
      id: generateId(),
      email: data.email,
      name: data.name,
      createdAt: new Date(),
    };
    return Ok(user);
  },
  validation: {
    zodSchema: z.object({
      email: z.string().email(),
      name: z.string().min(1),
    }),
  },
  hooks: {
    before: [
      { name: 'validateEmail', canFail: false }, // Critical validation
      { name: 'checkDuplicateUser', canFail: false }, // Critical check
      { name: 'enrichUserData', canFail: true }, // Optional enrichment
    ],
    after: [
      { name: 'sendWelcomeEmail', canFail: true }, // Optional email
      { name: 'auditLog', canFail: false }, // Critical logging
      { name: 'updateAnalytics', canFail: true }, // Optional analytics
    ],
  },
  result: {
    pipeline: true, // Include full pipeline audit in response
  },
};
```

## Response Format

When `result.pipeline` is true, the response includes both the main action result and pipeline audit data:

```json
{
  "success": true,
  "data": {
    "result": {
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe",
      "createdAt": "2023-12-07T10:30:00Z"
    },
    "pipeline": {
      "state": {
        "enriched": true,
        "source": "web_signup"
      },
      "log": {
        "before": [
          {
            "name": "validateEmail",
            "input": { "email": "user@example.com", "name": "John Doe" },
            "output": { "email": "user@example.com", "name": "John Doe" },
            "passed": true
          },
          {
            "name": "checkDuplicateUser",
            "input": { "email": "user@example.com", "name": "John Doe" },
            "output": { "email": "user@example.com", "name": "John Doe", "unique": true },
            "passed": true
          },
          {
            "name": "enrichUserData",
            "input": { "email": "user@example.com", "name": "John Doe", "unique": true },
            "output": { "email": "user@example.com", "name": "John Doe", "unique": true, "source": "web_signup" },
            "passed": true
          }
        ],
        "after": [
          {
            "name": "sendWelcomeEmail",
            "input": { "id": "user_123", "email": "user@example.com", "name": "John Doe", "createdAt": "2023-12-07T10:30:00Z" },
            "output": { "emailSent": true, "messageId": "msg_456" },
            "passed": true
          },
          {
            "name": "auditLog",
            "input": { "id": "user_123", "email": "user@example.com", "name": "John Doe", "createdAt": "2023-12-07T10:30:00Z" },
            "output": { "logged": true },
            "passed": true
          },
          {
            "name": "updateAnalytics",
            "input": { "id": "user_123", "email": "user@example.com", "name": "John Doe", "createdAt": "2023-12-07T10:30:00Z" },
            "output": { "analyticsUpdated": true },
            "passed": true
          }
        ]
      }
    }
  }
}
```

## Hook Failure Scenarios

### Critical Hook Failure (canFail: false)

```typescript
// If validateEmail hook fails and canFail is false:
{
  "success": false,
  "error": "Invalid email format",
  "errorId": "error_123"
}
```

### Non-Critical Hook Failure (canFail: true)

```typescript
// If enrichUserData hook fails but canFail is true, pipeline continues:
{
  "success": true,
  "data": {
    "result": { /* main action result */ },
    "pipeline": {
      "log": {
        "before": [
          {
            "name": "enrichUserData",
            "input": { /* input data */ },
            "output": { /* error details */ },
            "passed": false
          }
        ]
      }
    }
  }
}
```

## Hook Composition Patterns

### Authentication & Authorization Chain

```typescript
const protectedAction: Action = {
  name: 'updateUserProfile',
  handler: updateUserProfileHandler,
  hooks: {
    before: [
      { name: 'validateToken', canFail: false },
      { name: 'checkPermissions', canFail: false },
      { name: 'validateInput', canFail: false },
    ],
    after: [
      { name: 'invalidateCache', canFail: true },
      { name: 'auditLog', canFail: false },
    ],
  },
};
```

### Data Processing Pipeline

```typescript
const dataProcessingAction: Action = {
  name: 'processData',
  handler: processDataHandler,
  hooks: {
    before: [
      { name: 'validateFormat', canFail: false },
      { name: 'sanitizeData', canFail: false },
      { name: 'enrichMetadata', canFail: true },
    ],
    after: [
      { name: 'saveToCache', canFail: true },
      { name: 'triggerWebhooks', canFail: true },
      { name: 'updateMetrics', canFail: true },
    ],
  },
  result: { pipeline: true },
};
```

## Best Practices

1. **Critical vs Non-Critical Hooks**: Use `canFail: false` for hooks that must succeed for the action to be valid (validation, authorization). Use `canFail: true` for optional enhancements (logging, analytics, notifications).

2. **Hook Ordering**: Place validation hooks first, then enrichment hooks, then the main action, followed by side-effect hooks (logging, notifications).

3. **Pipeline Auditing**: Enable `result.pipeline: true` for actions that need detailed audit trails or debugging information.

4. **Reusable Hooks**: Create small, focused hook actions that can be reused across multiple main actions.

5. **Error Handling**: Hook failures are logged in the pipeline audit, making it easy to debug issues in complex workflows.

## Integration with Existing Actions

The hook system is backward compatible. Existing actions without hooks will continue to work exactly as before. To add hooks to an existing action, simply add the `hooks` property:

```typescript
// Before: Simple action
const existingAction: Action = {
  name: 'existingAction',
  handler: existingHandler,
  validation: {},
};

// After: Enhanced with hooks
const enhancedAction: Action = {
  name: 'existingAction',
  handler: existingHandler,
  validation: {},
  hooks: {
    before: [{ name: 'validateInput', canFail: false }],
    after: [{ name: 'auditLog', canFail: true }],
  },
};
```