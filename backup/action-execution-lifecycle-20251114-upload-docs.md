# Nile Action Execution Lifecycle

**Version:** 2.0  
**Date:** December 25, 2024  
**Author:** Hussein Kizz

> **On Reading This:** This document describes the complete action execution lifecycle in Nile.

**Quick Links:**
- **[rest-rpc.spec.md](./rest-rpc.spec.md)** - REST-RPC protocol specification and API design
- **[action-hooks.md](./action-hooks.md)** - Action hook system and authorization patterns
- **[create-models.md](./create-models.md)** - ORM and database model operations
- **[ws-rpc.spec.md](./ws-rpc.spec.md)** - WebSocket RPC implementation

**Audience:** Framework developers, implementers, and those debugging action execution issues.

## 1. Overview

Every action request in Nile flows through a well-defined execution pipeline with multiple layers, each handling specific concerns. This lifecycle ensures security, validation, and consistent error handling across all interfaces (REST, WebSocket, RPC).

### Execution Layers

```
[Layer 1: Interface] - Request parsing and content handling
    ↓
[Layer 2: Unified Executor] - Core execution logic
    ├─ Authentication (identity verification)
    ├─ Authorization (permission check via onBeforeActionHandler)
    ├─ Validation (payload schema validation)
    ├─ Hooks (transformation and side effects)
    ├─ Handler (business logic)
    └─ Response formatting (clean output)
    ↓
[Layer 3: Interface] - Response serialization
```

### Key Principles

- **Authentication comes before authorization** - We need to know WHO before checking WHAT they can do
- **Type-safe inference** - Handler payload types are inferred from validation schemas, but also allow flexible keys
- **Runtime validation** - All handlers are checked at runtime to ensure correct signature
- **Clean responses** - Only `status`, `message`, and `data` are returned; no internal discriminators
- **Error categorization** - One error category per stage for reliable frontend handling

---

## 2. Complete Lifecycle with Details

### Stage 1: Interface-Specific Request Handling

**Layer:** Interface (REST, WebSocket, RPC)  
**Location:** `nile/src/interfaces/rest/rest-server.ts` (and equivalents)

**When:** First point of contact - immediately upon request arrival

**Why:** 
- Interface-specific concerns should be handled at the boundary layer
- Content type handling (JSON, multipart, form-data) varies by protocol
- Early validation prevents unnecessary processing
- Interface-specific errors provide better UX

**What to Do:**

**Step 1:** Determine content type from request headers
**Step 2:** Parse request body based on content type
- **JSON:** Parse as JSON object expecting `{ action, payload }`
- **Form Data / Multipart:** Parse FormData with file upload validation
  - Extract `action` field (required)
  - Collect all files from FormData
  - Apply upload mode (flat or structured)
  - Execute validation sequence (see validation details below)

**Step 3:** Extract authentication token if present
- Check cookies, headers, or payload for auth token
- Pass token to unified executor

**Step 4:** Validate request structure
- Ensure `action` field exists
- Ensure `payload` exists (can be empty object)
- Return early on malformed requests

**Example (REST):**
```typescript
// Lines 328-364 in rest-server.ts
restApp.post(`${prefix}/${sanitizeForUrlSafety(s.name)}`, async (c) => {
  // Step 1-2: Parse request
  const requestDetails = isFormData
    ? await handleFormRequest(c)
    : await handleJsonRequest(c);

  // Step 3: Extract auth
  const { actionName, payload, payloadAuthToken, error } = requestDetails;

  // Step 4: Early validation
  if (error) return error; // ← Malformed request
  if (!actionName) {
    return c.json({
      status: false,
      message: 'Action not found in request',
      data: {
        error_id: generateErrorId(),
        error_category: 'validation'
      }
    });
  }

  // Pass to unified executor
  const result = await executeUnified({
    serviceName: sanitizeForUrlSafety(s.name),
    actionName,
    payload,
    serverConfig: config,
    authInput: {
      headers: c.req.raw.headers,
      cookies: getCookie(c),
      payloadAuthToken,
    },
    interfaceContext: { hono: c },
  });

  // Return formatted response
  return c.json(result, statusCode);
});
```

**Error Response (Malformed Request):**
```json
{
  "status": false,
  "message": "Action not found in request",
  "data": {
    "error_id": "req_abc123",
    "error_category": "validation"
  }
}
```

**Error Category:** `validation` - Request structure doesn't match expected format

#### File Upload Validation Details

When the request content-type is `multipart/form-data`, the following validation sequence is applied **before** the request reaches the unified executor:

**Validation Sequence (Fail-Fast):**

1. **Content-Type Enforcement** (415 Unsupported Media Type)
   - If action has `isSpecial.contentType` metadata and `enforceContentType` is enabled
   - Validates that request content-type matches action requirements
   - Example: Action requires `multipart/form-data` but receives `application/json`

