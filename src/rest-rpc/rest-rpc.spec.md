# REST-RPC Specification

**Version:** Draft v1
**Date:** July 26, 2025
**Author:** Hussein Kizz

---

## Summary

This specification outlines the REST-RPC architecture, covering the following key areas:

* **Introduction:** The core philosophy and goals of the REST-RPC pattern.
* **Core Concepts:** The main ideas behind the service-oriented and self-documenting architecture.
* **Protocol:** The technical details of the interaction model, broken down into:

  * **Service Discovery (`GET /.../services`)**
  * **Service Exploration (`GET /.../services/{serviceName}`)**
  * **Action Exploration (`GET /.../services/{serviceName}/{actionName}`)**
  * **Authentication**
  * **Action Invocation (`POST /.../services/{serviceName}`)**
  * **Schema Endpoint (`GET /.../services/schema`)**

## 1. Introduction

REST-RPC is a hybrid architecture borrowing from REST (Representational State Transfer) and RPC (Remote Procedure Call) architectural styles to enable stateless communication between microservices, systems, or servers and frontends. It is highly opinionated and follows a strict but predictable design with simple principles that are flexible enough to allow for any kind of scaling and complexity.

## 2. Core Concepts

At its core, REST-RPC is service and service-action oriented. It uses `GET` requests for discoverability or exploration of available services and `POST` requests to invoke actions on a given service.

All requests and responses follow the same predictable structure to reduce overhead in integration and interaction with the exposed services. Only the `GET` and `POST` HTTP methods are used; `PUT`, `PATCH`, `DELETE`, and other methods are not part of this specification.

* **`POST` requests** are used to execute actions and can accept payloads as `application/json`.
* **`GET` requests** are used to explore the API's available services and their structure, enabling a self-documenting behavior. This allows developers and even AI agents to learn the API on the fly using simple tools like `curl` or any other HTTP client, eliminating the need for external documentation tools like Swagger.

## 3. Protocol

### 3.1. Service Discovery

#### 3.1.1. Request

A `GET` request is made to the `/services` endpoint. The URL has a specific anatomy:

`/{baseURL}/{apiVersion}/services`

* **`baseURL`**: The base path for the API (e.g., `/api`, `/testing/api`).
* **`apiVersion`**: The version of the API (e.g., `v1`, `v2`).

**Example:**

```bash
curl localhost:9000/testing/api/v1/services
```

#### 3.1.2. Response

The server responds with a standard JSON object with the following keys:

* **`status`**: A boolean that is `true` on success and `false` on failure.
* **`message`**: A string containing a descriptive message about the outcome.
* **`data`**: On success, this holds an array of strings, where each string is an available service name. On failure, this is typically `null` or empty. It may optionally contain an object with an `error_id` for tracing purposes. The `error_id` is a unique 6-character code or a UUID.

**Example Success Response:**

```json
{
  "status": true,
  "message": "List of all available services on 3M Testing Server.",
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

* **`serviceName`**: The name of the service to explore (e.g., `todos`).

**Example:**

```bash
curl localhost:9000/testing/api/v1/services/todos
```

#### 3.2.2. Response

The server responds with the standard JSON structure. On success, the `data` object contains details about the requested service.

* **`name`**: The name of the service.
* **`description`**: A human-readable description of the service's purpose.
* **`availableActions`**: An array of strings, where each string is an action that can be invoked on this service.

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

* **`actionName`**: The name of the action to explore (e.g., `create`).

**Example:**

```bash
curl localhost:9000/testing/api/v1/services/todos/create
```

#### 3.3.2. Response

The server responds with the standard JSON structure. On success, the `data` object contains details about the requested action.

* **`name`**: The name of the action.
* **`description`**: A human-readable description of what the action does.
* **`isProtected`**: A boolean indicating whether the action requires authentication or special authorization to execute.
* **`validation`**: An object that describes the expected payload for the action. This schema should be consistent and clearly define what fields are required, their types, and any other constraints. While the example below uses JSON Schema, any consistent and descriptive format can be used.

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
    }
  }
}
```

### 3.4. Authentication

If an action is marked as protected (`"isProtected": true`), the client MUST include an `Authorization` header in the request. The most common method is using a Bearer token.

* **Header:** `Authorization: Bearer <token>`

Any other standard auth methods are also allowed. The Bearer token is only required if the action is protected, as seen during Action Exploration.

Tokens are typically obtained by interacting with a dedicated `auth` service, which would expose actions like `login`, `signup`, or `refreshToken`.

### 3.5. Action Invocation

To execute an action on a service, the client sends a `POST` request to the service's endpoint.

