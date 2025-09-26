# Authentication System Documentation

**Version:** 2.1  
**Date:** September 22, 2025  
**Author:** Hussein Kizz

## 1. Overview

This project implements a comprehensive multi-tenant authentication system with three distinct authentication modes:

- **Better Auth Sessions** - Primary authentication for web applications using secure HTTP-only cookies
- **JWT Bearer Tokens** - API access for programmatic clients and legacy integrations  
- **Agent Authentication** - Internal system access for AI agents and automated operations

The system provides organization-based multi-tenancy with automatic context injection and security-by-default architecture.

## 2. Architecture Principles

### 2.1 Security-by-Default

**All service actions require authentication by default** unless explicitly marked as public:

```typescript
// Auto-generated CRUD actions are protected by default
{
  name: 'customers',
  // All CRUD operations require authentication
}

// Explicit public access for specific actions  
{
  name: 'marketing',
  publicActions: ['subscribe', 'unsubscribe'], // Public access (no authentication required)
  // Other actions remain protected
}
```

### 2.2 Context Injection Architecture

User context is automatically injected by the authentication layer to prevent client-side tampering:

**Client Request:**
```json
{
  "action": "createCustomer",
  "payload": {
    "name": "John Doe", 
    "email": "john@example.com"
  }
}
```

**System-Enriched Payload:**
```json
{
  "action": "createCustomer",
  "payload": {
    "name": "John Doe",
    "email": "john@example.com", 
    "user_id": "550e8400-e29b-41d4-a716-446655440001",
    "organization_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 2.3 Multi-Mode Authentication Strategy

The system supports three authentication modes with automatic prioritization:

1. **Better Auth Session** (Primary) - Secure session cookies for web applications
2. **JWT Bearer Token** (Secondary) - Authorization header for API access
3. **Agent Mode** (Internal) - System-level access for AI operations

## 3. Authentication Modes

### 3.1 Better Auth Session (Primary)

**Use Case:** Web applications, browser-based clients

**Authentication Flow:**
```bash
# Sign Up
curl -X POST http://localhost:8000/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123",
    "name": "User Name"
  }'

# Sign In  
curl -X POST http://localhost:8000/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123"
  }'
```

**Service Usage:**
```bash
curl -X POST http://localhost:8000/Delta/api/v1/services/customers \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=SESSION_TOKEN" \
  -d '{
    "action": "create", 
    "payload": {
      "name": "Customer Name",
      "email": "customer@example.com"
    }
  }'
```

### 3.2 JWT Bearer Token (API Access)

**Use Case:** Programmatic access, API integrations, mobile applications

**Token Generation:**
```typescript
// Generate JWT token with proper claims
const token = jwt.sign({
  sub: 'user-uuid',
  userId: 'user-uuid', 
  organization_id: 'org-uuid',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600  // 1 hour
}, 'your-secret-key');
```

**Service Usage:**
```bash
curl -X POST http://localhost:8000/Delta/api/v1/services/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "action": "create",
    "payload": {
      "name": "Customer Name", 
      "email": "customer@example.com"
    }
  }'
```

### 3.3 Agent Authentication (Internal)

**Use Case:** AI agents, automated systems, internal operations

**Agent Context Setup:**
```typescript
import { createRPC } from '@nile-squad/nile/rest-rpc';

// Create RPC client with agent mode
const rpc = createRPC({
  resultsMode: 'data',
  agentMode: true,           // Enable agent authentication
  organization_id: 'org-uuid', // Set organization context
  serverConfig               // Access to service definitions
});

// Execute actions with automatic agent authentication
const result = await rpc.executeServiceAction('customers', {
  action: 'create', 
  payload: {
    name: 'Agent Created Customer',
    email: 'agent@example.com'
  }
});
```

**Agent Token Format:**
```typescript
const agentToken = {
  sub: 'system-agent',
  type: 'agent',
  userId: 'agent-550e8400-e29b-41d4-a716-446655440000',
  organization_id: '550e8400-e29b-41d4-a716-446655440000',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 31536000  // 1 year
};
```

## 4. Multi-Tenant Organization System

### 4.1 Organization Management

**Create Organization:**
```bash
curl -X POST http://localhost:8000/auth/organization/create \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=SESSION_TOKEN" \
  -d '{
    "name": "My Company",
    "slug": "my-company"
  }'
