# REST-RPC Specification

**Version:** 1.0  
**Date:** August 13, 2025  
**Author:** Hussein Kizz

## 1. Overview

A service-oriented architecture that bridges REST discovery with RPC execution, enabling:

- **Service Discovery** through HTTP GET endpoints
- **Action Execution** via standardized POST requests  
- **Self-Documenting APIs** with schema introspection
- **Hook-Based Workflows** for complex business logic
- **Agent Integration** for AI-driven interactions
- **Database Model Automation** with generated CRUD operations
- **Multi-Modal Execution** (HTTP, WebSocket RPC, direct RPC, agent-based)
- **Real-Time Communication** through WebSocket RPC events

This specification can be implemented in any programming language or framework.

## 2. Core Philosophy

### 2.1 Design Principles

**Why Service-Action Oriented?**

- Business operations map naturally to named actions
- Self-documenting through consistent endpoint structure
- Enables complex workflows through hook composition
- Supports both human and agent-driven interactions

**Why Dual-Method Approach?**

- `GET` requests for exploration and discovery
- `POST` requests for all action execution
- Eliminates HTTP method confusion for complex operations
- Consistent response format across all endpoints

**Why Self-Documenting?**

- No external documentation tools required
- APIs can be explored programmatically
- Enables AI agents to learn and interact dynamically
- Schema-driven validation with runtime introspection

## 3. Service Discovery Flow

### 3.1 Discovery Pattern

```
GET /services → List all services
GET /services/{service} → Service details and actions  
GET /services/{service}/{action} → Action schema and requirements
POST /services/{service} → Execute action with payload
```

### 3.2 Exploration Workflow

1. **Service Enumeration** - Discover what services exist
2. **Service Inspection** - Learn what actions are available
3. **Action Introspection** - Understand required parameters and validation
4. **Execution** - Invoke actions with proper payloads

### 3.3 Self-Documentation Benefits

**For Developers:**

- Eliminates need for separate API documentation
- Real-time schema validation and error details
- Consistent patterns across all services

**For AI Agents:**

- Dynamic capability discovery
- Schema-driven parameter inference
- Automatic adaptation to API changes

## 4. Action Execution Model

### 4.1 Unified Invocation Pattern

All actions follow the same request structure:

```json
{
  "action": "actionName",
  "payload": {
    "param1": "value1",
    "param2": "value2"
  }
}
```

### Response Consistency

Standard response format across all operations:

```json
{
  "status": boolean,
  "message": string,
  "data": any | null
}
```

### Execution Modes

**HTTP Mode** - Traditional REST-like interaction
**RPC Mode** - Direct programmatic service calls
**Agent Mode** - AI-driven natural language execution

## 5. Hook System Architecture

### Workflow Composition

Hooks enable complex business logic through action composition:

**Before Hooks** - Data preparation, validation, enrichment
**After Hooks** - Logging, notifications, cleanup, side effects

### Data Flow Strategy

```
Input → Before Hook 1 → Before Hook 2 → Main Action → After Hook 1 → After Hook 2 → Output
```

**Chain Behavior:**

- Each successful hook passes output to next hook
- Failed hooks with `canFail: true` are skipped
- Failed hooks with `canFail: false` stop execution
- Main action receives final successful before hook output

### Error Handling Philosophy

**Critical Hooks** (`canFail: false`)

- Must succeed for workflow to continue
- Used for validation, security, essential setup
- Failure terminates entire action

**Optional Hooks** (`canFail: true`)  

- Failures are logged but don't stop workflow
- Next hook receives last successful output
- Used for notifications, analytics, non-essential operations

### Pipeline Visibility

**Standard Mode** (`pipeline: false`)

- Returns only final result
- Hides hook execution details
- Optimized for production performance

**Debug Mode** (`pipeline: true`)

- Returns result plus execution logs
- Shows hook success/failure details
- Useful for debugging and auditing

**Example Hook Configuration:**

```json
{
  "hooks": {
    "before": [
      { "name": "validateInput", "canFail": false },
      { "name": "enrichData", "canFail": true }
    ],
    "after": [
      { "name": "auditLog", "canFail": true },
      { "name": "sendNotification", "canFail": true }
    ]
  },
  "result": { "pipeline": true }
}
```

## 6. Agent Integration

### Natural Language Interface

The agentic system provides conversational access to backend services:

**Endpoint:** `POST /services/agentic`

**Request Pattern:**

```json
{
  "action": "agent",
  "payload": {
    "input": "Create a user account for john@example.com"
  }
}
```

### Agent Authentication Strategy

**Agent Mode Execution:**

- Automatic authentication token attachment
- Bypasses user-level permission checks
- System-level service access
- Audit trail with agent context

**Action-Level Control:**

```typescript
{
  name: "deleteAll",
  agentic: false,  // Explicitly prevent agent execution
  handler: destructiveOperation
}
```

### Use Cases

**Service Discovery:** "What services are available?"
**Data Operations:** "Get all users created this month"  
**Complex Workflows:** "Create account and send welcome email"
**Analysis:** "Generate user engagement report"

## 7. Database Model System

### Auto-Generated Services

The framework can automatically generate CRUD services from database schemas:

**Configuration Pattern:**

```typescript
{
  autoService: true,
  subs: [
    {
      name: "users",
      table: usersTable,
      actions: [...customActions]
    }
  ]
}
```

### Generated Operations

**Standard CRUD:**

- `create` - Insert new records with validation
- `getAll` - Retrieve records filtered by any property/value pair
- `getOne` - Find single record by field value
- `update` - Update existing records with merge logic
- `delete` - Remove single record
- `getMany` - Retrieve multiple records with filtering

**Advanced Queries:**