#### 3.5.1. Request

* **Method:** `POST`
* **URL:** `/{baseURL}/{apiVersion}/services/{serviceName}`
* **Headers:**

  * `Content-Type`: MUST be `application/json`.
  * `Authorization`: Required if the action is protected (e.g., `Bearer <token>`).
* **Body:** The request body is a JSON object containing the action to be executed and its corresponding payload.

```json
{
  "action": "actionName",
  "payload": {
    "param1": "value1",
    "param2": "value2"
  }
}
```

* **`action`**: The name of the action to invoke (e.g., `update`).
* **`payload`**: An object containing the data required for the action. The structure of this payload should match the validation schema discovered via Action Exploration.

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

* On success, the `data` field contains the result of the action. This could be the created or updated resource, a confirmation message, or be `null` if no specific data needs to be returned.
* On failure (e.g., validation error, unauthorized access), the `status` will be `false`, and the `message` will contain a descriptive error.

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

* **`status`**: `false`
* **`message`**: `invalid request format`
* **`data`**: An object detailing any missing or malformed fields.
* For `multipart/form-data` is also accepted on top of JSON, and with it still we pass `action` name and then `file` or `files` in form fields.
* Pagination and filtering that can be passed in payload.
* Versioning though not so much needed in this case since new actions can just be added into a services without removing old ones or breaking anything but for any thing a new version can be exposed under new version eg from v1 to v2 and both can be run in parallel yes.

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
        { "name": "greet", "description": "...", "validation": null }
      ]
    },
    {
      "todos": [
        {
          "name": "create",
          "description": "...",
          "validation": { "$schema": "...", "type": "object", "..." }
        },
        { "name": "getAll", "description": "...", "validation": null }
      ]
    }
  ]
}
```

### 3.7. Pagination & Filtering

Clients that need to page through large result sets or apply filters include pagination and filtering parameters inside the `payload` of their action invocation.

#### Conventions

Inside the `payload`:

* **`page`**: The 1‑based page number to retrieve.
* **`perPage`**: The number of items per page.
* **`filters`**: An object whose keys are field names and values are filter criteria (e.g., `{ "status": "active" }`).
* **`sort`** (optional): An array of `{ field: string, direction: "asc" | "desc" }` objects.

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

* **`items`**: An array of the requested resources.
* **`meta`**: An object with `totalItems`, `totalPages`, `currentPage`, and `perPage`.

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

### 3.8. Versioning

By default, adding new actions or services under the same API version (e.g., `v1`) is non‑breaking. If a breaking change is ever required—or you want to run two schemas side‑by‑side—introduce a new version segment and expose the updated surface there.

#### Strategy

1. **Non‑breaking additions** (e.g., new actions) go into the current version.
2. **Breaking changes** (e.g., renaming payload fields, changing response shapes) require a new version, e.g., `/v2`.
3. Both versions remain available in parallel until clients migrate.

#### Example

* **v1 endpoint:**

  ```
  POST /api/v1/services/todos
  ```
* **v2 endpoint with changed `dueDate` field name:**

  ```
  POST /api/v2/services/todos
  ```

Clients choose which version to call via the URL segment; no headers or query‑params are used.

---

## 4. When to Use This Architecture?

**Consider To Use This For:**

* Microservices with complex business logic
* APIs requiring strong validation and documentation
* Systems needing flexible authentication per operation
* Applications with needs beyond database-driven CRUD operations
* Internal APIs where explicit action naming improves clarity
* AI or agent driven development and spec driven development workflows

**Consider Alternatives When:**

* Building simple REST APIs with standard CRUD operations
* Public APIs where REST conventions are expected
* Systems requiring HTTP method-based caching strategies
* Applications needing hypermedia-driven discovery (HATEOAS)

However otherwise this implementation provides a robust, scalable foundation for service-oriented APIs with excellent developer experience through comprehensive documentation and validation and no surprises.

## 5. Frequently Asked Questions

If you still have questions or need more explanations, you can check out some I have answered already, see [commonly asked questions](./rest-rpc.spec.faq.md)

## 6. License & Contributing

This architecture can be implemented in any language following the same protocols. Currently, it is implemented in the `Nile` framework used internally at Nile Squad Labz under the `@nile-squad/nile` package. The idea is transferable and can also work with other protocols like WebSockets following the same principles.

But it should be also noted that this architecture is still experimental and subject to change. So contributions, criticism and feedback are welcome.

Created by [Hussein Kizz](https://github.com/Hussseinkizz) at Nile Squad Labz. Completely open source under MIT License and used in production.