```

**Set Active Organization:**
```bash
curl -X POST http://localhost:8000/auth/organization/set-active \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=SESSION_TOKEN" \
  -d '{
    "organizationId": "68a027f2-8e3b-4f69-aa33-eb6dc19dc5e1"
  }'
```

**Get Session with Organization Context:**
```bash
curl -X GET http://localhost:8000/auth/get-session \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=SESSION_TOKEN"
```

**Response:**
```json
{
  "session": {
    "token": "...",
    "userId": "da778ac4-9f80-4c56-812c-c1448abeaf51",
    "activeOrganizationId": "68a027f2-8e3b-4f69-aa33-eb6dc19dc5e1",
    "expiresAt": "2025-08-24T19:44:27.201Z"
  },
  "user": {
    "id": "da778ac4-9f80-4c56-812c-c1448abeaf51", 
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

### 4.2 Data Isolation Strategy

**Organization-Level Separation:**
- All business data includes `organization_id` for tenant isolation
- Users can only access data from their active organization
- Context automatically injected to prevent cross-tenant access

**Database Schema Pattern:**
```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,  -- Tenant isolation
  user_id UUID NOT NULL,          -- Creator tracking
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 5. Frontend Integration Guide

### 5.1 Better Auth Client Setup

**React/Next.js Integration:**
```typescript
import { createAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: "http://localhost:8000",
  plugins: [organizationClient()]
});

// Usage in components
const { data: session } = authClient.useSession();
const { data: organizations } = authClient.useListOrganizations();
const { data: activeOrg } = authClient.useActiveOrganization();
```

### 5.2 Service Integration Pattern

**Authenticated Service Calls:**
```typescript
// Frontend service call with automatic session handling
async function createCustomer(customerData: CustomerData) {
  const response = await fetch('/Delta/api/v1/services/customers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',  // Include session cookies
    body: JSON.stringify({
      action: 'create',
      payload: customerData
      // user_id and organization_id automatically injected
    })
  });
  
  return response.json();
}
```

### 5.3 Permission-Based UI

**Conditional Rendering Based on Authentication:**
```typescript
function CustomerManagement() {
  const { data: session } = authClient.useSession();
  
  if (!session) {
    return <LoginForm />;
  }
  
  return (
    <div>
      <h1>Customer Management</h1>
      {/* Only show if user is authenticated */}
      <CustomerList organizationId={session.activeOrganizationId} />
    </div>
  );
}
```

## 6. AI Agent Integration

### 6.1 Agentic Endpoint Authentication

**User-Triggered Agent Actions:**
```bash
curl -X POST http://localhost:8000/Delta/api/v1/services/agentic \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=SESSION_TOKEN" \
  -d '{
    "action": "agent",
    "payload": {
      "input": "Create a customer account for john@example.com"
    }
  }'
```

### 6.2 Agent Internal Flow

**Authentication Context Propagation:**
```typescript
// User authenticated at agentic endpoint
// User context extracted from session
// Agent receives user context (user_id, organization_id)
// Agent makes RPC calls with inherited user context
// All agent operations tracked with triggering user

const agenticHandler = async (payload: { input: string; user_id: string; organization_id: string }) => {
  const rpc = createRPC({ 
    agentMode: true,
    organization_id: payload.organization_id  // Inherited from authenticated user
  });
  
  // Agent operations execute with user context
  const result = await rpc.executeServiceAction('customers', {
    action: 'create',
    payload: {
      name: extractNameFromInput(payload.input),
      email: extractEmailFromInput(payload.input)
      // user_id, organization_id automatically injected
    }
  });
  
  return formatAgentResponse(result);
};
```

### 6.3 Agent Restrictions

**Action-Level Agent Control:**
```typescript
// Prevent agent access to destructive operations
{
  name: 'deleteAllCustomers',
  agentic: false,  // Explicitly prevent agent execution
  handler: destructiveOperation
}

// Allow agent access (default behavior)
{
  name: 'createCustomer', 
  agentic: true,   // Explicitly allow agent execution (optional)
  handler: createHandler
}
```

### 7.4 Action Hook System for Access Control

**Action Hooks** provide a powerful way to implement fine-grained access control, role-based permissions, and cross-cutting concerns across all service actions.

#### Hook Execution Flow

Action hooks execute with precise timing in the authentication pipeline:

```
[Request] → [Auth Validation] → [Action Hook] → [Payload Validation] → [Action Handler]
```

#### Configuring Action Hooks

```typescript
// backend/server.config.ts
import type { ActionHookHandler } from '@nile-squad/nile';

