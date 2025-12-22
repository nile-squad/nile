# Auth Data Structure - What's Actually Passed

**Date:** January 2025  
**Purpose:** Detailed explanation of what data is actually stored in `nileContext.authResult` and returned by `getUser()` and `getAuth()`

## Overview

When authentication succeeds, Nile stores the authentication result in `nileContext.authResult`. The exact structure depends on which authentication handler is used, but all handlers must return at minimum `userId` and `organizationId`.

---

## 1. Type Definitions

### Base Type

```typescript
// src/types/auth-handler.ts
export type AuthResult = {
  userId: string;              // REQUIRED: User identifier
  organizationId: string;      // REQUIRED: Organization identifier
  [key: string]: any;          // Additional properties allowed
};

export type AuthHandlerResult = SafeResult<AuthResult>;
```

### Context Storage

```typescript
// src/core/context.ts
export type NileContext = {
  authResult?: AuthHandlerResult['data'];  // This is AuthResult | undefined
  
  getAuth(): AuthHandlerResult['data'] | undefined;
  getUser(): { userId: string; organizationId: string; [key: string]: any } | undefined;
};
```

**Key Point:** `authResult` stores the `data` property from the `SafeResult`, which is the `AuthResult` object.

---

## 2. How Auth Data is Set

**Location:** `src/core/unified-executor.ts` → `handleAuthentication()`

```139:139:src/core/unified-executor.ts
  nileContext.authResult = authResult.data;
```

The `authResult` from the auth handler is a `SafeResult<AuthResult>`. When successful, `authResult.data` contains the `AuthResult` object, which is stored directly in `nileContext.authResult`.

---

## 3. What Each Auth Handler Returns

### 3.1 BetterAuth Handler

**Location:** `src/core/auth-handlers.ts` → `createBetterAuthHandler()`

**Returns:**
```typescript
{
  userId: string,                    // Extracted from result.user (userId || id || sub)
  organizationId: string,            // Extracted from user or session
  user: any,                         // Full BetterAuth user object
  session: any,                      // Full BetterAuth session object
  method: 'betterauth'              // Authentication method identifier
}
```

**Implementation:**
```89:95:src/core/auth-handlers.ts
      return Ok({
        userId,
        organizationId,
        user: result.user,
        session: result.session,
        method: 'betterauth',
      });
```

**Example Structure:**
```typescript
nileContext.authResult = {
  userId: "user_123",
  organizationId: "org_456",
  user: {
    id: "user_123",
    email: "user@example.com",
    name: "John Doe",
    role: "admin",
    // ... other BetterAuth user fields
  },
  session: {
    id: "session_789",
    userId: "user_123",
    activeOrganizationId: "org_456",
    expiresAt: "2025-01-15T10:00:00Z",
    // ... other BetterAuth session fields
  },
  method: "betterauth"
}
```

**User ID Extraction:**
```19:21:src/core/auth-handlers.ts
function extractUserId(user: any): string | null {
  return user?.userId || user?.id || user?.sub || null;
}
```

**Organization ID Extraction:**
```23:31:src/core/auth-handlers.ts
function extractOrganizationId(user: any, session: any): string | null {
  return (
    user?.organizationId ||
    user?.organization_id ||
    session?.organizationId ||
    session?.organization_id ||
    null
  );
}
```

### 3.2 JWT Handler

**Location:** `src/core/auth-handlers.ts` → `createJWTHandler()`

**Returns:**
```typescript
{
  userId: string,                    // Extracted from JWT payload
  organizationId: string,            // Extracted from JWT payload
  user: any,                         // Full JWT payload (decoded token)
  method: 'jwt' | 'agent'           // 'agent' if payload.type === 'agent', else 'jwt'
}
```

**Implementation:**
```244:249:src/core/auth-handlers.ts
      return Ok({
        userId: userId as string,
        organizationId: organizationId as string,
        user: payload,
        method: payload.type === 'agent' ? 'agent' : 'jwt',
      });
```

**JWT Payload Extraction:**
- `userId`: From `payload.userId || payload.id || payload.sub`
- `organizationId`: From `payload.organizationId || payload.organization_id || payload.orgId`

