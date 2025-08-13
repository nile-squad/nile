# REST-RPC Specification

**Version:** 1.0  
**Date:** August 13, 2025  
**Author:** Hussein Kizz

## 1. Overview

REST-RPC is a service-oriented architecture that combines REST discovery with RPC execution. It provides:

- Self-documenting APIs through GET endpoint exploration
- Action-based operations via standardized POST requests
- Hook-driven workflows for complex business logic composition
- Multi-modal execution (HTTP, RPC utilities, and agentic interfaces)
- Database model automation with generated CRUD operations
- Agent integration for AI-driven interactions

## 2. Design Principles

**Service-Action Oriented Architecture:**
Business operations map naturally to named actions within services, eliminating HTTP method confusion for complex operations and enabling sophisticated workflows through hook composition.

**Dual-Method Approach:**
GET requests for API exploration and discovery, POST requests for all action execution, with consistent response format across all endpoints.

**Self-Documenting Nature:**
No external documentation tools required. APIs can be explored programmatically with simple HTTP clients, providing real-time schema introspection and validation.

## 3. Protocol Specification

### 3.1 Standard Response Format

All REST-RPC responses follow this consistent structure:

```json
{
  "status": boolean,
  "message": string,
  "data": any | null
}
```

- **`status`**: `true` for success, `false` for errors
- **`message`**: Human-readable description of the outcome
- **`data`**: Response payload on success, error details or `null` on failure

### 3.2 URL Structure

All endpoints follow the pattern:

```
/{baseURL}/{apiVersion}/services[/{serviceName}[/{actionName}]]
```

- **`baseURL`**: API base path (e.g., `api`, `delta/api`)
- **`apiVersion`**: Version identifier (e.g., `v1`, `v2`)
- **`serviceName`**: Target service name (URL-safe format)
- **`actionName`**: Specific action name (URL-safe format)

## 4. Core Endpoints

### 4.1 Service Discovery

**Endpoint:** `GET /{baseURL}/{apiVersion}/services`

Lists all available services in the system.

**Request Example:**
```bash
curl http://localhost:8000/delta/api/v1/services
```

**Response Example:**
```json
{
  "status": true,
  "message": "List of all available services on Delta Server.",
  "data": [
    "users",
    "todos", 
    "analytics"
  ]
}
```

### 4.2 Service Exploration

**Endpoint:** `GET /{baseURL}/{apiVersion}/services/{serviceName}`

Returns detailed information about a specific service and its available actions.

**Request Example:**
```bash
curl http://localhost:8000/delta/api/v1/services/users
```

**Response Example:**
```json
{
  "status": true,
  "message": "Service Details",
  "data": {
    "name": "users",
    "description": "User management service",
    "availableActions": [
      "create",
      "getAll", 
      "getOne",
      "update",
      "delete"
    ]
  }
}
```

### 4.3 Action Exploration

**Endpoint:** `GET /{baseURL}/{apiVersion}/services/{serviceName}/{actionName}`

Returns detailed schema and configuration for a specific action.

**Request Example:**
```bash
curl http://localhost:8000/delta/api/v1/services/users/create
```

**Response Example:**
```json
{
  "status": true,
  "message": "Action Details",
  "data": {
    "name": "create",
    "description": "Create a new user record",
    "isProtected": true,
    "isSpecial": null,
    "validation": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "name": { "type": "string", "minLength": 2 },
        "email": { "type": "string", "format": "email" }
      },
      "required": ["name", "email"]
    },
    "hooks": {
      "before": [
        { "name": "validateEmail", "canFail": false },
        { "name": "enrichProfile", "canFail": true }
      ],
      "after": [
        { "name": "auditLog", "canFail": false }
      ]
    },
    "pipeline": true
  }
}
```

**Action Properties:**
- **`isProtected`**: Requires authentication when `true`
- **`isSpecial`**: Special content type handling configuration
- **`validation`**: JSON Schema for payload validation
- **`hooks`**: Before/after action processing configuration
- **`pipeline`**: When `true`, returns execution logs with results

### 4.4 Schema Export

**Endpoint:** `GET /{baseURL}/{apiVersion}/services/schema`

Returns the complete API schema for all services and actions.

**Request Example:**
```bash
curl http://localhost:8000/delta/api/v1/services/schema
```

**Response Example:**
```json
{
  "status": true,
  "message": "Delta Server Services actions zod Schemas",
  "data": [
    {
      "users": [
        {
          "name": "create",
          "description": "Create a new user record",
          "validation": {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "properties": {
              "name": { "type": "string", "minLength": 2 },
              "email": { "type": "string", "format": "email" }
            },
            "required": ["name", "email"]
          },
          "hooks": {
            "before": [
              { "name": "validateEmail", "canFail": false }
            ],
            "after": [
              { "name": "auditLog", "canFail": false }
            ]
          },
          "pipeline": true
        }
      ]
    }
  ]
}
```

## 5. Action Execution

### 5.1 Standard Action Invocation

**Endpoint:** `POST /{baseURL}/{apiVersion}/services/{serviceName}`