const roleBasedAccessControl: ActionHookHandler = (context, action, payload) => {
  const { user, session } = context;
  
  // Multi-role access control example
  const userRole = user?.role;
  const userOrgId = user?.organization_id;
  const payloadOrgId = payload.organization_id;
  
  // 1. Organization-level data isolation
  if (payloadOrgId && payloadOrgId !== userOrgId) {
    return { error: 'Access denied: Cross-organization access not allowed' };
  }
  
  // 2. Role-based action permissions
  const rolePermissions = {
    // Supa Admin: Full system access
    'supa_admin': ['*'],
    
    // Provider: Manage their organization
    'admin': [
      'users.create', 'users.update', 'users.list',
      'accounts.list', 'accounts.update',
      'tickets.assign', 'tickets.list',
      'system.configure', 'system.monitor'
    ],
    'manager': [
      'tickets.update', 'tickets.view',
      'accounts.view', 'system.troubleshoot'
    ],
    'user': [
      'tickets.create', 'tickets.view',
      'system.connect', 'profile.update'
    ]
  };
  
  const allowedActions = rolePermissions[userRole] || [];
  const hasPermission = allowedActions.includes('*') || 
                       allowedActions.includes(action) ||
                       allowedActions.some(pattern => action.startsWith(pattern.replace('*', '')));
  
  if (!hasPermission) {
    return { error: `Access denied: ${userRole} role cannot perform ${action}` };
  }
  
  // 3. Data-level restrictions
  if (action.includes('tickets') && userRole === 'manager') {
    // Agents can only access their assigned complaints
    if (payload.assignedToAgentId && payload.assignedToAgentId !== user.id) {
      return { error: 'Access denied: You can only access assigned complaints' };
    }
  }
  
  return true; // Allow action to proceed
};

export const serverConfig: ServerConfig = {
  // ... other config
  onActionHandler: roleBasedAccessControl,
};
```

#### Advanced Hook Patterns

**1. Dynamic Permission Loading:**

```typescript
const dynamicPermissions: ActionHookHandler = async (context, action, payload) => {
  const { user } = context;
  
  // Load user permissions from database
  const permissions = await loadUserPermissions(user.id, user.organization_id);
  
  if (!permissions.includes(action)) {
    return { error: 'Insufficient permissions for this action' };
  }
  
  return true;
};
```

**2. Resource-Level Access Control:**

```typescript
const resourceLevelAccess: ActionHookHandler = async (context, action, payload) => {
  if (action === 'complaints.update') {
    // Check if user can modify this specific complaint
    const complaint = await getComplaintById(payload.id);
    
    if (complaint.assignedToAgentId !== context.user.id && 
        context.user.role !== 'admin') {
      return { error: 'You can only modify complaints assigned to you' };
    }
  }
  
  return true;
};
```

**3. Rate Limiting by Role:**

```typescript
const rateLimitingHook: ActionHookHandler = async (context, action, payload) => {
  const rateLimits = {
    'user': { requests: 100, window: 3600 },      // 100/hour
    'manager': { requests: 500, window: 3600 },     // 500/hour  
    'admin': { requests: 1000, window: 3600 }, // 1000/hour
    'supa_admin': null // No limits
  };
  
  const limit = rateLimits[context.user?.role];
  if (limit && await isRateLimited(context.user.id, limit)) {
    return { error: 'Rate limit exceeded. Please try again later.' };
  }
  
  return true;
};
```

#### Hook Contract

**Input Parameters:**
- `context`: { user, session, request }
- `action`: Action name (e.g., "tickets.assign")  
- `payload`: Request payload with auto-injected user context

**Return Values:**
- `true`: Allow action to proceed
- `{ error: string }`: Deny with custom error message

**Error Handling:**
- Framework validates return values at runtime
- Invalid returns throw immediately
- All errors logged with unique IDs
- Automatic HTTP response formatting

#### Integration with Existing Auth

Action hooks complement the existing authentication system:

1. **Authentication validates identity** (user exists, session valid)
2. **Action hooks validate authorization** (user can perform this action)
3. **Service handlers execute business logic** (action implementation)

```typescript
// Combined auth flow
const fullAuthFlow = {
  authentication: betterAuth,     // Who is the user?
  authorization: actionHook,      // What can they do?
  business: serviceHandler        // How do we do it?
};
```

This layered approach ensures both secure authentication and flexible authorization for complex multi-role systems.

### 7.1 Authentication Validation Flow

**Request Processing Pipeline:**
```
1. HTTP Request → Extract auth credentials (session/token)
2. Validate credentials → Better Auth or JWT verification
3. Extract user context → user_id, organization_id from claims
4. Enrich payload → Inject context into action payload
5. Execute action → With enriched, validated context
```

### 7.2 Context Injection Implementation

**HTTP REST Mode:**
```typescript
// nile/src/rest-rpc/rest-rpc.ts
function enrichPayloadWithUserContext(payload: any, authResult: any) {
  if (authResult?.userId) {
    payload.user_id = authResult.userId;
  }
  if (authResult?.organization_id) {
    payload.organization_id = authResult.organization_id;
  }
  return payload;
}
```

**RPC Mode:**
```typescript
// nile/src/rest-rpc/rpc-utils/rpc-utils.ts  
function enrichRPCPayload(payload: any, config: RPCConfig) {
  if (config.organization_id) {
    payload.organization_id = config.organization_id;
    payload.user_id = config.user_id || generateAgentUserId(config.organization_id);
  }
  return payload;
}
```

### 7.3 Security Features

**Session Security:**
- HTTP-only cookies prevent XSS attacks
- Secure flag for HTTPS environments
- SameSite protection against CSRF
- Automatic session expiration and refresh

**JWT Security:**
- HMAC-SHA256 signing with configurable secret
- Short expiration times (1 hour default)
- Required claims validation (sub, userId, organizationId)
- No sensitive data in payload

**Agent Security:**
- System-level tokens with long expiration (1 year)
- Organization context required for operations
- Action-level restrictions (`agentic: false`)
- Audit trail with triggering user tracking

## 8. Environment Configuration

### 8.1 Required Environment Variables

```bash
# Authentication Secret (Required)
AUTH_SECRET=your-256-bit-secret-key
BASE_URL=http://localhost:8000

