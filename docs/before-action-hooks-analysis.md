# Before Action Hooks Analysis

**Date:** January 2025  
**Purpose:** Comprehensive analysis of how Nile handles before action hooks and what data is passed to them

## Overview

Nile implements **two distinct types of before action hooks** that serve different purposes and receive different parameters:

1. **Global Before Action Hooks** - For authorization and cross-cutting concerns
2. **Action-Level Before Hooks** - For data transformation pipelines

---

## 1. Global Before Action Hooks (`onBeforeActionHandler`)

### Purpose
- **Authorization** - Check if the user has permission to execute the action
- **Cross-cutting concerns** - Logging, metrics, security checks
- **Global enforcement** - Applied to ALL actions across ALL services

### Configuration
Configured at the server level in `serverConfig`:

```typescript
export const serverConfig: ServerConfig = {
  onBeforeActionHandler: myBeforeHook,
  // ... other config
};
```

### Execution Flow
Executes in the unified executor **after authentication** but **before payload validation**:

```
[Authentication] 
  ↓
[onBeforeActionHandler] ← Executes here
  ↓
[Payload Validation]
  ↓
[Action-Level Before Hooks]
  ↓
[Action Handler]
```

### Parameters Passed

The global before hook receives a **single object parameter** with three properties:

```typescript
type OnBeforeActionHandler = (params: {
  nileContext: NileContext;
  action: Action;
  payload: unknown;
}) => ActionHookResult | Promise<ActionHookResult>;
```

#### 1. `nileContext: NileContext`

The Nile context object containing:

```typescript
type NileContext = {
  // Interface-specific contexts
  hono?: HonoContext;        // REST/HTTP context (Hono framework)
  ws?: WebSocketContext;      // WebSocket context
  rpc?: RPCContext;          // RPC context
  
  // Authentication data
  authResult?: AuthHandlerResult['data'];
  
  // Internal storage
  _store: Map<string, any>;
  
  // Helper methods
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  getAuth(): AuthHandlerResult['data'] | undefined;
  getUser(): { userId: string; organizationId: string; [key: string]: any } | undefined;
};
```

**Key Access Patterns:**
- `nileContext.getUser()` - Returns authenticated user with `userId`, `organizationId`, and other properties
- `nileContext.getAuth()` - Returns full authentication result
- `nileContext.get(key)` / `nileContext.set(key, value)` - Store/retrieve custom data
- `nileContext.hono` - Access HTTP request/response (REST only)
- `nileContext.ws` - Access WebSocket connection (WS only)
- `nileContext.rpc` - Access RPC context (RPC only)

#### 2. `action: Action`

The complete action definition object:

```typescript
type Action = {
  name: string;                    // Action name (e.g., 'create', 'findById', 'customAction')
  description: string;             // Action description
  type?: 'auto' | 'custom';        // Whether auto-generated or custom
  isProtected?: boolean;           // Whether action requires authentication
  agentic?: boolean;              // Whether agent can execute (defaults to true)
  visibility?: {                   // Interface visibility flags
    rest?: boolean;
    rpc?: boolean;
    agent?: boolean;
  };
  isSpecial?: {                    // Special handling flags
    contentType: 'multipart/form-data' | 'application/json' | 'other';
    uploadMode?: 'flat' | 'structured';
  };
  handler: ActionHandler;          // The action handler function
  validation: Validation;           // Validation schema
  hooks?: {                        // Action-level hooks
    before?: HookDefinition[];
    after?: HookDefinition[];
  };
  result?: ActionResultConfig;     // Result configuration
  meta?: Record<string, any>;      // Custom metadata (access control, caching, etc.)
};
```

**Common Use Cases:**
- `action.meta.access` - Access control configuration
- `action.name` - Action identifier
- `action.type` - Distinguish auto vs custom actions
- `action.isProtected` - Check if authentication required

#### 3. `payload: unknown`

The raw request payload as received from the client. This is the **untransformed** payload before any action-level hooks have processed it.

### Return Value

**Must return a `SafeResult<any>`:**

```typescript
type ActionHookResult = SafeResult<any>;

// Success - Allow action to proceed
return Ok(true);  // or Ok(anyData, optionalMessage)

// Failure - Deny action execution
return safeError('Access denied', 'error-id', { extra: 'data' });
```