**Example Structure:**
```typescript
nileContext.authResult = {
  userId: "user_123",
  organizationId: "org_456",
  user: {
    // Full JWT payload contents
    sub: "user_123",
    userId: "user_123",
    organizationId: "org_456",
    email: "user@example.com",
    role: "member",
    iat: 1705315200,
    exp: 1705318800,
    // ... other JWT claims
  },
  method: "jwt"  // or "agent" if type === 'agent'
}
```

### 3.3 Agent Handler

**Location:** `src/core/auth-handlers.ts` → `createAgentHandler()`

**Returns:**
```typescript
{
  userId: string,                    // Format: "agent-{organizationId}"
  organizationId: string,            // Provided organization ID
  method: 'agent',                   // Always 'agent'
  type: 'agent'                      // Always 'agent'
}
```

**Implementation:**
```266:277:src/core/auth-handlers.ts
export function createAgentHandler(organizationId: string): AuthHandler {
  return (_context: AuthContext): AuthHandlerResult => {
    const agentUserId = `agent-${organizationId}`;

    return Ok({
      userId: agentUserId,
      organizationId,
      method: 'agent',
      type: 'agent',
    });
  };
}
```

**Example Structure:**
```typescript
nileContext.authResult = {
  userId: "agent-org_456",
  organizationId: "org_456",
  method: "agent",
  type: "agent"
}
```

**Note:** Agent handler does NOT include `user` or `session` objects - it's a minimal system-level authentication.

---

## 4. Accessing Auth Data

### 4.1 `getAuth()` Method

**Returns:** The full `authResult` object (same as `nileContext.authResult`)

```typescript
// src/core/context.ts
getAuth(): AuthHandlerResult['data'] | undefined {
  return context.authResult;
}
```

**Usage:**
```typescript
const auth = nileContext.getAuth();
// auth = { userId, organizationId, user?, session?, method, ... }
```

### 4.2 `getUser()` Method

**Returns:** The `authResult` cast as a user object with guaranteed `userId` and `organizationId`

```typescript
// src/core/context.ts
getUser():
  | { userId: string; organizationId: string; [key: string]: any }
  | undefined {
  if (!context.authResult) {
    return;
  }
  return context.authResult as {
    userId: string;
    organizationId: string;
    [key: string]: any;
  };
}
```

**Usage:**
```typescript
const user = nileContext.getUser();
// user = { userId: "user_123", organizationId: "org_456", ...all other properties }
```

**Important:** `getUser()` returns the **entire** `authResult` object, not just user data. The name is a bit misleading - it returns all auth data, not just user fields.

---

## 5. Complete Examples by Auth Method

### 5.1 BetterAuth Example

```typescript
// After authentication with BetterAuth
const auth = nileContext.getAuth();
// {
//   userId: "user_123",
//   organizationId: "org_456",
//   user: { id: "user_123", email: "...", name: "...", ... },
//   session: { id: "session_789", userId: "user_123", ... },
//   method: "betterauth"
// }

const user = nileContext.getUser();
// Same as above - returns full authResult

// Access specific fields
const userId = auth.userId;                    // "user_123"
const orgId = auth.organizationId;           // "org_456"
const email = auth.user?.email;                // "user@example.com"
const role = auth.user?.role;                  // "admin"
const sessionId = auth.session?.id;            // "session_789"
```

### 5.2 JWT Example

```typescript
// After authentication with JWT
const auth = nileContext.getAuth();
// {
//   userId: "user_123",
//   organizationId: "org_456",
//   user: { sub: "user_123", userId: "user_123", email: "...", iat: ..., exp: ... },
//   method: "jwt"
// }

const user = nileContext.getUser();
// Same as above

// Access specific fields
const userId = auth.userId;                    // "user_123"
const orgId = auth.organizationId;           // "org_456"
const email = auth.user?.email;               // "user@example.com" (from JWT payload)
const role = auth.user?.role;                 // "member" (from JWT payload)
```

### 5.3 Agent Example