# JWT Configuration
JWT_SECRET=your-jwt-secret-key  # Defaults to AUTH_SECRET if not set

# Database (Required for Better Auth)
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Optional OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id  
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### 8.2 Development vs Production

**Development Configuration:**
```bash
# Relaxed security for development
AUTH_SECRET=development-secret-key
BASE_URL=http://localhost:8000
COOKIE_SECURE=false  # Allow HTTP cookies
```

**Production Configuration:**
```bash
# Strict security for production
AUTH_SECRET=cryptographically-secure-256-bit-key
BASE_URL=https://your-domain.com
COOKIE_SECURE=true   # Require HTTPS cookies
```

## 9. Role-Based Access Control (RBAC)

### 9.1 Overview

The Nile framework supports sophisticated role-based access control through the `meta.access` property on SubServices. This system provides granular permissions for different user roles and integrates seamlessly with the authentication layer.

### 9.2 RBAC Configuration

**Basic RBAC Structure:**
```typescript
{
  name: 'users',
  tableName: 'users',
  idName: 'id',
  meta: {
    access: {
      create: ['owner', 'admin'],
      read: ['owner', 'admin', 'manager', 'member'],
      update: ['owner', 'admin', 'manager'],
      delete: ['owner', 'admin'],
      getAll: ['owner', 'admin', 'manager'],
      getOne: ['owner', 'admin', 'manager', 'member'],
    }
  }
}
```

**Universal Access Pattern:**
```typescript
{
  name: 'public-content',
  meta: {
    access: ['*'] // Allow all authenticated users
  }
}
```

### 9.3 Two-Layer Security Architecture

The framework implements a **two-layer security system**:

1. **Authentication Layer**: Controls whether authentication is required
2. **Authorization Layer**: Controls role-based permissions after authentication

**Flow Diagram:**
```
Request → Authentication Check → Role-Based Authorization → Action Execution
```

**Layer Integration:**
```typescript
{
  name: 'products',
  publicActions: ['getAll', 'getOne'], // Layer 1: No authentication required
  meta: {
    access: {
      create: ['owner', 'admin'],      // Layer 2: Role-based after authentication
      update: ['owner', 'admin'],
      delete: ['owner']
    }
  }
}
```