2. **Filename Length Check** (400 Bad Request)
   - Validates each filename against `maxFilenameLength` (default: 128)
   - Prevents filesystem attacks with extremely long filenames
   - Returns list of files with too-long names

3. **Zero-Byte File Check** (400 Bad Request)
   - Rejects files with 0 bytes
   - Ensures only valid file content is processed
   - Returns list of empty files

4. **File Count Limit** (400 Bad Request)
   - Enforces `maxFiles` limit (default: 10)
   - Prevents memory exhaustion from excessive uploads
   - Returns allowed vs received count

5. **Individual File Size Limit** (400 Bad Request)
   - Checks each file against `maxFileSize` (default: 10MB)
   - Prevents large file attacks
   - Returns offending file name and size

6. **Total Upload Size Limit** (400 Bad Request)
   - Validates cumulative size against `maxTotalSize` (default: 20MB)
   - Protects against cumulative memory pressure
   - Returns allowed vs received total size

7. **Allowlist Validation** (400 Bad Request)
   - Validates MIME type against `allow.mimeTypes`
   - Validates file extension against `allow.extensions`
   - Both must match for file to be accepted
   - Returns list of rejected files with allowed types

**Upload Modes:**

- **Flat Mode (default):** Files and fields merged into single payload object. Duplicate keys: last value wins.
- **Structured Mode (opt-in):** Payload becomes `{ fields: {...}, files: {...} }` with array aggregation for duplicates.

**Configuration:**
```typescript
uploads: {
  mode: 'flat' | 'structured',    // default: 'flat'
  enforceContentType: boolean,    // default: true
  limits: {
    maxFiles: number,             // default: 10
    maxFileSize: number,          // default: 10MB
    maxTotalSize: number,         // default: 20MB
    maxFilenameLength: number     // default: 128
  },
  allow: {
    mimeTypes: string[],          // default: ['image/png','image/jpeg','application/pdf']
    extensions: string[]          // default: ['.png','.jpg','.jpeg','.pdf']
  }
}
```