```typescript
// After authentication with Agent handler
const auth = nileContext.getAuth();
// {
//   userId: "agent-org_456",
//   organizationId: "org_456",
//   method: "agent",
//   type: "agent"
// }

const user = nileContext.getUser();
// Same as above

// Access specific fields
const userId = auth.userId;                    // "agent-org_456"
const orgId = auth.organizationId;           // "org_456"
// Note: No user or session objects for agent auth
```

---

## 6. In Before Action Hooks

When before action hooks receive `nileContext`, they can access auth data like this:

```typescript
const beforeHook: OnBeforeActionHandler = ({ nileContext, action, payload }) => {
  // Method 1: Get full auth data
  const auth = nileContext.getAuth();
  if (!auth) {
    return safeError('Not authenticated', 'auth-required');
  }
  
  // Method 2: Get user (same as getAuth, but with type assertion)
  const user = nileContext.getUser();
  if (!user) {
    return safeError('Not authenticated', 'auth-required');
  }
  
  // Access fields (same for both methods)
  const userId = auth.userId;              // or user.userId
  const orgId = auth.organizationId;       // or user.organizationId
  
  // Access additional data (depends on auth method)
  const email = auth.user?.email;          // BetterAuth or JWT
  const role = auth.user?.role;            // BetterAuth or JWT
  const session = auth.session;            // BetterAuth only
  const method = auth.method;              // 'betterauth' | 'jwt' | 'agent'
  
  // Check if agent
  if (auth.method === 'agent' || auth.type === 'agent') {
    // Handle agent-specific logic
  }
  
  return Ok(true);
};
```

---

## 7. Key Takeaways

1. **Minimum Required Fields:**
   - `userId: string` - Always present
   - `organizationId: string` - Always present

2. **Optional Fields (depends on auth method):**
   - `user: any` - Full user object (BetterAuth, JWT)
   - `session: any` - Full session object (BetterAuth only)
   - `method: string` - Auth method identifier
   - `type: string` - Type identifier (agent only)
   - `[key: string]: any` - Any additional custom fields

3. **`getAuth()` vs `getUser()`:**
   - Both return the same data (`authResult`)
   - `getUser()` is just a type-asserted version
   - Neither filters or transforms the data

4. **Auth Method Differences:**
   - **BetterAuth:** Includes full `user` and `session` objects
   - **JWT:** Includes full JWT payload as `user`
   - **Agent:** Minimal, no `user` or `session`

5. **Type Safety:**
   - TypeScript knows `userId` and `organizationId` are always strings
   - Other fields are `any` and should be checked before use
   - Always check `auth` is not `undefined` before accessing properties

---

## 8. Common Patterns

### Pattern 1: Check Authentication
```typescript
const auth = nileContext.getAuth();
if (!auth) {
  return safeError('Not authenticated', 'auth-required');
}
```

### Pattern 2: Get User ID
```typescript
const user = nileContext.getUser();
const userId = user?.userId;  // TypeScript knows this is string | undefined
```

### Pattern 3: Check Auth Method
```typescript
const auth = nileContext.getAuth();
if (auth?.method === 'agent') {
  // Handle agent-specific logic
}
```

### Pattern 4: Access User Data (BetterAuth/JWT)
```typescript
const auth = nileContext.getAuth();
const email = auth?.user?.email;
const role = auth?.user?.role;
```

### Pattern 5: Access Session (BetterAuth only)
```typescript
const auth = nileContext.getAuth();
const sessionId = auth?.session?.id;
const expiresAt = auth?.session?.expiresAt;
```

---

## 9. References

- **Type Definitions:** `src/types/auth-handler.ts`
- **Auth Handlers:** `src/core/auth-handlers.ts`
- **Context Creation:** `src/core/context.ts`
- **Authentication Flow:** `src/core/unified-executor.ts` → `handleAuthentication()`
- **BetterAuth Handler:** `src/core/auth-handlers.ts` → `createBetterAuthHandler()`
- **JWT Handler:** `src/core/auth-handlers.ts` → `createJWTHandler()`
- **Agent Handler:** `src/core/auth-handlers.ts` → `createAgentHandler()`