Executes a named action on the specified service.

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>  # If action is protected
```

**Request Body Format:**
```json
{
  "action": "actionName",
  "payload": {
    "param1": "value1",
    "param2": "value2"
  }
}
```

**Example Request:**
```bash
curl -X POST http://localhost:8000/delta/api/v1/services/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "action": "create",
    "payload": {
      "name": "John Doe",
      "email": "john@example.com"
    }
  }'
```

**Success Response:**
```json
{
  "status": true,
  "message": "User created successfully",
  "data": {
    "id": "user-uuid-123",
    "name": "John Doe",
    "email": "john@example.com",
    "created_at": "2025-08-13T10:30:00Z"
  }
}
```

### 5.2 Form Data Support

For file uploads and multipart requests:

```bash
curl -X POST http://localhost:8000/delta/api/v1/services/files \
  -H "Authorization: Bearer <token>" \
  -F "action=upload" \
  -F "file=@document.pdf" \
  -F "category=documents"
```

**Content Types Supported:**
- `application/json` (primary)
- `multipart/form-data` (for file uploads)
- `application/x-www-form-urlencoded` (for form submissions)

### 5.3 Validation Handling

**Validation Error Response:**
```json
{
  "status": false,
  "message": "Invalid request format",
  "data": {
    "missing": ["email"],
    "invalid": {
      "name": "must be at least 2 characters long"
    }
  }
}
```

## 6. Authentication

Protected actions require JWT Bearer token authentication.

**Authorization Header:**
```
Authorization: Bearer <jwt_token>
```

**Authentication Flow:**
1. Obtain token from authentication service (typically has `login`, `signup`, `refreshToken` actions)
2. Include Bearer token in protected action requests
3. Server validates token against configured secret

**Unauthorized Response:**
```json
{
  "status": false,
  "message": "Unauthorized",
  "data": {}
}
```

## 7. Hook System

Hooks enable composable workflows by executing additional actions before and after the main action.

**Hook Configuration:**
```json
{
  "hooks": {
    "before": [
      { "name": "validateInput", "canFail": false },
      { "name": "enrichData", "canFail": true }
    ],
    "after": [
      { "name": "auditLog", "canFail": false },
      { "name": "sendNotification", "canFail": true }
    ]
  },
  "result": { "pipeline": true }
}
```

**Execution Flow:**
1. **Before Hooks** execute sequentially, passing output to next hook
2. **Main Action** receives final successful before hook output
3. **After Hooks** execute with main action output
4. **Final Result** returned (with or without pipeline details)

**Failure Handling:**
- **Critical Hooks** (`canFail: false`): Failure stops entire workflow
- **Optional Hooks** (`canFail: true`): Failure is logged but workflow continues
- Failed hooks are skipped in the data flow chain

**Pipeline Response (when `pipeline: true`):**
```json
{
  "status": true,
  "message": "User created successfully",
  "data": {
    "result": {
      "id": "user-uuid-123",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "pipeline": {
      "state": {
        "validationPassed": true,
        "profileEnriched": false
      },
      "log": {
        "before": [
          {
            "name": "validateEmail",
            "input": { "email": "john@example.com" },
            "output": { "email": "john@example.com", "valid": true },
            "passed": true
          }
        ],
        "after": [
          {
            "name": "auditLog",
            "input": { "user": { "id": "user-uuid-123" } },
            "output": { "logged": true },
            "passed": true
          }
        ]
      }
    }
  }
}
```

**Hook Requirements:**
- Every hook must reference an existing action by name
- Hooks share the same validation and execution model as regular actions
- Context and state can be shared between hooks via the hook context object

## 8. Agentic Interface

**Endpoint:** `POST /{baseURL}/{apiVersion}/services/agentic`

Provides natural language interface for AI agents and automated systems.

**Request Format:**
```json
{
  "action": "agent",
  "payload": {
    "input": "Create a user named John with email john@example.com",
    "company_id": "uuid",
    "user_id": "uuid", 
    "app_name": "string",
    "app_id": "uuid"
  }
}
```

**Request Example:**
```bash
curl -X POST http://localhost:8000/delta/api/v1/services/agentic \
  -H "Content-Type: application/json" \
  -d '{
    "action": "agent", 
    "payload": {
      "input": "Get all users and create a summary report"
    }
  }'
```

**Success Response:**
```json
{
  "status": true,
  "message": "Agent response",
  "data": {
    "response": "Found 25 users in the system. Summary: 15 active, 8 pending, 2 inactive."
  }
}
```

**Error Responses:**
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

**Configuration:**
```typescript
const config = {
  agenticConfig: {
    handler: async (payload) => {
      const { input, company_id, user_id, app_name, app_id } = payload;
      // AI processing logic
      return "Processed request successfully";
    }
  }
};
```

## 9. RPC Utilities

Direct programmatic service interaction without HTTP overhead.

**Basic Usage:**
```typescript
import { createRPC } from '@nile-squad/nile/rest-rpc/rpc-utils';