- `getEvery` - Retrieve all records without filtering
- `getManyWith` - Complex filtering, sorting, pagination
- `getOneWith` - Multi-field filtering
- `getOneWithRelations` - Join queries with related data
- `deleteAll` - Remove all records from table

### Validation Strategy

**Auto-Inference:** Database schema automatically drives validation rules
**Custom Validation:** Override with validation schemas for complex requirements  
**Context-Aware:** Different validation for create vs update operations
**Consistent Processing:** All validation handled uniformly across operations

### Benefits

**Rapid Development:**

- Instant CRUD APIs from database schemas
- Consistent operation patterns across entities
- Built-in validation and error handling

**Maintenance Reduction:**

- Schema changes automatically reflected in API
- No boilerplate CRUD code to maintain
- Standardized error handling and logging

## 8. RPC Utilities

### Direct Service Communication

RPC utilities enable internal service communication without HTTP overhead:

```typescript
const rpc = createRPC({
  resultsMode: 'data',    // Return structured result objects
  agentMode: true,        // Enable agent authentication
  serverConfig            // Access to service definitions
});
```

### Result Modes

**Data Mode** (`resultsMode: 'data'`)

- Returns structured result objects with success/error handling
- Optimized for programmatic consumption
- Type-safe error handling

**JSON Mode** (`resultsMode: 'json'`)

- Returns JSON strings matching HTTP response format
- Compatible with external system integration
- Consistent with REST API responses

### Service Discovery via RPC

**Service Enumeration:**

```typescript
const services = await rpc.getServices();
```

**Service Inspection:**

```typescript
const serviceDetails = await rpc.getServiceDetails('users');
```

**Action Introspection:**

```typescript
const actionSchema = await rpc.getActionDetails('users', 'create');
```

**Action Execution:**

```typescript
const result = await rpc.executeServiceAction('users', {
  action: 'create',
  payload: { name: 'John', email: 'john@example.com' }
});
```

### Integration Patterns

**Microservice Communication:**

- Direct service-to-service calls
- No HTTP serialization overhead
- Shared authentication context

**Testing Infrastructure:**

- Unit test actions without HTTP layer
- Integration testing with real service logic
- Mock-free testing with direct calls

**Agent Systems:**

- AI agents using RPC for service interaction
- Automatic schema discovery and adaptation
- Built-in agent authentication handling

## 9. Authentication & Authorization

### Security-by-Default Architecture

**All actions are protected by default** unless explicitly marked as public:

```typescript
// Auto-generated CRUD actions require authentication
{
  name: 'users',
  // All CRUD actions (create, getAll, etc.) are protected by default
}

// Manual actions with explicit public access
{
  name: 'createWaitlistEntry',
  isProtected: false,  // Explicitly allow public access
  handler: publicHandler
}

// Service-level public actions  
{
  name: 'products',
  publicActions: ['getAll', 'getOne'],  // Public browsing (no authentication required)
  // create, update, delete remain protected by default
}
```

### Multi-Mode Authentication Strategy

The system supports three authentication modes with automatic fallback:

**1. Better Auth Session (Primary)**

- HTTP-only secure cookies
- Organization context included
- Preferred for web applications

**2. JWT Bearer Tokens (API Access)**  

- Standard `Authorization: Bearer <token>` header
- Validated against configured secret
- Used for programmatic access

**3. Agent Authentication (Internal Operations)**

- System-level access for AI agents
- Automatic context injection
- Audit trail with triggering user

### Context Injection Architecture

**Design Principle: Secure Context Enrichment**

User context (`user_id`, `organization_id`) is automatically injected by the authentication layer, preventing client-side tampering:

```typescript
// Client sends minimal payload
{
  "action": "createCustomer",
  "payload": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}

// System automatically enriches with authenticated context
{
  "action": "createCustomer", 
  "payload": {
    "name": "John Doe",
    "email": "john@example.com",
    "user_id": "550e8400-e29b-41d4-a716-446655440001",     // Auto-injected
    "organization_id": "550e8400-e29b-41d4-a716-446655440000"  // Auto-injected
  }
}
```

**Why Context Injection?**

- **Security**: Prevents client-side spoofing of user/organization context
- **Consistency**: Identical behavior across HTTP REST and RPC modes  
- **Simplicity**: Cleaner client code without manual context management
- **Audit**: Reliable tracking of who performed what actions

### Authentication Flow Architecture

**HTTP REST Mode:**

```
1. Client → Authentication validation (Better Auth/JWT)
2. Extract user context from auth claims  
3. Enrich payload with user_id/organization_id
4. Execute action with enriched context
```

**RPC Mode:**

```
1. RPC client → Agent mode or explicit organization context
2. Validate agent authentication if agent mode enabled
3. Enrich payload with provided/agent context
4. Execute action with enriched context
```

**Agent Mode (AI Operations):**

```
1. Agent → Authenticated user triggers agentic endpoint
2. User context extracted from authentication
3. Agent RPC calls inherit user context automatically
4. All agent operations tracked with triggering user
```

### Permission Strategy

**Action-Level Control:**

- Each action declares protection requirements
- Fine-grained permission model  
- Agent execution control per action

**Organization-Level Isolation:**

- All data scoped to authenticated user's organization
- Automatic multi-tenant data separation
- No cross-organization data access

**Agent Restrictions:**

```typescript
{
  name: "deleteAllData",
  agentic: false,  // Explicitly prevent agent execution
  handler: destructiveOperation
}
```

## 10. Action Hook System (Global Pre-Action Hooks)

**Action Hooks** provide global pre-action execution logic for cross-cutting concerns like authorization, rate limiting, and audit logging. Unlike action-level hooks which run within a specific action's workflow, Action Hooks run before **every** action across **all** services.

### Hook Execution Pipeline