### Implementation Location

**File:** `src/core/unified-executor.ts`

**Function:** `executeBeforeHook()`

```143:171:src/core/unified-executor.ts
async function executeBeforeHook(
  serverConfig: ServerConfig,
  nileContext: any,
  action: any,
  payload: any
): Promise<void> {
  if (!serverConfig.onBeforeActionHandler) {
    return;
  }

  const beforeHookResult = await serverConfig.onBeforeActionHandler({
    nileContext,
    action,
    payload,
  });

  if (!beforeHookResult.status) {
    const error_id = log({
      atFunction: 'executeBeforeHook',
      message: beforeHookResult.message || 'Authorization failed',
      data: { action: action.name, payload },
      type: 'error',
    });
    const error = new Error(beforeHookResult.message || 'Authorization failed');
    (error as any).category = 'authorization';
    (error as any).error_id = error_id;
    throw error;
  }
}
```

**Execution Point:** Called in `executeUnified()` after authentication:

```553:565:src/core/unified-executor.ts
    tracker.startStage('global-before-hook');
    await executeBeforeHook(serverConfig, nileContext, action, payload);
    tracker.endStage();

    const beforeHookReport = tracker.getReport();
    const beforeHookDuration = beforeHookReport.stages.at(-1)?.duration;
    logDiagnostic(
      serverConfig.diagnostics,
      'global-before-hook',
      serviceName,
      actionName,
      { duration: beforeHookDuration, status: true }
    );
```

### Example Usage

```typescript
import type { OnBeforeActionHandler } from '@nile-squad/nile/types';
import { Ok, safeError } from '@nile-squad/nile/utils/safe-try';

const accessControlHook: OnBeforeActionHandler = ({ nileContext, action, payload }) => {
  const user = nileContext.getUser();
  
  // Check if user is authenticated
  if (!user && action.isProtected) {
    return safeError('Authentication required', 'auth-required');
  }
  
  // Check permissions via action.meta.access
  if (action.meta?.access) {
    const userRole = user?.role || 'member';
    const allowedRoles = action.meta.access;
    
    if (!allowedRoles.includes(userRole)) {
      return safeError('Access denied', 'access-denied');
    }
  }
  
  return Ok(true); // Allow action to proceed
};
```

---

## 2. Action-Level Before Hooks (`action.hooks.before`)

### Purpose
- **Data transformation** - Transform payload before it reaches the main handler
- **Data enrichment** - Add computed fields, fetch related data
- **Pipeline processing** - Chain multiple transformations together
- **Action-specific logic** - Per-action customization

### Configuration
Configured per-action in the action definition:

```typescript
const myAction: Action = {
  name: 'createUser',
  description: 'Create a new user',
  handler: createUserHandler,
  hooks: {
    before: [
      { name: 'validateInput', canFail: false },
      { name: 'enrichData', canFail: true },
      { name: 'normalizeEmail', canFail: false }
    ]
  }
};
```

### Execution Flow
Executes **after** global before hook and payload validation, **before** the main action handler:

```
[Global Before Hook]
  ↓
[Payload Validation]
  ↓
[Action-Level Before Hooks] ← Executes here (sequentially)
  ↓
[Action Handler]
```

### Parameters Passed

**Important:** Action-level hooks are **actions themselves** and receive parameters in the standard action handler signature:

```typescript
type ActionHandler = (
  data: Record<string, any> | any,
  context?: NileContext
) => Promise<SafeResult<any>> | SafeResult<any>;
```

#### 1. First Parameter: `transformedPayload`

The **transformed payload** from the previous hook in the chain (or original payload for the first hook).

- **Type:** `any` or `Record<string, any>`
- **Content:** The output from the previous hook's `SafeResult.data`
- **Initial Value:** Original request payload for the first hook
- **Transformation:** Each hook can modify and return a new payload

#### 2. Second Parameter: `nileContext` (optional)

The same `NileContext` object as global hooks, containing:
- User authentication data
- Request context (hono/ws/rpc)
- Storage methods (`get`/`set`)

### Return Value

**Must return a `SafeResult<any>`:**