const rpc = createRPC({
  resultsMode: 'data',  // 'data' | 'json'
  agentMode: false      // Enable automatic agent authentication
});

// Service discovery
const services = await rpc.getServices();

// Service exploration  
const serviceDetails = await rpc.getServiceDetails('users');

// Action introspection
const actionDetails = await rpc.getActionDetails('users', 'create');

// Action execution
const result = await rpc.executeServiceAction('users', {
  action: 'create',
  payload: {
    name: 'John Doe',
    email: 'john@example.com'
  }
});
```

**Result Modes:**
- **`'data'`**: Returns `SafeResult<T>` objects with success/error handling
- **`'json'`**: Returns JSON strings matching HTTP response format

**Agent Mode:**
```typescript
// Enable automatic agent authentication
const agentRpc = createRPC({ agentMode: true });

// Agent authentication handled automatically for protected actions
const result = await agentRpc.executeServiceAction('protected-service', {
  action: 'sensitiveAction',
  payload: { data: 'value' }
});
```

## 10. Database Model System

Automatic CRUD operation generation from database schemas.

**Service Configuration:**
```typescript
{
  autoService: true,
  subs: [
    {
      name: "users",
      description: "User management service",
      tableName: "users",
      idName: "id",
      protectedActions: ["delete", "deleteAll"],
      validation: customValidationSchema, // Optional override
      actions: [...customActions] // Additional custom actions
    }
  ]
}
```

**Generated Actions:**
- **`create`**: Insert new records with validation
- **`getAll`**: Retrieve all records with pagination support
- **`getOne`**: Find single record by ID or field value
- **`update`**: Update existing records with merge logic
- **`delete`**: Remove single record by ID
- **`deleteAll`**: Remove multiple records (typically protected)
- **`getMany`**: Retrieve multiple records with basic filtering
- **`getManyWith`**: Advanced filtering, sorting, and pagination
- **`getOneWith`**: Multi-field filtering for single record
- **`getOneWithStrictly`**: Strict field matching
- **`getOneWithRelations`**: Include related data via joins

## 11. Pagination & Filtering

Include pagination and filtering parameters in action payloads for data retrieval operations.

**Request Format:**
```json
{
  "action": "getAll",
  "payload": {
    "page": 2,
    "perPage": 25, 
    "filters": {
      "status": "active",
      "created_after": "2025-01-01"
    },
    "sort": [
      { "field": "created_at", "direction": "desc" },
      { "field": "name", "direction": "asc" }
    ]
  }
}
```

**Response Format:**
```json
{
  "status": true,
  "message": "Retrieved page 2 of users",
  "data": {
    "items": [
      { "id": "1", "name": "Alice", "status": "active" },
      { "id": "2", "name": "Bob", "status": "active" }
    ],
    "meta": {
      "totalItems": 102,
      "totalPages": 5,
      "currentPage": 2,
      "perPage": 25
    }
  }
}
```

**Filtering Conventions:**
- **`page`**: 1-based page number
- **`perPage`**: Items per page (default/max limits configurable)
- **`filters`**: Object with field-value pairs for equality filtering
- **`sort`**: Array of sort specifications with field and direction

## 12. Implementation Example

**Complete Service Definition:**
```typescript
import { useRestRPC } from '@nile-squad/nile';

const config = {
  serverName: 'Business API',
  baseUrl: 'api',
  apiVersion: 'v1',
  authSecret: process.env.AUTH_SECRET,
  services: [
    {
      name: 'users',
      description: 'User management service',
      actions: [
        {
          name: 'create',
          description: 'Create new user account',
          isProtected: true,
          validation: {
            zodSchema: z.object({
              name: z.string().min(2),
              email: z.string().email()
            })
          },
          hooks: {
            before: [
              { name: 'validateEmail', canFail: false }
            ],
            after: [
              { name: 'auditLog', canFail: false }
            ]
          },
          result: { pipeline: true },
          handler: async (payload, context) => {
            return Ok({ userId: 'new-uuid' });
          }
        }
      ]
    }
  ],
  agenticConfig: {
    handler: async (payload) => {
      return 'Processed request successfully';
    }
  }
};

const app = useRestRPC(config);
```

## 13. When to Use REST-RPC

**Ideal Use Cases:**
- Complex business logic requiring multi-step workflows
- Internal APIs with consistent communication patterns
- Database-driven API generation with minimal code
- Systems needing flexible authentication per operation
- Applications requiring self-documenting capabilities

**Consider Alternatives For:**
- Simple CRUD APIs where traditional REST is sufficient
- Public APIs where REST conventions are expected
- Systems requiring HTTP method-based caching strategies
- High-performance requirements where RPC overhead is significant

## 14. References

**Frequently Asked Questions:** [rest-rpc.spec.faq.md](./rest-rpc.spec.faq.md)

**Implementation:** Available in the Nile framework (`@nile-squad/nile`)

**License:** MIT License - Open source and production-ready

**Author:** [Hussein Kizz](https://github.com/Hussseinkizz) at Nile Squad Labz

*This specification reflects the current implementation and is subject to evolution. Contributions and feedback are welcome.*