**See Also:** For complete file upload documentation including error responses and handler examples, see [REST-RPC Specification - File Uploads](./rest-rpc.spec.md#36-file-uploads).

---

### Stage 2: Authentication (Identity Verification)

**Layer:** Unified Executor  
**Location:** `nile/src/core/unified-executor.ts` - `handleAuthentication()` (lines 94-130)

**When:** After request parsing, before any authorization checks

**Why:** 
- We need to establish WHO is making the request before checking WHAT they can do
- Authentication must happen before authorization (identity before permissions)
- Provides user context for all subsequent stages

**What to Do:**

**Step 1:** Check if action requires authentication
```typescript
if (action.isProtected === false) {
  return Ok(undefined); // Skip authentication
}
```

**Step 2:** Resolve authentication handler
- Try BetterAuth instance if configured
- Fall back to custom auth handler
- Use JWT handler if JWT secret provided
- Throw if no auth handler configured for protected action

**Step 3:** Extract authentication token
```typescript
const authContext: AuthContext = {
  request: null,
  headers: authInput.headers,
  cookies: authInput.cookies,
  payload: authInput.payloadAuthToken
    ? { auth: { token: authInput.payloadAuthToken } }
    : undefined,
};
```

**Step 4:** Validate token and load user context
- Call auth handler with context
- Extract user, session, and request data
- Set `nileContext.authResult` for downstream stages

**Step 5:** Return error if authentication fails
- Return SafeResult with auth error category

**Example:**
```typescript
// Lines 233-241
const authResult = await handleAuthentication(
  action,
  serverConfig,
  authInput,
  nileContext
);

if (!authResult.status) {
  return authResult; // ← Fast fail on auth failure
}
```

**Authentication Result:**
```typescript
// nileContext.authResult structure
{
  user: { 
    id: string,
    role: string, 
    organization_id: string,
    ... 
  },
  session: { ... },
  request: { ... }
}
```

**Error Response (Authentication Failed):**
```json
{
  "status": false,
  "message": "Authentication failed",
  "data": {
    "error_id": "auth_xyz789",
    "error_category": "auth"
  }
}
```

**Error Category:** `auth` - Authentication/identity verification failed

---

### Stage 3: Authorization (Permission Check)

**Layer:** Unified Executor  
**Location:** `nile/src/core/unified-executor.ts` - `executeBeforeHook()` (lines 132-157)

**When:** After authentication, before payload validation

**Why:**
- Authentication tells us WHO, authorization tells us WHAT they can do
- Must run after authentication to have user context
- Runs before expensive validation to fail fast on unauthorized requests
- Centralized permission logic across all actions

**What to Do:**

**Step 1:** Check if `onBeforeActionHandler` is configured
```typescript
if (!serverConfig.onBeforeActionHandler) {
  return; // Skip authorization
}
```

**Step 2:** Call global before action handler with correct signature
```typescript
// Correct signature - using object parameters
const beforeHookResult = await serverConfig.onBeforeActionHandler({
  nileContext,  // ← NileContext with user, session, request
  action,       // ← Full action definition
  payload       // ← Request payload
});
```

**Step 3:** Validate handler return value
- Must return SafeResult (Ok or safeError)
- Throw error if invalid return type

**Step 4:** Check result status
```typescript
if (!beforeHookResult.status) {
  throw new Error(beforeHookResult.message || 'Authorization failed');
}
```

**Example (Access Control Hook):**
```typescript
const accessControlHook: OnBeforeActionHandler = ({ nileContext, action, payload }) => {
  const { user } = nileContext;
  
  // Skip for unauthenticated users (let framework handle public actions)
  if (!user) {
    return Ok(true, 'No user, let framework handle public/private');
  }
  
  const userRole = user.role || 'member';
  
  // Check action metadata for permissions
  if (!action.meta?.access) {
    return safeError(
      'Access denied: No permissions defined for this action.',
      'access-denied-no-meta',
      { error_category: 'authorization' }
    );
  }
  
  // Role-based access check
  const accessMeta = action.meta.access;
  const allowedRoles = action.type === 'auto' 
    ? accessMeta[action.name]
    : accessMeta;
  
  if (allowedRoles?.includes(userRole)) {
    return Ok(true, 'Role allowed');
  }
  
  return safeError('Access denied', 'access-denied-role', {
    error_category: 'authorization'
  });
};
```

**Error Response (Authorization Failed):**
```json
{
  "status": false,
  "message": "Access denied: user cannot perform tickets.delete",
  "data": {
    "error_id": "hook_denial_12345",
    "error_category": "authorization"
  }
}
```

**Error Category:** `authorization` - User lacks permission to perform action

---

### Stage 4: Payload Validation

**Layer:** Unified Executor  
**Location:** `nile/src/core/unified-executor.ts` - `validatePayload()` (lines 159-172)

**When:** After authorization, before hooks and handler

**Why:**
- Ensure payload structure matches action requirements
- Prevent invalid data from reaching business logic
- Provide detailed field-level error feedback
- Type safety through schema validation

**What to Do:**

**Step 1:** Check if action has validation schema
```typescript
if (!action.validation) {
  return; // Skip validation
}
```

**Step 2:** Get validation schema
```typescript
const schema = getValidationSchema(action.validation);
// Supports Zod, JSON Schema, or custom validators
```

**Step 3:** Validate payload against schema
```typescript
const validationResult = schema.safeParse(payload);

if (!validationResult.success) {
  throw new Error(
    `Validation failed: ${JSON.stringify(validationResult.error.issues)}`
  );
}
```

**Step 4:** Validation passes, continue to next stage

**Type Inference:**
```typescript
// Action handler types are inferred from validation
type InferredPayload<T> = T extends { validation: { zodSchema: infer S } }
  ? S extends ZodSchema<infer Shape>
    ? Shape
    : unknown
  : unknown;

// Handler receives inferred type + flexible keys
type ActionHandler = <T extends Validation>(
  data: InferredPayload<T> & Record<string, any>,
  context?: NileContext
) => Promise<SafeResult<any>> | SafeResult<any>;
```

**Error Response (Validation Failed):**
```json
{
  "status": false,
  "message": "Validation failed",
  "data": {
    "error_id": "val_456",
    "error_category": "validation",
    "details": {
      "missing": ["user_id", "title"],
      "invalid": {
        "due_date": "must be a valid ISO date string"
      }
    }
  }
}
```

**Error Category:** `validation` - Payload structure doesn't match schema

---

### Stage 5: Action-Level Before Hooks

**Layer:** Unified Executor  
**Location:** `nile/src/core/hooks.ts` - `executeActionWithHooks()` (integrated in `unified-executor.ts:296-333`)

**When:** After validation, before main handler execution

**Why:**
- Transform payload before handler receives it
- Perform data enrichment, cleanup, or normalization
- Implement reusable business logic hooks
- Chain multiple transformations

**What to Do:**

**Step 1:** Check if action has before hooks configured
```typescript
if (!action.hooks?.before || action.hooks.before.length === 0) {
  // Skip hooks, proceed to handler
  return;
}
```

**Step 2:** Create hook executor context
```typescript
const hookContext: HookContext = {
  actionName: action.name,
  input: payload,           // Initial payload
  state: {},                // Shared state across hooks
  log: { before: [], after: [] },  // Execution log
};
```

**Step 3:** Execute hooks in sequence
```typescript
for (const hookDef of action.hooks.before) {
  // Step 3a: Find hook action
  const hookAction = service.actions.find(a => a.name === hookDef.name);
  
  // Step 3b: Execute hook with current payload
  const result = await hookAction.handler(currentPayload, context);
  
  // Step 3c: Handle hook failure
  if (!result.status) {
    if (hookDef.canFail) {
      // Skip failed hook, continue with previous output
      currentPayload = previousOutput;
      continue;
    } else {
      // Fail fast on critical hook
      return result;
    }
  }
  
  // Step 3d: Use transformed output for next hook
  currentPayload = result.data;
  previousOutput = result.data;
}
```

**Step 4:** Pass transformed payload to handler

**Example Configuration:**
```typescript
{
  name: 'createUser',
  hooks: {
    before: [
      { name: 'validateEmailDomain', canFail: false },  // Must pass
      { name: 'enrichWithDefaults', canFail: true }     // Can skip if fails
    ]
  }
}
```

**Error Response (Hook Failed):**
```json
{
  "status": false,
  "message": "Before hook 'validateEmailDomain' failed",
  "data": {
    "error_id": "hook_789",
    "error_category": "execution",
    "hook_name": "validateEmailDomain"
  }
}
```

**Error Category:** `execution` - Business logic hook failed

---

### Stage 6: Execute Action Handler

**Layer:** Unified Executor  
**Location:** `nile/src/core/unified-executor.ts` - Line 252

**When:** After all hooks (before hooks complete)

**Why:**
- Execute business logic with validated and transformed payload
- Handler receives clean, type-safe data
- Single responsibility: one handler = one action

**What to Do:**

**Step 1:** Validate handler signature at runtime
```typescript
function validateHandlerSignature(handler: Function): void {
  // Must be a function
  if (typeof handler !== 'function') {
    throw new Error('Handler must be a function');
  }
  
  // Must accept 1-2 parameters: (data, context?)
  if (handler.length < 1 || handler.length > 2) {
    throw new Error(
      `Handler must accept 1-2 parameters (data, context?), got ${handler.length}`
    );
  }
}
```

**Step 2:** Execute handler with payload and context
```typescript
validateHandlerSignature(action.handler);

const actionResult = await action.handler(
  payload,        // Transformed payload from hooks
  nileContext     // Context with user, session, request
);
```

**Step 3:** Validate handler return value
```typescript
// Handler must return SafeResult
if (!isSafeResult(actionResult)) {
  throw new Error(
    `Handler must return SafeResult (Ok or safeError), got: ${typeof actionResult}`
  );
}
```

**Step 4:** Pass result to after hooks

**Handler Signature:**
```typescript
type ActionHandler = (
  data: Record<string, any> | any,  // Payload first
  context?: NileContext              // Context second
) => Promise<SafeResult<any>> | SafeResult<any>;
```

**SafeResult Structure:**
```typescript
// Success
{
  status: true,
  message: string,
  data: any,
  isOk: true,
  isError: false
}

// Error
{
  status: false,
  message: string,
  data: {
    error_id: string,
    error_category: 'execution' | 'auth' | 'authorization' | 'validation' | 'not-found' | 'database' | 'business'
    [key: string]: any
  },
  isOk: false,
  isError: true
}
```

**Error Response (Handler Failed):**
```json
{
  "status": false,
  "message": "Failed to create user",
  "data": {
    "error_id": "exec_789",
    "error_category": "execution"
  }
}
```

**Error Category:** `execution` - Handler business logic failed

---

### Stage 7: Action-Level After Hooks

**Layer:** Unified Executor  
**Location:** `nile/src/core/hooks.ts` - `executeActionWithHooks()` (integrated in `unified-executor.ts:296-333`)

**When:** After handler execution, before response formatting

**Why:**
- Log actions for audit trails
- Send notifications (emails, webhooks)
- Clean up resources
- Transform output format

**What to Do:**

**Step 1:** Check if action has after hooks configured
```typescript
if (!action.hooks?.after || action.hooks.after.length === 0) {
  // Skip hooks, return handler result
  return actionResult;
}
```

**Step 2:** Execute hooks in sequence on handler result
```typescript
let finalOutput = actionResult.data;

for (const hookDef of action.hooks.after) {
  const result = await hookDef.handler(finalOutput, context);
  
  if (!result.status) {
    if (hookDef.canFail) {
      // Skip failed hook, continue with previous output
      continue;
    } else {
      // Fail fast on critical after hook
      return result;
    }
  }
  
  finalOutput = result.data;
}
```

**Step 3:** Return transformed result

**Example Configuration:**
```typescript
{
  name: 'createUser',
  hooks: {
    after: [
      { name: 'auditLog', canFail: true },      // Log action
      { name: 'sendWelcomeEmail', canFail: true } // Send notification
    ]
  }
}
```

**Error Category:** `execution` - After hook failed

---

### Stage 8: Global After Hook (Exit Gate)

**Layer:** Unified Executor  
**Location:** `nile/src/core/unified-executor.ts` - `executeAfterHook()` (lines 182-217)

**When:** After all action-level after hooks, before response formatting

**Why:**
- Exit gate for final data cleanup or logging
- Cross-cutting concerns like global audit logging
- Metric collection across all actions
- Final result transformation if needed

**What to Do:**

**Step 1:** Check if `onAfterActionHandler` is configured
```typescript
if (!serverConfig.onAfterActionHandler) {
  return;
}
```

**Step 2:** Call global after handler with correct signature
```typescript
const afterHookResult = await serverConfig.onAfterActionHandler({
  nileContext,  // ← NileContext with user, session, request
  action,       // ← Full action definition
  payload,      // ← Original request payload
  result        // ← Final action result (SafeResult)
});
```

**Step 3:** Validate and handle result
```typescript
if (!afterHookResult.status) {
  throw new Error(afterHookResult.message || 'After hook failed');
}
```

**Note:** The global `onAfterActionHandler` is called after all action execution and receives both the original payload and the final result. It can be used for global logging, metrics, or final cleanup. Unlike before hooks which are for authorization, after hooks are for auditing and cleanup.

**Error Category:** `execution` - After hook failed

---

### Stage 9: Response Formatting

**Layer:** Interface (REST, WebSocket, RPC)  
**Location:** `nile/src/interfaces/rest/rest-server.ts` - After executeUnified call

**When:** After unified executor returns result, before sending to client

**Why:**
- **Security**: Internal framework fields should never be exposed to clients
- **Clean API contract**: Only send what frontend needs (`status`, `message`, `data`)
- **Backend business**: Internal fields like `isOk`, `isError` are for internal handling only

**What to Do:**

**Step 1:** Receive result from unified executor
```typescript
const result = await executeUnified({ ... });
// result may contain: { status, message, data, isOk, isError, ... internal fields }
```

**Step 2:** Extract only public fields for frontend
```typescript
// ONLY send these three fields to frontend
const cleanResponse = {
  status: result.status,    // boolean
  message: result.message,  // string
  data: result.data         // any (can contain error_id, error_category, etc.)
};
```

**Step 3:** Strip all other fields (backend business only)
```typescript
// ❌ DO NOT SEND these to frontend:
// - isOk (internal discriminant)
// - isError (internal discriminant)
// - any other internal framework fields
// - execution context
// - hook logs
// - debug information
// - any framework internals
```

**Step 4:** Send clean response to client
```typescript
return c.json(cleanResponse, statusCode);
```

**Example (REST Interface):**
```typescript
// Lines 353-377 in rest-server.ts
const result = await executeUnified({
  serviceName: sanitizeForUrlSafety(s.name),
  actionName,
  payload,
  serverConfig: config,
  authInput: { headers, cookies, payloadAuthToken },
  interfaceContext: { hono: c },
});

// Clean the response - only send status, message, data
const cleanResponse = {
  status: result.status,
  message: result.message,
  data: result.data
};

// Determine appropriate HTTP status code
let statusCode: 200 | 400 | 401 = 200;
if (!cleanResponse.status) {
  if (cleanResponse.data?.error_id === 'auth-failed' || 
      cleanResponse.data?.error_id === 'no-auth-handler') {
    statusCode = 401;
  } else {
    statusCode = 400;
  }
}

return c.json(cleanResponse, statusCode);
```

**What Frontend Receives:**

**Success Response:**
```json
{
  "status": true,
  "message": "Todo created successfully",
  "data": {
    "id": "123",
    "title": "My Todo",
    "completed": false
  }
}
```

**Error Response:**
```json
{
  "status": false,
  "message": "Failed to create todo",
  "data": {
    "error_id": "exec_789",
    "error_category": "execution"
  }
}
```

**What Backend Keeps (Never Sent):**
```typescript
// These fields exist internally but are STRIPPED before sending:
{
  status: true,
  message: "...",
  data: {...},
  isOk: true,      // ❌ STRIPPED
  isError: false   // ❌ STRIPPED
  // Any other internal fields
}
```

**Error Category:** None (formatting stage)

**Note:** This cleaning happens at the **interface layer**, not in the unified executor. The unified executor can return SafeResult with all fields for internal processing, but the interface layer must strip everything except `status`, `message`, and `data` before sending to clients.

---

## 3. Error Categories (By Stage)

Each stage has a specific error category for reliable frontend handling:

| Stage | Error Category | Description |
|-------|----------------|-------------|
| Interface parsing | `validation` | Request structure invalid |
| Authentication | `auth` | Identity verification failed |
| Authorization | `authorization` | Permission denied |
| Payload validation | `validation` | Schema validation failed |
| Before hooks | `execution` | Hook transformation failed |
| Handler execution | `execution` | Business logic failed |
| After hooks | `execution` | Post-processing failed |
| After hook (global) | `execution` | Global hook failed |

**Error Response Structure:**
```typescript
interface ErrorResponse {
  status: false;
  message: string;
  data: {
    error_id: string;
    error_category: string;
    [key: string]: any; // Extra context
  };
}
```

---

## 4. Complete Example

```typescript
// Action Definition
const createTodoAction: Action = {
  name: 'create',
  description: 'Create a new todo',
  type: 'custom',
  isProtected: true,
  agentic: true,
  validation: {
    zodSchema: z.object({
      title: z.string().min(1),
      user_id: z.string().uuid(),
      due_date: z.string().optional()
    })
  },
  hooks: {
    before: [
      { name: 'validateEmailDomain', canFail: false },
      { name: 'enrichWithDefaults', canFail: true }
    ],
    after: [
      { name: 'auditLog', canFail: true },
      { name: 'sendNotification', canFail: true }
    ]
  },
  meta: {
    access: ['owner', 'admin']
  },
  handler: async (data, context) => {
    // data: { title: string, user_id: string, due_date?: string } & Record<string, any>
    // context: NileContext with user, session, request
    
    try {
      const todo = await db.todos.create({
        ...data,
        created_at: new Date(),
        organization_id: context.user.organization_id
      });
      
      return Ok(todo, 'Todo created successfully');
    } catch (error) {
      return safeError(
        'Failed to create todo',
        'exec_123',
        { error_category: 'execution' }
      );
    }
  }
};

// Execution Flow:
// 1. Interface parses: { action: 'create', payload: { title: '...', user_id: '...' } }
// 2. Authentication: Verify JWT token, load user context
// 3. Authorization: Check if user has 'owner' or 'admin' role via onBeforeActionHandler
// 4. Validation: Check payload matches schema
// 5. Before hooks: validateEmailDomain (must pass) → enrichWithDefaults (can fail)
// 6. Handler: Create todo in database
// 7. After hooks: auditLog (can fail) → sendNotification (can fail)
// 8. Global after hook: Final logging/cleanup via onAfterActionHandler (optional)
// 9. Response: { status: true, message: '...', data: { ... } }
```

---

## 5. Current Implementation Status

| Stage | Status | Location | Notes |
|-------|--------|----------|-------|
| 1. Interface parsing | ✅ Working | `rest-server.ts:327-380` | REST, WebSocket, RPC working |
| 2. Authentication | ✅ Working | `unified-executor.ts:233-241` | Better Auth, JWT, custom |
| 3. Authorization | ✅ Fixed | `unified-executor.ts:136-165` | Uses onBeforeActionHandler with object params |
| 4. Payload validation | ✅ Working | `unified-executor.ts:167-180` | Zod, JSON Schema |
| 5. Before hooks | ❌ Missing | `hooks.ts:132-221` | Implemented but not integrated |
| 6. Handler execution | ✅ Working | `unified-executor.ts:264-297` | Has runtime signature check |
| 7. After hooks | ❌ Missing | `hooks.ts:132-221` | Implemented but not integrated |
| 8. Global after hook | ✅ Fixed | `unified-executor.ts:182-213` | Uses onAfterActionHandler with result param |
| 9. Response formatting | ⚠️ Needs cleanup | `rest-server.ts:377` | Interface should strip internal fields |

---

## 6. Required Fixes

### ✅ FIXED: Hook System Refactored

The following changes have been implemented:

**1. Separate Hook Types**
- `onBeforeActionHandler` - For authorization before action execution
- `onAfterActionHandler` - For exit gate/cleanup after action execution

**2. Correct Hook Signatures**
```typescript
// Before hook (authorization)
type OnBeforeActionHandler = (params: {
  nileContext: NileContext;
  action: Action;
  payload: unknown;
}) => ActionHookResult | Promise<ActionHookResult>;

// After hook (exit gate)
type OnAfterActionHandler = (params: {
  nileContext: NileContext;
  action: Action;
  payload: unknown;  // Original payload
  result: SafeResult<any>;  // Final result
}) => ActionHookResult | Promise<ActionHookResult>;
```

**3. Error IDs from log() Function**
All hard-coded error IDs have been replaced with IDs returned from `log()` function:
- ✅ `unified-executor.ts` - 5 error IDs fixed
- ✅ `auth-handlers.ts` - 9 error IDs fixed

### Still Required Fixes

### Priority 2: Integrate Action-Level Hooks
**Add to executeUnified after validation:**
```typescript
// Before hooks
if (action.hooks?.before?.length > 0) {
  const hookExecutor = createHookExecutor(service.actions);
  const hookResult = await hookExecutor.executeActionWithHooks(action, payload, nileContext);
  if (!hookResult.status) return hookResult;
  payload = hookResult.data;
}

// Execute handler
const actionResult = await action.handler(payload, nileContext);

// After hooks
if (action.hooks?.after?.length > 0) {
  // ... similar logic
}
```

### Priority 3: Add Runtime Signature Validation
```typescript
function validateHandlerSignature(handler: Function): void {
  if (typeof handler !== 'function') {
    throw new Error('Handler must be a function');
  }
  if (handler.length < 1 || handler.length > 2) {
    throw new Error(`Handler must accept (data, context?), got ${handler.length} params`);
  }
}
```

### Priority 4: Clean Response Formatting at Interface Layer
```typescript
// In rest-server.ts, after executeUnified:
const result = await executeUnified({ ... });

// Clean response - ONLY send these three fields to frontend
const cleanResponse = {
  status: result.status,
  message: result.message,
  data: result.data
};

// DO NOT send: isOk, isError, or any other internal fields
return c.json(cleanResponse, statusCode);
```

**Important:** Response cleaning happens at the **interface layer**, not in unified-executor. The unified-executor can use SafeResult with all fields internally, but interfaces must strip everything except `status`, `message`, and `data` before sending to clients.

---

## 7. Diagnostics and Debugging

### Overview

Nile provides built-in diagnostics to help debug action execution issues, measure performance, and understand the complete lifecycle flow. Diagnostics are **opt-in only** to ensure zero performance impact in production.

### Configuration

```typescript
const serverConfig = {
  services: [...],
  diagnostics: {
    enabled: boolean;           // Default: undefined (disabled)
    logLevel?: 'minimal' | 'detailed' | 'verbose';  // Default: 'minimal'
    includePayloads?: boolean;  // Default: false (security)
    includeTimings?: boolean;   // Default: true
  }
};
```

### Log Levels

**minimal** (default when enabled)
- Lifecycle stage names
- Success/failure status
- Total execution timing
- Error details if present

**detailed**
- Everything from minimal
- Hook names when hooks execute
- Stage-specific timings
- Service and action names

**verbose**
- Everything from detailed
- Full context logging
- Detailed error information
- Complete execution traces

### Security Considerations

**Payloads are excluded by default** to prevent logging sensitive data:
- Passwords, tokens, API keys
- Personal information (PII)
- Credit card or payment data
- Any sensitive user data

Only enable `includePayloads: true` in development or with proper log sanitization.

### Lifecycle Stages Logged

1. **execution-start** - Action execution begins
2. **service-action-lookup** - Service/action resolution with timing
3. **authentication** - Auth stage with success/failure and timing
4. **global-before-hook** - Authorization via `onBeforeActionHandler`
5. **payload-validation** - Schema validation stage
6. **before-hook** - Each action-level before hook (with hook name)
7. **action-before-hooks-complete** - Summary of all before hooks
8. **main-handler** - Main action handler execution
9. **after-hook** - Each action-level after hook (with hook name)
10. **action-after-hooks-complete** - Summary of all after hooks
11. **global-after-hook** - Exit gate via `onAfterActionHandler`
12. **execution-complete** - Total execution summary with timing
13. **execution-error** - Error state with timing and error details

### Example Output

#### Minimal Level
```
[DIAGNOSTIC] execution-start: users.createUser (43ms)
[DIAGNOSTIC] service-action-lookup: Found action in 2ms
[DIAGNOSTIC] authentication: Success (12ms)
[DIAGNOSTIC] global-before-hook: Authorization passed (5ms)
[DIAGNOSTIC] payload-validation: Valid (3ms)
[DIAGNOSTIC] main-handler: Success (18ms)
[DIAGNOSTIC] execution-complete: Success (43ms total)
```

#### Detailed Level
```
[DIAGNOSTIC] execution-start: users.createUser
[DIAGNOSTIC] service-action-lookup: Found action 'createUser' in service 'users' (2ms)
[DIAGNOSTIC] authentication: User authenticated successfully (12ms)
[DIAGNOSTIC] global-before-hook: onBeforeActionHandler authorization passed (5ms)
[DIAGNOSTIC] payload-validation: Payload validation passed (3ms)
[DIAGNOSTIC] before-hook: validateEmail executed successfully (8ms)
[DIAGNOSTIC] before-hook: checkDuplicates executed successfully (5ms)
[DIAGNOSTIC] action-before-hooks-complete: 2 before hooks executed (13ms)
[DIAGNOSTIC] main-handler: Action handler executed successfully (18ms)
[DIAGNOSTIC] after-hook: sendWelcomeEmail executed successfully (7ms)
[DIAGNOSTIC] action-after-hooks-complete: 1 after hook executed (7ms)
[DIAGNOSTIC] global-after-hook: onAfterActionHandler completed (2ms)
[DIAGNOSTIC] execution-complete: Total execution time 43ms
```

#### Verbose with Payloads (Development Only)
```
[DIAGNOSTIC] execution-start: users.createUser
  Context: { userId: 'auth-123', orgId: 'org-456', interface: 'rest' }
[DIAGNOSTIC] service-action-lookup: Found action 'createUser' in service 'users' (2ms)
[DIAGNOSTIC] authentication: User authenticated successfully (12ms)
  User: { id: 'auth-123', role: 'admin', organizationId: 'org-456' }
[DIAGNOSTIC] global-before-hook: onBeforeActionHandler authorization passed (5ms)
[DIAGNOSTIC] payload-validation: Payload validation passed (3ms)
  Payload: { name: 'John Doe', email: 'john@example.com' }
[DIAGNOSTIC] before-hook: validateEmail executed successfully (8ms)
  Result: { name: 'John Doe', email: 'john@example.com' }
[DIAGNOSTIC] before-hook: checkDuplicates executed successfully (5ms)
  Result: { name: 'John Doe', email: 'john@example.com', isUnique: true }
[DIAGNOSTIC] action-before-hooks-complete: 2 before hooks executed (13ms)
[DIAGNOSTIC] main-handler: Action handler executed successfully (18ms)
  Result: { id: 'user-123', name: 'John Doe', email: 'john@example.com' }
[DIAGNOSTIC] after-hook: sendWelcomeEmail executed successfully (7ms)
[DIAGNOSTIC] action-after-hooks-complete: 1 after hook executed (7ms)
[DIAGNOSTIC] global-after-hook: onAfterActionHandler completed (2ms)
[DIAGNOSTIC] execution-complete: Total execution time 43ms
```

### Error Logging

Errors are always logged with full details regardless of log level:

```
[DIAGNOSTIC] execution-error: Authentication failed (15ms)
  Error: Invalid token
  Category: auth
  Error ID: auth_xyz789
```

### Performance Tracking

Enable timing data to identify bottlenecks:

```typescript
diagnostics: {
  enabled: true,
  logLevel: 'detailed',
  includeTimings: true  // Shows individual stage timings
}
```

Example timing output:
```
authentication: 12ms
global-before-hook: 5ms
payload-validation: 3ms
before-hooks: 13ms
  - validateEmail: 8ms
  - checkDuplicates: 5ms
main-handler: 18ms
after-hooks: 7ms
  - sendWelcomeEmail: 7ms
global-after-hook: 2ms
────────────────────
Total: 43ms
```

### Best Practices

**Development**
```typescript
diagnostics: {
  enabled: true,
  logLevel: 'verbose',
  includePayloads: true,  // OK in development
  includeTimings: true
}
```

**Staging/Testing**
```typescript
diagnostics: {
  enabled: true,
  logLevel: 'detailed',
  includePayloads: false,  // Security first
  includeTimings: true
}
```

**Production**
```typescript
diagnostics: {
  enabled: false  // Zero performance impact
}
```

**Conditional Diagnostics**
```typescript
diagnostics: {
  enabled: process.env.DEBUG === 'true',
  logLevel: process.env.LOG_LEVEL || 'minimal',
  includePayloads: process.env.NODE_ENV === 'development',
  includeTimings: true
}
```

### Use Cases

**1. Debug Authorization Issues**
```
[DIAGNOSTIC] authentication: Success (12ms)
[DIAGNOSTIC] global-before-hook: Authorization FAILED (5ms)
  Error: User lacks permission for tickets.delete
  Category: authorization
```

**2. Find Performance Bottlenecks**
```
[DIAGNOSTIC] before-hook: enrichUserData executed (1250ms) ⚠️ SLOW
[DIAGNOSTIC] main-handler: Success (18ms)
```

**3. Trace Hook Execution**
```
[DIAGNOSTIC] before-hook: validateEmail Success (8ms)
[DIAGNOSTIC] before-hook: checkDuplicates FAILED (5ms)
  Hook marked as canFail: true, continuing...
[DIAGNOSTIC] main-handler: Success (18ms)
```

**4. Debug Payload Issues**
```
[DIAGNOSTIC] payload-validation: FAILED (3ms)
  Error: Required field 'title' missing
  Expected: { title: string, userId: string }
  Received: { userId: 'abc' }
```

### Implementation Details

Diagnostics use the internal logger from `src/internal.config.ts`:
- No `console.log()` calls
- Consistent formatting across all logs
- Proper log categorization (`info`, `warn`, `error`)
- Zero runtime overhead when disabled

**Performance Tracker API:**
```typescript
const tracker = createPerformanceTracker();
tracker.startStage('authentication');
// ... do work
tracker.endStage('authentication');
const report = tracker.getReport();
// { authentication: 12, total: 12 }
```

### Tests

Comprehensive test coverage:
- `src/core/__tests__/diagnostics.test.ts` (9 tests)
- `src/core/__tests__/unified-executor-diagnostics.test.ts` (5 tests)

All tests verify:
- Disabled by default (no logs)
- Minimal/detailed/verbose levels
- Timing inclusion/exclusion
- Payload security (excluded by default)
- Hook execution logging
- Error logging with full details

---

## 8. References

- **REST-RPC Specification:** [rest-rpc.spec.md](./rest-rpc.spec.md)
- **Action Hooks System:** [action-hooks.md](./action-hooks.md)
- **ORM/Model Operations:** [create-models.md](./create-models.md)
- **WebSocket RPC:** [ws-rpc.spec.md](./ws-rpc.spec.md)

---

**Author:** [Hussein Kizz](https://github.com/Hussseinkizz) at Nile Squad Labz  
**Framework:** [Nile](https://github.com/nile-squad/nile)