```
[Request] → [Authentication] → [Action Hook] → [Payload Validation] → [Action Handler]
```

Action Hooks execute after authentication but before payload validation, ensuring they have access to authenticated user context while being able to deny actions before expensive validation occurs.

### Configuration

Action Hooks are configured globally in the server configuration:

```typescript
// backend/server.config.ts
import type { ActionHookHandler } from '@nile-squad/nile';

const globalAccessControl: ActionHookHandler = (context, action, payload) => {
  const { user, session, request } = context;
  
  // Role-based access control
  const userRole = user?.role;
  const rolePermissions = {
    'admin': ['*'],
    'user': ['profile.update', 'tickets.create'],
    'manager': ['tickets.update', 'system.troubleshoot']
  };
  
  const allowedActions = rolePermissions[userRole] || [];
  if (!allowedActions.includes('*') && !allowedActions.includes(action)) {
    return safeError(`Access denied: ${userRole} cannot perform ${action}`, 'access-denied-role');
  }
  
  return Ok(); // Allow action to proceed
};

export const serverConfig: ServerConfig = {
  // ... other config
  onActionHandler: globalAccessControl,
};
```

### Hook Handler Contract

**Input Parameters:**
- `context`: Hook execution context
  - `user`: Authenticated user object (null if not authenticated)
  - `session`: Session data (null if no session)  
  - `request`: HTTP request object
- `action`: Action name being executed (e.g., "tickets.assign")
- `payload`: Request payload with auto-injected user context

**Return Values:**
- `Ok(data, message?)`: Allow action to proceed (data can be any value, message is optional)
- `safeError(message, error_id)`: Deny action with custom error message and error id

**Runtime Validation:**
The framework strictly validates hook return values and throws immediately for invalid returns.

### Use Cases

**1. Role-Based Access Control:**

```typescript
const roleBasedAccess: ActionHookHandler = (context, action, payload) => {
  const userRole = context.user?.role;
  
  // Define hierarchical permissions
  if (action.startsWith('admin.') && userRole !== 'admin') {
    return safeError('Administrative privileges required', 'admin-required');
  }
  
  if (action.includes('delete') && !['admin', 'moderator'].includes(userRole)) {
    return safeError('Deletion requires elevated privileges', 'deletion-elevated-privileges');
  }
  
  return Ok();
};
```

**2. Organization Data Isolation:**

```typescript
const organizationIsolation: ActionHookHandler = (context, action, payload) => {
  const userOrgId = context.user?.organization_id;
  const payloadOrgId = payload.organization_id;
  
  // Ensure users only access their organization's data
  if (payloadOrgId && payloadOrgId !== userOrgId) {
    return safeError('Cross-organization access denied', 'cross-org-denied');
  }
  
  return Ok();
};
```

**3. Rate Limiting:**

```typescript
const rateLimiting: ActionHookHandler = async (context, action, payload) => {
  const userId = context.user?.id;
  const limits = { user: 100, admin: 1000 }; // requests per hour
  
  if (await isRateLimited(userId, limits[context.user?.role])) {
    return safeError('Rate limit exceeded. Please try again later.', 'rate-limit-exceeded');
  }
  
  return Ok();
};
```

### Action Hooks vs Action-Level Hooks

| Feature | Action Hooks (Global) | Action-Level Hooks |
|---------|----------------------|-------------------|
| **Scope** | All actions across all services | Specific action only |
| **Purpose** | Cross-cutting concerns (auth, rate limiting) | Business workflow logic |
| **Execution** | Before every action | Within action workflow |
| **Return Type** | `Ok(data, message?) \| safeError(message, error_id)` | `SafeResult<T>` |
| **Configuration** | Server config (`onActionHandler`) | Individual action (`hooks` property) |
| **Data Flow** | Denies or allows action execution | Transforms action data |

### Error Handling

Action Hook errors are automatically handled by the framework:

```json
// Hook denial response
{
  "status": false,
  "message": "Access denied: user cannot perform tickets.delete",
  "data": {
    "error_id": "hook_denial_12345"
  }
}
```

### Best Practices

1. **Keep Lightweight**: Hooks run on every request, optimize for speed
2. **Fail Secure**: Deny access when in doubt
3. **Clear Error Messages**: Provide actionable feedback to users
4. **Async Support**: Use async/await for database lookups
5. **Single Responsibility**: One hook function per concern (auth, rate limiting, etc.)

## 11. Data Handling Patterns

### Flexible Filtering with getAll

The `getAll` action demonstrates a key philosophical principle: **dynamic adaptability over static configuration**. Instead of hardcoding specific filter fields, the action accepts any property/value pair, making it adaptable to different data access patterns:

```json
{
  "action": "getAll",
  "payload": {
    "property": "organization_id",
    "value": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Philosophical Benefits:**
- **Dynamic Filtering**: Filter by any database column, not just hardcoded fields
- **Reusable Actions**: Same action works for different filtering needs across your application
- **Type-Safe**: Framework ensures property exists in your schema
- **Consistent API**: Same pattern across all auto-generated actions
- **Future-Proof**: Add new columns to your schema and immediately filter by them

**Implementation Considerations:**
- Property names should be validated against the database schema
- Value types should match the expected column types
- Error handling should provide clear feedback for invalid properties

### Pagination Strategy

For pagination and complex filtering, use `getManyWith`:

```json
{
  "action": "getManyWith",
  "payload": {
    "page": 2,
    "perPage": 25,
    "filters": { "status": "active" },
    "sort": [{ "field": "created_at", "direction": "desc" }]
  }
}
```

**Response Format:**

```json
{
  "data": {
    "items": [...],
    "meta": {
      "totalItems": 102,
      "totalPages": 5,
      "currentPage": 2,
      "perPage": 25
    }
  }
}
```

### Filtering Conventions

**Simple Filters:** Field-value equality matching
**Complex Filters:** Range queries, pattern matching
**Relational Filters:** Cross-table filtering with joins

### Special Columns

**"other" Column Pattern:**

- JSON storage for flexible schema extension
- Automatic parsing/stringification
- Merge logic for updates

## 12. Error Handling Strategy

### Validation Errors

Detailed validation failure responses:

```json
{
  "status": false,
  "message": "Invalid request format",
  "data": {
    "missing": ["user_id", "title"],
    "invalid": {
      "due_date": "must be a valid ISO date string"
    }
  }
}
```

### Error Tracing

**Error IDs:** Unique identifiers for debugging
**Context Preservation:** Full error context in logs
**User-Friendly Messages:** Safe error messages for clients

### Graceful Degradation

**Hook Failures:** Continue workflow when possible
**Service Unavailability:** Informative error responses
**Validation Failures:** Detailed field-level feedback

## 13. Architectural Benefits

### Development Velocity

**Rapid Prototyping:**

- Database-driven API generation
- Consistent patterns reduce learning curve
- Self-documenting eliminates documentation overhead

**Maintenance Efficiency:**

- Schema changes automatically reflected
- Hook system enables complex workflows
- Standardized error handling

### Integration Flexibility

**Multi-Modal Access:**

- HTTP for external clients
- RPC for internal services  
- Agent interface for AI systems

**Discovery-Driven:**

- APIs self-describe capabilities
- Dynamic client adaptation
- AI agent auto-configuration

### Scalability Characteristics

**Service Isolation:**

- Independent service development
- Granular permission control
- Horizontal scaling per service

**Workflow Composability:**

- Reusable hook components
- Complex business logic assembly
- Testable workflow segments

## 14. Use Case Scenarios

### When REST-RPC Excels

**Complex Business Logic:**

- Multi-step workflows through hooks
- Action composition and reuse
- Conditional execution patterns

**AI-Native Applications:**

- Self-discovering APIs for agents
- Natural language service interaction
- Dynamic capability adaptation

**Rapid Development:**

- Database-driven API generation
- Consistent patterns across services
- Minimal boilerplate requirements

**Internal APIs:**

- Service-to-service communication
- Shared business logic
- Consistent error handling

### When to Consider Alternatives

- Standard REST may be more appropriate
- When HTTP method semantics are important
- Public APIs expecting REST conventions
- Binary protocol requirements
- When HTTP method-based caching is crucial
- CDN integration requirements
- Static resource serving

## 15. WebSocket RPC Support

### 14.1 Real-Time Integration

REST-RPC includes full WebSocket support through the **WebSocket RPC** extension, providing:

- **Complete HTTP Parity**: All REST-RPC operations available via WebSocket events
- **Real-time Communication**: Bidirectional, persistent connections for live applications
- **Unified Authentication**: Uses existing HTTP-issued tokens and sessions
- **Event-Driven Architecture**: Five core RPC events (`listServices`, `getServiceDetails`, `getActionDetails`, `getSchemas`, `executeAction`)

### 14.2 WebSocket Configuration

```typescript
const server = createRestRPCServer({
  // ... other config
  websocket: {
    enabled: true,              // Enable WebSocket RPC
    namespace: '/ws/rpc',       // WebSocket namespace
    cors: {
      origin: 'http://localhost:3000',
      credentials: true
    }
  }
});
```

### 14.3 WebSocket Usage Example

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/ws/rpc', {
  auth: { token: 'Bearer <jwt_token>' }
});

// Execute action via WebSocket (identical response to HTTP)
socket.emit('executeAction', {
  service: 'accounts',
  action: 'create',
  payload: { name: 'John', email: 'john@example.com' }
}, (response) => {
  console.log(response); // Same format as HTTP POST /services/accounts/create
});
```

For complete WebSocket RPC documentation, see [WebSocket RPC Specification](./ws-rpc.spec.md).

## 16. Future Considerations

### Extensibility Points

**Protocol Evolution:**

- ✅ **WebSocket support for real-time** (Available Now)
- GraphQL-style query capabilities
- Binary protocol variants

**Enhanced Discovery:**

- Semantic action descriptions
- Capability-based service matching
- Intelligent agent routing

**Advanced Workflows:**

- Cross-service transactions
- Distributed hook execution
- Event-driven service coordination

### Integration Opportunities

**Observability:**

- Distributed tracing integration
- Performance monitoring hooks
- Business metric collection

**Security Enhancements:**

- Fine-grained permission models
- Rate limiting per action
- Audit trail improvements

The REST-RPC architecture provides a foundation for building discoverable, composable, and AI-friendly service-oriented systems while maintaining the simplicity and predictability that developers expect.

## 17. Protocol Specification

### 3.1. Service Discovery

#### 3.1.1. Request

A `GET` request is made to the `/services` endpoint. The URL has a specific anatomy:

`/{baseURL}/{apiVersion}/services`

- **`baseURL`**: The base path for the API (e.g., `/api`, `/testing/api`).
- **`apiVersion`**: The version of the API (e.g., `v1`, `v2`).

**Example:**

```bash
curl localhost:8000/Delta/api/v1/services
```

#### 3.1.2. Response

The server responds with a standard JSON object with the following keys:

- **`status`**: A boolean that is `true` on success and `false` on failure.
- **`message`**: A string containing a descriptive message about the outcome.
- **`data`**: On success, this holds an array of strings, where each string is an available service name. On failure, this is typically `null` or empty. It may optionally contain an object with an `error_id` for tracing purposes. The `error_id` is a unique 6-character code or a UUID.

**Example Success Response:**