```typescript
// Success - Transform payload
return Ok(transformedData);  // transformedData becomes next hook's input

// Failure - Stop pipeline (if canFail: false) or skip (if canFail: true)
return safeError('Validation failed', 'error-id');
```

**Key Behavior:**
- If `canFail: false` and hook fails → entire action execution stops
- If `canFail: true` and hook fails → hook is skipped, previous payload continues
- Successful hooks pass their `data` to the next hook as input

### Implementation Location

**File:** `src/core/unified-executor.ts` (also in `src/core/unified-executor-helpers.ts`)

**Function:** `executeActionBeforeHooks()`

```220:326:src/core/unified-executor.ts
async function executeActionBeforeHooks(
  action: any,
  service: any,
  payload: any,
  nileContext: any,
  tracker: any,
  serverConfig: ServerConfig,
  serviceName: string,
  actionName: string
): Promise<SafeResult<any>> {
  if (!action.hooks?.before || action.hooks.before.length === 0) {
    return Ok(payload);
  }

  tracker.startStage('action-before-hooks');
  const actionsMap = new Map(
    service.actions.map((act: any) => [act.name, act])
  );
  let transformedPayload = payload;

  // Execute before hooks sequentially
  for (const hookDef of action.hooks.before) {
    tracker.startStage(`before-hook:${hookDef.name}`);
    const hookAction = actionsMap.get(hookDef.name) as any;

    if (!hookAction) {
      tracker.endStage();
      const error_id = log({
        type: 'error',
        message: `Before hook action '${hookDef.name}' not found`,
        data: { actionName: action.name, hookName: hookDef.name },
        atFunction: 'executeActionBeforeHooks',
      });
      logDiagnostic(
        serverConfig.diagnostics,
        'before-hook-lookup-failed',
        serviceName,
        actionName,
        { hookName: hookDef.name, status: false }
      );
      return safeError(
        `Before hook action '${hookDef.name}' not found`,
        error_id,
        { error_category: 'execution' }
      );
    }

    // biome-ignore lint/nursery/noAwaitInLoop: Hooks must execute sequentially to transform data in pipeline
    const hookResult = await hookAction.handler(
      transformedPayload,
      nileContext as any
    );
    tracker.endStage();

    const hookReport = tracker.getReport();
    const hookDuration = hookReport.stages.at(-1)?.duration;

    if (!hookResult.status) {
      logDiagnostic(
        serverConfig.diagnostics,
        'before-hook',
        serviceName,
        actionName,
        {
          hookName: hookDef.name,
          duration: hookDuration,
          status: false,
          canFail: hookDef.canFail,
        }
      );

      if (hookDef.canFail) {
        continue;
      }
      return hookResult;
    }

    logDiagnostic(
      serverConfig.diagnostics,
      'before-hook',
      serviceName,
      actionName,
      { hookName: hookDef.name, duration: hookDuration, status: true }
    );

    transformedPayload = hookResult.data;
  }

  tracker.endStage();
  const beforeHooksReport = tracker.getReport();
  const beforeHooksTotalDuration = beforeHooksReport.stages.find(
    (s: any) => s.stage === 'action-before-hooks'
  )?.duration;
  logDiagnostic(
    serverConfig.diagnostics,
    'action-before-hooks-complete',
    serviceName,
    actionName,
    {
      duration: beforeHooksTotalDuration,
      status: true,
      hooksCount: action.hooks.before.length,
    }
  );

  return Ok(transformedPayload);
}
```

**Key Implementation Details:**

1. **Hook Lookup:** Hooks are actions themselves, looked up by name from `service.actions`
2. **Sequential Execution:** Hooks execute one after another (not parallel)
3. **Data Flow:** Each hook's output (`hookResult.data`) becomes the next hook's input
4. **Error Handling:** 
   - `canFail: false` → Return error, stop execution
   - `canFail: true` → Continue with previous payload
5. **Final Output:** Final transformed payload is passed to the main action handler

**Execution Point:** Called in `executeUnified()` after global before hook and validation:

```600:614:src/core/unified-executor.ts
    // Execute action-level before hooks if configured
    const beforeHooksResult = await executeActionBeforeHooks(
      action,
      service,
      payload,
      nileContext,
      tracker,
      serverConfig,
      serviceName,
      actionName
    );
    if (!beforeHooksResult.status) {
      return beforeHooksResult;
    }
    const transformedPayload = beforeHooksResult.data;
```

