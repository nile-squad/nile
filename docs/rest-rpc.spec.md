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

**Documentation Navigation:**  
This document provides a protocol-level specification. For implementation details on specific features, refer to:
- [Action Hooks](./action-hooks.md) - Global hooks for authorization and auditing
- [Action-Level Hooks](./action-level-hooks.md) - Per-action data transformations
- [Authentication](./auth.md) - Multi-mode auth and context injection
- [Database Models](./create-models.md) - Auto-generated CRUD services
- [File Upload Handling](./uploads-handling.md) - Multipart/form-data upload configuration and security
- [Agentic System](./agentic.spec.md) - AI integration patterns
- See [Section 20](#20-related-documentation) for complete documentation index

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

**See Also:** For information on how hooks can transform action execution, see [Action Hook System](./action-hooks.md) and [Action-Level Hooks](./action-level-hooks.md).

## 5. Hook System Architecture

The hook system architecture (workflow composition, data flow strategy, error handling philosophy, and pipeline visibility) is documented in detail in the [Action Hook System Documentation](./action-hooks.md#3-hook-system-architecture).

For action-level hooks (per-action data pipeline transformations), see [Action-Level Hooks Documentation](./action-level-hooks.md).

## 6. Agent Integration

The agentic system provides conversational access to backend services with natural language interfaces and automated authentication. For complete details on agent integration patterns, authentication strategies, and use cases, see [Agentic System Specification](./agentic.spec.md).

**Quick Reference:**
- **Endpoint:** `POST /services/agentic`
- **Agent Mode:** Automatic authentication token attachment with audit trail
- **Action Control:** Use `agentic: false` to prevent agent execution for specific actions

## 7. Database Model System

Nile automatically generates CRUD services from database schemas with built-in validation and error handling. For complete details on database models, auto-generated operations, and validation strategies, see [Database Models Documentation](./create-models.md).

**Quick Reference:**
- **Auto-Generated CRUD:** create, getAll, getOne, update, delete, getMany, getEvery, getManyWith, getOneWith, getOneWithRelations, deleteAll
- **Configuration:** Set `autoService: true` in service definition
- **Validation:** Auto-inferred from database schema or custom validation schemas

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

Nile implements a security-by-default architecture where all actions are protected by default unless explicitly marked as public. For complete details on authentication modes, context injection, and permission strategies, see [Authentication Documentation](./auth.md).

**Quick Reference:**
- **Security-by-Default:** All actions require authentication unless `isProtected: false` or listed in `publicActions`
- **Multi-Mode Auth:** Better Auth Session (cookies), JWT Bearer tokens, Agent authentication
- **Context Injection:** Automatic `user_id` and `organization_id` injection from authenticated user
- **Organization Isolation:** All data automatically scoped to user's organization

## 10. Action Hook System (Global Action Hooks)

Global action hooks provide cross-cutting concerns like authorization, rate limiting, and audit logging that run before and/or after every action across all services. For complete details on hook types, execution flow, and implementation patterns, see [Action Hook System Documentation](./action-hooks.md).

**Quick Reference:**
- **Hook Types:** `onBeforeActionHandler` (authorization) and `onAfterActionHandler` (auditing)
- **Execution Flow:** [Request] → [Authentication] → [onBeforeActionHandler] → [Payload Validation] → [Action Handler] → [onAfterActionHandler] → [Response]
- **Return Type:** Must return `Ok(data, message?)` or `safeError(message, error_id, extra?)`
- **Configuration:** Set in server config (`onBeforeActionHandler`, `onAfterActionHandler`)

**Note:** For action-level hooks (data pipeline transformations within specific actions), see [Action-Level Hooks Documentation](./action-level-hooks.md).

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

**See Also:** For complete details on auto-generated CRUD actions, database schemas, and validation strategies, see [Database Models Documentation](./create-models.md).

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

When the client's request payload fails validation:

- **`status`**: `false`
- **`message`**: `invalid request format`
- **`data`**: An object detailing any missing or malformed fields.
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

### 3.6. File Uploads

Nile provides comprehensive support for handling multipart/form-data file uploads with configurable validation, size limits, and security controls.

For complete details on file upload configuration, validation strategies, security best practices, and handler implementation, see [File Upload Handling Documentation](./uploads-handling.md).

**Quick Reference:**

- **Payload Structure:** Always uses structured mode - separates `{ fields: {...}, files: {...} }`
- **Array Aggregation:** Duplicate keys automatically become arrays
- **Configuration:** `uploads` block in server config with `limits`, `allow`, and `enforceContentType` options
- **6-Layer Validation:** Filename length, zero-byte files, file count, individual file size, total size, allowlist
- **Content-Type Enforcement:** Actions must declare `isSpecial.contentType: 'multipart/form-data'` to receive file uploads
- **Client Support:** Works with browser FormData API, curl, and other HTTP clients

### 3.7. Schema Endpoint

For client-side type generation, tooling, or documentation, a single endpoint can be used to retrieve the entire API schema, including all services and their actions.

#### 3.7.1. Request

A `GET` request is made to the `/schema` endpoint.

`/{baseURL}/{apiVersion}/services/schema`

**Example:**

```bash
curl localhost:9000/testing/api/v1/services/schema
```

#### 3.7.2. Response

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

Nile provides a set of utilities for direct programmatic interaction with services, bypassing the HTTP layer. These utilities are particularly useful for internal service communication, testing, and agent-based interactions.

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

#### 3.11.1. How Hooks Work

- **Hook = Another Action**: Every hook is just a reference to another action you've already defined
- **Before Hooks**: Run before your main action (like validation, data cleanup)
- **After Hooks**: Run after your main action (like logging, sending emails)
- **Data Flows Forward**: Each successful hook passes its output to the next hook

#### 3.11.2. Hook Failure Behavior

**Critical Hooks (`canFail: false`)**

- Must succeed or the whole action fails
- Use for validation, security checks, required setup

**Optional Hooks (`canFail: true`)**  

- If they fail, just skip them and continue
- Next hook gets the last successful output (failed hook output is thrown away)
- Use for nice-to-have features like notifications, logging

#### 3.11.3. Pipeline Results

**`pipeline: false` (default)**

- Returns only the final result
- Hides all the hook execution details

**`pipeline: true`**

- Returns the final result PLUS execution logs
- Shows which hooks ran, what they received/returned
- Useful for debugging and audit trails

#### 3.11.4. Simple Example

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

#### 3.11.5. Data Flow

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

## 20. Related Documentation

This REST-RPC specification is part of a comprehensive documentation suite. For specific topics covered briefly in this document, see the following detailed guides:

### Hook Systems
- **[Action Hook System](./action-hooks.md)** - Global action hooks for cross-cutting concerns (authorization, auditing, rate limiting)
- **[Action-Level Hooks](./action-level-hooks.md)** - Per-action data pipeline transformations (before/after hooks)

### Core Features
- **[Authentication & Authorization](./auth.md)** - Multi-mode authentication, context injection, permission strategies
- **[Database Models](./create-models.md)** - Auto-generated CRUD services, validation strategies, database schemas
- **[Agentic System](./agentic.spec.md)** - Natural language interface, agent authentication, AI integration patterns
- **[File Upload Handling](./uploads-handling.md)** - Multipart/form-data uploads, validation, security best practices

### Architecture & Design
- **[Architecture Overview](./architecture.md)** - System architecture, component relationships, design decisions
- **[REST-RPC FAQ](./rest-rpc.spec.faq.md)** - Frequently asked questions about the REST-RPC protocol

### Implementation Guides
- **[Service Creation](./create-service.md)** - Creating custom services and actions
- **[Testing Guide](./testing.md)** - Testing strategies for services and hooks
- **[Deployment](./deployment.md)** - Production deployment patterns and best practices

## 21. Frequently Asked Questions

If you still have questions or need more explanations, you can check out some I have answered already, see [commonly asked questions](./rest-rpc.spec.faq.md)

## 22. Implementation Notes

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