```json
{
  "status": true,
  "message": "List of all available services on Delta Server.",
  "data": [
    "data-service",
    "todos",
    "users"
  ]
}
```

**Example Error Response (Simple):**

```json
{
  "status": false,
  "message": "An error occurred while fetching services.",
  "data": null
}
```

**Example Error Response (With Trace ID):**

```json
{
  "status": false,
  "message": "An error occurred while fetching services.",
  "data": {
    "error_id": "a7b3c9"
  }
}
```

### 3.2. Service Exploration

#### 3.2.1. Request

A `GET` request is made to a specific service's endpoint:

`/{baseURL}/{apiVersion}/services/{serviceName}`

- **`serviceName`**: The name of the service to explore (e.g., `todos`).

**Example:**

```bash
curl localhost:9000/testing/api/v1/services/todos
```

#### 3.2.2. Response

The server responds with the standard JSON structure. On success, the `data` object contains details about the requested service.

- **`name`**: The name of the service.
- **`description`**: A human-readable description of the service's purpose.
- **`availableActions`**: An array of strings, where each string is an action that can be invoked on this service.

**Example Success Response:**

```json
{
  "status": true,
  "message": "Service Details",
  "data": {
    "name": "todos",
    "description": "todos service",
    "availableActions": [
      "create",
      "getAll",
      "getOne",
      "update",
      "delete",
      "getEvery"
    ]
  }
}
```

### 3.3. Action Exploration

#### 3.3.1. Request

A `GET` request is made to a specific action's endpoint:

`/{baseURL}/{apiVersion}/services/{serviceName}/{actionName}`

- **`actionName`**: The name of the action to explore (e.g., `create`).

**Example:**

```bash
curl localhost:9000/testing/api/v1/services/todos/create
```

#### 3.3.2. Response

The server responds with the standard JSON structure. On success, the `data` object contains details about the requested action.

- **`name`**: The name of the action.
- **`description`**: A human-readable description of what the action does.
- **`isProtected`**: A boolean indicating whether the action requires authentication or special authorization to execute.
- **`validation`**: An object that describes the expected payload for the action. This schema should be consistent and clearly define what fields are required, their types, and any other constraints. While the example below uses JSON Schema, any consistent and descriptive format can be used.
- **`hooks`**: An object describing the hooks that run before and after the action. Contains `before` and `after` arrays with hook definitions. Each hook has a `name` (string) and `canFail` (boolean) property. If `null`, the action has no hooks configured.
- **`pipeline`**: A boolean indicating whether the action returns detailed execution logs along with the result. If `true`, response includes hook execution details. If `false` or missing, returns only the final result.

**Example Success Response:**

```json
{
  "status": true,
  "message": "Action Details",
  "data": {
    "name": "create",
    "description": "Create a new record in todos",
    "isProtected": false,
    "validation": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "user_id": { "type": "string", "format": "uuid" }
      },
      "required": ["title", "user_id"]
    },
    "hooks": {
      "before": [
        { "name": "validateInput", "canFail": false },
        { "name": "enrichData", "canFail": true }
      ],
      "after": [
        { "name": "auditLog", "canFail": true },
        { "name": "sendNotification", "canFail": true }
      ]
    },
    "pipeline": true
  }
}
```

**Example Success Response (Action without hooks):**

```json
{
  "status": true,
  "message": "Action Details",
  "data": {
    "name": "getAll",
    "description": "Retrieve all records from todos",
    "isProtected": false,
    "validation": null,
    "hooks": null,
    "pipeline": false
  }
}
```

### 3.4. Authentication

If an action is marked as protected (`"isProtected": true`), the client MUST include an `Authorization` header in the request. The most common method is using a Bearer token.

- **Header:** `Authorization: Bearer <token>`

Any other standard auth methods are also allowed. The Bearer token is only required if the action is protected, as seen during Action Exploration.

Tokens are typically obtained by interacting with a dedicated `auth` service, which would expose actions like `login`, `signup`, or `refreshToken`.

### 3.5. Action Invocation

To execute an action on a service, the client sends a `POST` request to the service's endpoint.

#### 3.5.1. Request

- **Method:** `POST`
- **URL:** `/{baseURL}/{apiVersion}/services/{serviceName}`
- **Headers:**

  - `Content-Type`: MUST be `application/json`.
  - `Authorization`: Required if the action is protected (e.g., `Bearer <token>`).
- **Body:** The request body is a JSON object containing the action to be executed and its corresponding payload.

```json
{
  "action": "actionName",
  "payload": {
    "param1": "value1",
    "param2": "value2"
  }
}
```

- **`action`**: The name of the action to invoke (e.g., `update`).
- **`payload`**: An object containing the data required for the action. The structure of this payload should match the validation schema discovered via Action Exploration.

**Example `curl` Request:**

```bash
curl -X POST \
  localhost:9000/testing/api/v1/services/todos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_jwt_token>" \
  -d '{
        "action": "update",
        "payload": {
          "todo_id": "some_todo_uuid",
          "completed": true
        }
      }'
```

#### 3.5.2. Response

The server responds with the standard JSON structure (`status`, `message`, `data`).

- On success, the `data` field contains the result of the action. This could be the created or updated resource, a confirmation message, or be `null` if no specific data needs to be returned.
- On failure (e.g., validation error, unauthorized access), the `status` will be `false`, and the `message` will contain a descriptive error.

**Example Success Response:**

```json
{
  "status": true,
  "message": "Todo updated successfully.",
  "data": {
    "todo_id": "some_todo_uuid",
    "title": "My Updated Todo",
    "completed": true,
    "user_id": "some_user_uuid"
  }
}
```

**Example Error Response:**

```json
{
  "status": false,
  "message": "Todo not found.",
  "data": null
}
```