### Example Usage

```typescript
// Hook action definition
const enrichUserData: Action = {
  name: 'enrichUserData',
  description: 'Enrich user data with computed fields',
  handler: async (payload, context) => {
    // payload is the transformed data from previous hook (or original)
    // context is the NileContext
    
    const enriched = {
      ...payload,
      fullName: `${payload.firstName} ${payload.lastName}`,
      createdAt: new Date().toISOString(),
      userId: context.getUser()?.userId
    };
    
    return Ok(enriched);
  }
};

// Main action using the hook
const createUser: Action = {
  name: 'createUser',
  description: 'Create a new user',
  handler: createUserHandler,
  hooks: {
    before: [
      { name: 'enrichUserData', canFail: false }
    ]
  }
};
```

---

## 3. Comparison Summary

| Aspect | Global Before Hook | Action-Level Before Hooks |
|--------|-------------------|---------------------------|
| **Configuration** | Server-level (`serverConfig.onBeforeActionHandler`) | Action-level (`action.hooks.before`) |
| **Purpose** | Authorization, cross-cutting concerns | Data transformation, enrichment |
| **Parameters** | `{ nileContext, action, payload }` | `(transformedPayload, nileContext)` |
| **Payload State** | Original, untransformed | Transformed by previous hooks |
| **Return Value** | `SafeResult<any>` (authorization result) | `SafeResult<any>` (transformed payload) |
| **Execution Order** | First (after auth, before validation) | After validation, before handler |
| **Scope** | All actions | Per-action configuration |
| **Failure Behavior** | Stops execution | Depends on `canFail` flag |
| **Data Flow** | No transformation | Pipeline transformation |

---

## 4. Complete Execution Flow

```
[Client Request]
  ↓
[Authentication] 
  → Sets nileContext.authResult
  → Sets nileContext.user via getUser()
  ↓
[Global Before Hook] (onBeforeActionHandler)
  → Receives: { nileContext, action, payload }
  → Purpose: Authorization check
  → Returns: SafeResult (Ok = proceed, Error = deny)
  ↓
[Payload Validation]
  → Validates payload structure
  ↓
[Action-Level Before Hooks] (action.hooks.before)
  → For each hook (sequentially):
    → Receives: (transformedPayload, nileContext)
    → Purpose: Transform/enrich payload
    → Returns: SafeResult with transformed data
    → Next hook receives: previous hook's data
  → Final transformed payload passed to handler
  ↓
[Action Handler]
  → Receives: (finalTransformedPayload, nileContext)
  → Executes business logic
  → Returns: SafeResult
  ↓
[Action-Level After Hooks] (action.hooks.after)
  → Transform results
  ↓
[Global After Hook] (onAfterActionHandler)
  → Audit/logging
  ↓
[Response to Client]
```

---

## 5. Key Takeaways

1. **Two Distinct Systems:**
   - Global hooks for authorization (server-wide)
   - Action hooks for data transformation (per-action)

2. **Different Parameters:**
   - Global: Object with `{ nileContext, action, payload }`
   - Action-level: Function args `(payload, context)`

3. **Different Purposes:**
   - Global: Approve/deny execution
   - Action-level: Transform data pipeline

4. **Sequential Execution:**
   - Action-level hooks execute in order
   - Each hook's output is next hook's input

5. **Error Handling:**
   - Global hook failure → Action denied
   - Action hook failure → Depends on `canFail` flag

6. **NileContext Access:**
   - Both hook types have full access to `nileContext`
   - Use `getUser()`, `getAuth()`, `get()`/`set()` for data access

---

## 6. References

- **Type Definitions:** `src/types/action-hook.ts`
- **Global Hook Execution:** `src/core/unified-executor.ts` → `executeBeforeHook()`
- **Action Hook Execution:** `src/core/unified-executor.ts` → `executeActionBeforeHooks()`
- **Hook Helpers:** `src/core/unified-executor-helpers.ts`
- **Context Type:** `src/core/context.ts`
- **Action Type:** `src/types/actions.ts`
- **Documentation:** `docs/action-hooks.md`