### 9.4 Role Hierarchy Patterns

**Standard Role Hierarchy:**
```typescript
// Common role hierarchy (most permissive to least)
const roleHierarchy = {
  owner: ['create', 'read', 'update', 'delete', 'manage'],
  admin: ['create', 'read', 'update', 'delete'],
  manager: ['create', 'read', 'update'],
  member: ['read'],
  guest: [] // No permissions
};
```

**Custom Role Systems:**
```typescript
// Department-based roles
meta: {
  access: {
    create: ['hr-admin', 'department-head'],
    read: ['hr-admin', 'department-head', 'employee'],
    update: ['hr-admin'],
    delete: ['hr-admin']
  }
}

// Feature-based roles
meta: {
  access: {
    create: ['content-creator', 'editor'],
    read: ['content-creator', 'editor', 'viewer'],
    update: ['editor'],
    delete: ['editor']
  }
}
```

### 9.5 Access Control Hook Implementation

**Generic Access Control Hook:**
```typescript
import type { ActionHookHandler } from '@nile-squad/nile/types';

export const accessControlHook: ActionHookHandler = (context, action, _payload) => {
  const { user } = context;

  // Skip for unauthenticated users - framework handles public actions
  if (!user) {
    return true;
  }

  const userRole = user.role || 'member';

  if (!action.meta?.access) {
    return { error: 'Access denied: No permissions defined for this action.' };
  }

  const accessMeta = action.meta.access;

  // Universal access pattern
  if (Array.isArray(accessMeta) && accessMeta.includes('*')) {
    return true;
  }

  let allowedRoles: string[] | undefined;

  // Auto-generated CRUD actions
  if (action.type === 'auto') {
    if (typeof accessMeta === 'object' && accessMeta !== null) {
      allowedRoles = accessMeta[action.name];
    }
  }
  // Custom actions
  else if (Array.isArray(accessMeta)) {
    allowedRoles = accessMeta;
  }

  if (allowedRoles?.includes(userRole)) {
    return true;
  }

  return { error: 'Access denied' };
};
```

### 9.6 Advanced RBAC Patterns

**Conditional Access:**
```typescript
meta: {
  access: {
    read: ['member'], // Basic read access
    update: (context, action, payload) => {
      // Dynamic permission logic
      const { user } = context;
      return user.id === payload.owner_id || ['owner', 'admin'].includes(user.role);
    }
  }
}
```

**Resource-Scoped Permissions:**
```typescript
meta: {
  access: {
    read: ['organization-member'], // Scoped to organization
    update: ['department-manager'], // Scoped to department
    delete: ['resource-owner'] // Scoped to specific resource
  }
}
```

## 10. Troubleshooting Guide

### 10.1 Common Authentication Issues

**Issue: "Authentication required" for public endpoints**
```typescript
// Solution: Add publicActions to service configuration
{
  name: 'marketing',
  publicActions: ['subscribe'],  // Allow public access
}
```

**Issue: "User context missing" in service handlers**
```typescript
// Verify authentication is working and context injection is enabled
// Check that client includes proper authentication headers
```

**Issue: "Organization context missing" for agent operations**
```typescript
// Solution: Provide organization_id in RPC configuration
const rpc = createRPC({
  agentMode: true,
  organization_id: 'valid-org-uuid'  // Required for agent mode
});
```

### 10.2 Authentication Debugging

**Check Session Status:**
```bash
curl -X GET http://localhost:8000/auth/get-session \
  -H "Cookie: better-auth.session_token=TOKEN" -v
```

**Validate JWT Token:**
```typescript
import jwt from 'jsonwebtoken';

try {
  const decoded = jwt.verify(token, process.env.AUTH_SECRET);
  console.log('Token valid:', decoded);
} catch (error) {
  console.log('Token invalid:', error.message);
}
```

**Test Agent Authentication:**
```typescript
const rpc = createRPC({ agentMode: true, organization_id: 'test-org' });
const result = await rpc.executeServiceAction('testing', { action: 'simpleAction', payload: {} });
console.log('Agent auth result:', result);
```

**Author:** [Hussein Kizz](https://github.com/Hussseinkizz) at Nile Squad Labz

*This specification reflects the current implementation and is subject to evolution. Contributions and feedback are welcome.*