#### 3.5.3. Validation Errors

When the client’s request payload fails validation:

- **`status`**: `false`
- **`message`**: `invalid request format`
- **`data`**: An object detailing any missing or malformed fields.
- For `multipart/form-data` is also accepted on top of JSON, and with it still we pass `action` name and then `file` or `files` in form fields.
- Pagination and filtering that can be passed in payload.
- Versioning though not so much needed in this case since new actions can just be added into a services without removing old ones or breaking anything but for any thing a new version can be exposed under new version eg from v1 to v2 and both can be run in parallel yes.

**Example Validation Failure Response:**

```json
{
  "status": false,
  "message": "invalid request format",
  "data": {
    "missing": ["user_id", "title"],
    "invalid": {
      "due_date": "must be a valid ISO date string"
    }
  }
}
```

### 3.6. Schema Endpoint

For client-side type generation, tooling, or documentation, a single endpoint can be used to retrieve the entire API schema, including all services and their actions.

#### 3.6.1. Request

A `GET` request is made to the `/schema` endpoint.

`/{baseURL}/{apiVersion}/services/schema`

**Example:**

```bash
curl localhost:9000/testing/api/v1/services/schema
```

#### 3.6.2. Response

The server responds with the standard JSON structure. On success, the `data` field contains an array of all services. Each service object in the array contains a list of its actions and their corresponding validation schemas.

This provides a complete, machine-readable definition of the entire API surface, which is invaluable for building type-safe clients and other integrations.

**Example Success Response (truncated for brevity):**

```json
{
  "status": true,
  "message": "3M Testing Server Services actions zod Schemas",
  "data": [
    {
      "data-service": [
        { 
          "name": "greet", 
          "description": "...", 
          "validation": null,
          "hooks": null,
          "pipeline": false
        }
      ]
    },
    {
      "todos": [
        {
          "name": "create",
          "description": "...",
          "validation": { "$schema": "...", "type": "object", "..." },
          "hooks": {
            "before": [
              { "name": "validateInput", "canFail": false }
            ],
            "after": [
              { "name": "auditLog", "canFail": true }
            ]
          },
          "pipeline": true
        },
        { 
          "name": "getAll", 
          "description": "...", 
          "validation": null,
          "hooks": null,
          "pipeline": false
        }
      ]
    }
  ]
}
```

### 3.8. Agentic Endpoint

The agentic endpoint provides a specialized interface for AI agents and automated systems to interact with your REST-RPC server using natural language inputs. This endpoint is designed to handle text-based requests and return text-based responses, making it ideal for integration with language models, chatbots, and other AI-driven systems.

#### 3.8.1. Configuration

To enable the agentic endpoint, configure your server with an `agenticConfig`:

```typescript
const config: ServerConfig = {
  // ... other config
  agenticConfig: {
    handler: async (payload: {
      input: string;
      organization_id: string;
      user_id: string;
    }): Promise<string> => {
      // Your AI/agent processing logic here
      // Has access to organization and user context
      return "Agent response based on input";
    }
  }
};
```

#### 3.8.2. Request

- **Method:** `POST`
- **URL:** `/{baseURL}/{apiVersion}/agentic`
- **Headers:**
  - `Content-Type`: MUST be `application/json`.
  - `Authorization`: Optional, depending on your agent authentication strategy.
- **Body:** The request body follows the standard action format but with a specific action name and payload structure:

```json
{
  "action": "agent",
  "payload": {
    "input": "Your natural language request or instruction here",
    "organization_id": "uuid-of-current-organization",
    "user_id": "uuid-of-current-user"
  }
}
```

- **`action`**: MUST be `"agent"` for agentic endpoint requests.
- **`payload.input`**: A string containing the natural language input for the agent to process.
- **`payload.organization_id`**: UUID of the organization context for the request.
- **`payload.user_id`**: UUID of the user making the request.

**Example `curl` Request:**

```bash
curl -X POST \
  localhost:8000/Delta/api/v1/services/agentic \
  -H "Content-Type: application/json" \
  -d '{
        "action": "agent",
        "payload": {
          "input": "Get all users and create a summary report",
          "organization_id": "123e4567-e89b-12d3-a456-426614174000",
          "user_id": "987fcdeb-51a2-4bcd-9876-543210fedcba"
        }
      }'
```

#### 3.8.3. Response

The server responds with the standard JSON structure:

**Example Success Response:**

```json
{
  "status": true,
  "message": "Agent response",
  "data": {
    "response": "I found 25 users in the system. Here's a summary: 15 active users, 8 pending users, and 2 inactive users. The most recent user joined yesterday."
  }
}
```

**Example Error Responses:**

```json
{
  "status": false,
  "message": "Agentic handler not configured",
  "data": {}
}
```

```json
{
  "status": false,
  "message": "Input required in payload",
  "data": {}
}
```

```json
{
  "status": false,
  "message": "Agent processing error",
  "data": {
    "error": "Failed to connect to AI service"
  }
}
```

#### 3.8.4. Use Cases

The agentic endpoint is particularly useful for:

- **AI Assistant Integration**: Connect language models to your services for natural language queries
- **Automated Workflows**: Enable AI agents to perform complex multi-step operations
- **Chat Interfaces**: Build conversational interfaces that can interact with your backend services
- **Data Analysis**: Allow AI to query and analyze data using natural language requests
- **Content Generation**: Enable AI to generate content based on your service data

### 3.9. RPC Utilities

The REST-RPC framework provides a set of utilities for direct programmatic interaction with services, bypassing the HTTP layer. These utilities are particularly useful for internal service communication, testing, and agent-based interactions.

#### 3.9.1. Basic Usage

```typescript
import { createRPC } from '@nile-squad/nile/rest-rpc/rpc-utils';

// Create RPC interface
const rpc = createRPC({
  resultsMode: 'data', // 'data' | 'json'
  agentMode: false     // Enable automatic agent authentication
});

// Discover services
const services = await rpc.getServices();

// Explore a service
const serviceDetails = await rpc.getServiceDetails('users');

// Explore an action
const actionDetails = await rpc.getActionDetails('users', 'create');

// Execute an action
const result = await rpc.executeServiceAction('users', {
  action: 'create',
  payload: {
    name: 'John Doe',
    email: 'john@example.com'
  }
});
```

#### 3.9.2. Configuration Options

- **`resultsMode`**: Controls the format of returned results
  - `'data'`: Returns `SafeResult<T>` objects with success/error handling
  - `'json'`: Returns JSON strings matching the HTTP response format

- **`agentMode`**: When enabled, automatically attaches agent authentication tokens to requests for protected actions

#### 3.9.3. Agent Authentication

The RPC utilities include built-in support for agent authentication:

```typescript
// Enable agent mode for automatic authentication
const agentRpc = createRPC({ agentMode: true });

// Agent authentication is automatically handled
const result = await agentRpc.executeServiceAction('protected-service', {
  action: 'sensitiveAction',
  payload: { data: 'value' }
});
```

#### 3.9.4. Action-Level Agent Control

Actions can be configured to control agent access using the `agentic` flag:

```typescript
const action: Action = {
  name: 'deleteAll',
  agentic: false, // Prevents agent execution
  handler: async (payload) => {
    // Destructive operation - agents not allowed
  }
};
```

- **`agentic: true`**: Explicitly allows agent execution
- **`agentic: false`**: Explicitly prevents agent execution  
- **`agentic: undefined`**: Allows agent execution (default behavior)

#### 3.9.5. Direct Service Integration

For internal service communication, you can use RPC utilities without HTTP overhead:

```typescript
// In a microservice
import { createRPC } from '@nile-squad/nile/rest-rpc/rpc-utils';

class UserService {
  private rpc = createRPC({ resultsMode: 'data' });

  async createUserProfile(userData: any) {
    // Call another service directly
    const result = await this.rpc.executeServiceAction('profiles', {
      action: 'create',
      payload: userData
    });

    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.message);
    }
  }
}
```

### 3.10. Pagination & Filtering

Clients that need to page through large result sets or apply filters include pagination and filtering parameters inside the `payload` of their action invocation.

#### Conventions

Inside the `payload`:

- **`page`**: The 1‑based page number to retrieve.
- **`perPage`**: The number of items per page.
- **`filters`**: An object whose keys are field names and values are filter criteria (e.g., `{ "status": "active" }`).
- **`sort`** (optional): An array of `{ field: string, direction: "asc" | "desc" }` objects.

#### Example

```json
{
  "action": "getAll",
  "payload": {
    "page": 2,
    "perPage": 25,
    "filters": {
      "user_id": "some_user_uuid",
      "status": "completed"
    },
    "sort": [
      { "field": "created_at", "direction": "desc" }
    ]
  }
}
```

The response’s `data` field will include:

- **`items`**: An array of the requested resources.
- **`meta`**: An object with `totalItems`, `totalPages`, `currentPage`, and `perPage`.

```json
{
  "status": true,
  "message": "Fetched page 2 of todos.",
  "data": {
    "items": [ /* … */ ],
    "meta": {
      "totalItems": 102,
      "totalPages": 5,
      "currentPage": 2,
      "perPage": 25
    }
  }
}
```

### 3.11. Hooks System

Hooks let you run other actions before and after your main action. Think of them as a assembly line where each step can transform your data.

#### 3.9.1. How Hooks Work

- **Hook = Another Action**: Every hook is just a reference to another action you've already defined
- **Before Hooks**: Run before your main action (like validation, data cleanup)
- **After Hooks**: Run after your main action (like logging, sending emails)
- **Data Flows Forward**: Each successful hook passes its output to the next hook

#### 3.9.2. Hook Failure Behavior

**Critical Hooks (`canFail: false`)**

- Must succeed or the whole action fails
- Use for validation, security checks, required setup

**Optional Hooks (`canFail: true`)**  

- If they fail, just skip them and continue
- Next hook gets the last successful output (failed hook output is thrown away)
- Use for nice-to-have features like notifications, logging

#### 3.9.3. Pipeline Results

**`pipeline: false` (default)**

- Returns only the final result
- Hides all the hook execution details

**`pipeline: true`**

- Returns the final result PLUS execution logs
- Shows which hooks ran, what they received/returned
- Useful for debugging and audit trails

#### 3.9.4. Simple Example

```json
{
  "name": "createUser",
  "hooks": {
    "before": [
      { "name": "validateEmail", "canFail": false },    // Must work
      { "name": "enrichProfile", "canFail": true }      // Nice to have
    ],
    "after": [
      { "name": "sendWelcomeEmail", "canFail": true }   // Don't fail if email breaks
    ]
  },
  "result": { "pipeline": true }  // Show me the execution details
}
```

**What happens:**

1. `validateEmail` runs first - if it fails, everything stops
2. `enrichProfile` tries to run - if it fails, we continue with `validateEmail`'s output  
3. `createUser` (main action) runs with the latest good data
4. `sendWelcomeEmail` tries to run - if it fails, we still return success

#### 3.9.5. Data Flow

```
Input: { email: "john@example.com" }
├─ validateEmail ✓ → { email: "john@example.com", valid: true }
├─ enrichProfile ✗ → [FAILED, output thrown away]
├─ createUser gets → { email: "john@example.com", valid: true }  // From validateEmail
└─ sendWelcomeEmail ✓ → User created successfully
```

**Key Point**: When a hook fails, the pipeline "jumps over" it like it never existed.

This design enables building complex workflows from simple, testable, and reusable action components.

### 3.12. Versioning

By default, adding new actions or services under the same API version (e.g., `v1`) is non‑breaking. If a breaking change is ever required—or you want to run two schemas side‑by‑side—introduce a new version segment and expose the updated surface there.

#### Strategy

1. **Non‑breaking additions** (e.g., new actions) go into the current version.
2. **Breaking changes** (e.g., renaming payload fields, changing response shapes) require a new version, e.g., `/v2`.
3. Both versions remain available in parallel until clients migrate.

#### Example

- **v1 endpoint:**

  ```curl
  POST /api/v1/services/todos
  ```

- **v2 endpoint with changed `dueDate` field name:**

  ```curl
  POST /api/v2/services/todos
  ```

Clients choose which version to call via the URL segment; no headers or query‑params are used.

## 18. When to Use This Architecture?

**Consider To Use This For:**

- Microservices with complex business logic
- APIs requiring strong validation and documentation
- Systems needing flexible authentication per operation
- Applications with needs beyond database-driven CRUD operations
- Internal APIs where explicit action naming improves clarity
- AI or agent driven development and spec driven development workflows
- **Natural language interfaces and AI integration**
- **Internal service-to-service communication with RPC utilities**
- **Automated workflows and agent-based operations**
- **Conversational APIs and chatbot backends**

**Consider Alternatives When:**

- Building simple REST APIs with standard CRUD operations
- Public APIs where REST conventions are expected
- Systems requiring HTTP method-based caching strategies
- Applications needing hypermedia-driven discovery (HATEOAS)

However otherwise this implementation provides a robust, scalable foundation for service-oriented APIs with excellent developer experience through comprehensive documentation and validation and no surprises.

## 19. Complete Example: AI-Powered User Management

Here's a comprehensive example showing how to use the agentic endpoint and RPC utilities together:

### 5.1. Server Configuration

```typescript
import { createRestRPCServer, createRPC } from '@nile-squad/nile';

// Configure server with agentic capabilities
const config = {
  serverName: 'Delta Business Platform',
  baseUrl: '/api',
  apiVersion: 'v1',
  
  // Configurable authentication
  auth: {
    method: 'payload',  // 'payload' | 'cookie' | 'header'
    secret: 'your-secret-key',
    cookieName: 'auth_token',     // Optional: custom cookie name
    headerName: 'authorization'   // Optional: custom header name
  },
  
  services: {
    users: {
      create: { handler: createUser, validation: userSchema },
      getAll: { handler: getAllUsers },
      delete: { handler: deleteUser, agentic: false } // Prevent agent deletion
    }
  },
  agenticConfig: {
    handler: async (input: string) => {
      const rpc = createRPC({ agentMode: true });
      
      // Simple AI logic (in practice, use a proper LLM)
      if (input.includes('create user')) {
        const result = await rpc.executeServiceAction('users', {
          action: 'create',
          payload: { name: 'AI Generated User', email: 'ai@example.com' }
        });
        return `User created: ${JSON.stringify(result.data)}`;
      }
      
      if (input.includes('list users')) {
        const result = await rpc.executeServiceAction('users', {
          action: 'getAll',
          payload: {}
        });
        return `Found ${result.data.length} users`;
      }
      
      return 'I can help you create or list users. Try: "create user" or "list users"';
    }
  }
};

createRestRPCServer(config);
```

### 5.2. Client Usage Examples

**Traditional API Call:**

```bash
curl -X POST localhost:3000/api/v1/services/users \
  -H "Content-Type: application/json" \
  -d '{"action": "create", "payload": {"name": "John", "email": "john@example.com"}}'
```

**Agentic Interface:**

```bash
curl -X POST localhost:3000/api/v1/agentic \
  -H "Content-Type: application/json" \
  -d '{"action": "agent", "payload": {"input": "Please create a new user named Alice with email alice@example.com"}}'
```

**RPC Utilities (Internal):**

```typescript
const rpc = createRPC({ resultsMode: 'data' });

// Direct service call without HTTP
const users = await rpc.executeServiceAction('users', {
  action: 'getAll',
  payload: { filters: { active: true } }
});

if (users.success) {
  console.log('Active users:', users.data);
}
```

This example demonstrates how the three interaction methods (traditional REST-RPC, agentic endpoint, and RPC utilities) can work together to provide a flexible and powerful API architecture.

## 20. Frequently Asked Questions

If you still have questions or need more explanations, you can check out some I have answered already, see [commonly asked questions](./rest-rpc.spec.faq.md)

## 21. Implementation Notes

### Language Agnostic Design

This specification is designed to be implemented in any programming language or framework. The core principles and patterns can be adapted to:

- **Backend Frameworks**: Express.js, FastAPI, Spring Boot, ASP.NET Core, etc.
- **Languages**: TypeScript/JavaScript, Python, Java, C#, Go, Rust, etc.
- **Protocols**: HTTP REST, WebSocket, gRPC, GraphQL, etc.
- **Databases**: PostgreSQL, MySQL, MongoDB, DynamoDB, etc.

### Reference Implementation

Currently, this specification is implemented in the `Nile` framework (`@nile-squad/nile` package) as a TypeScript-first solution, but the architectural patterns and philosophical principles are universally applicable.

### Evolution and Feedback

This specification is experimental and subject to evolution based on community feedback and real-world usage patterns. Contributions, criticism, and feedback are welcome.

**Author:** [Hussein Kizz](https://github.com/Hussseinkizz) at Nile Squad Labz

*This specification provides a philosophical and methodological foundation that can be adapted to various implementation contexts. Contributions and feedback are welcome.*
