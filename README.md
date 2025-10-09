# 🌊 Nile

[![NPM Version](https://img.shields.io/npm/v/@nile-squad/nile.svg)](https://www.npmjs.com/package/@nile-squad/nile)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

**Nile is a TypeScript-first, service-oriented backend framework for building modern, AI-ready backends with simplest developer experience and speed.**

Nile was created at [Nile Squad Labz](https://nilesquad.com) to power our own B2B saas products and services, and is now open-sourced for the community.

And right now its not perfect yet, some things are still being figured out and docs may not be at par with the codebase. But it is already being used in production at Nile Squad Labz, and we are committed to making it better.

## Why Nile?

- **No MVC or REST clutter:** Nile uses a simple service-and-action model—just define your business logic as actions, and Nile exposes them everywhere you need.
- **Multi-protocol by default:** Call your actions via REST, WebSocket, in-process, or even through an AI agent endpoint—all with the same code.
- **Agentic/AI workflows built-in:** Nile is designed for agentic (AI-driven) automation and orchestration from day one.

**What makes Nile different?**

- Unified service/action model (no controllers, no routes, no REST duplication)
- Automatic API discovery and self-documenting endpoints
- Secure by default (all actions protected unless made public)
- Powerful global and per-action hooks
- Type-safe CRUD from your Drizzle DB schemas
- First-class support for agentic/AI endpoints

**Built with:**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?logo=zod&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle-C5F74F?logo=drizzle&logoColor=black)

- **Service-Oriented Architecture**: A clear and organized way to structure your backend logic.
- **Multi-Protocol Support**: Access your services via REST-RPC, WebSocket RPC, or direct in-process calls.
- **Automatic API Discovery**: Endpoints are self-documenting. You can programmatically explore services, actions, and their validation schemas.
- **Hook-Based System**: Intercept and modify behavior with `before` and `after` hooks at both global and action-specific levels.
- **Database Automation**: Automatically generate type-safe CRUD services from your Drizzle schemas.
- **Agentic by Design**: Built with agentic workflows in mind, supporting AI agents as first-class citizens.
- **Secure by Default**: All actions are protected unless you explicitly mark them as public.

## 📚 Documentation

For detailed guides and specifications, see the `docs` directory:

- **[Architecture](./docs/architecture.md)**
- **[REST-RPC Specification](./docs/rest-rpc.spec.md)**
- **[WebSocket RPC Specification](./docs/ws-rpc.spec.md)**
- **[Agentic System (AI endpoint)](./docs/agentic.spec.md)**
- **[Authentication Guide](./docs/auth.md)**
- **[Action Hooks](./docs/action-hooks.md)**
- **[Task Runner](./docs/task-runner.spec.md)**
- **[Meta System](./docs/meta-system.md)**
- **[Invoke Service Action](./docs/invoke-service-action.md)**


## Installation

To get started, add Nile to your project using your favorite package manager:

```bash
pnpm install @nile-squad/nile
```

## Quick Start

Here’s a minimal example of a Nile server. The `createRestRPC` function returns a standard Hono app instance, so you can apply any Hono middleware or functionality you need.

```typescript
import { createRestRPC } from '@nile-squad/nile/rest-rpc';
import { z } from 'zod';

const app = createRestRPC({
  port: 3000,
  services: [
    {
      name: 'accounts',
      description: 'User account management',
      actions: [
        {
          name: 'create',
          description: 'Create a new user account',
          // Actions are protected by default. We make this one public for the example.
          isProtected: false,
          handler: async (data, context) => {
            // Your business logic here
            return {
              status: true,
              message: 'Account created successfully',
              data: { id: '123', ...data }
            };
          },
          validation: {
            zodSchema: z.object({
              name: z.string(),
              email: z.string().email()
            })
          }
        }
      ]
    }
  ]
});

// Start the server (copy-paste ready)
app.listen(3000, () => {
  console.log('Nile server running on http://localhost:3000');
});
```

### Call Your Service (REST-RPC)

You can now POST to your service endpoint:

```bash
curl -X POST http://localhost:3000/services/accounts \
  -H "Content-Type: application/json" \
  -d '{
        "action": "create",
        "payload": {
          "name": "John Doe",
          "email": "john@example.com"
        }
      }'
```

### Call via Agentic (AI) Endpoint

Nile exposes a special `POST /agentic` endpoint for AI agents and automation.

**Request Example:**

```bash
curl -X POST http://localhost:3000/agentic \
  -H "Content-Type: application/json" \
  -d '{
        "input": "Create a new user named John Doe with email john@example.com"
      }'
```

**Response Example:**

```json
{
  "status": true,
  "message": "Account created successfully",
  "data": {
    "id": "123",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

## ✅ Project Status

Nile has been in development for over seven months and is actively used in production at Nile Squad Labz, boasting up to 90% test coverage.

However, it is an ongoing project and will continue to evolve. It is not yet recommended for production use for those uncomfortable with potential breaking changes or the need to consult the source code where documentation may be incomplete. The documentation will be steadily updated to fully cover all aspects of the framework.

> **See the Quick Start above for a minimal server setup and agentic endpoint usage.**

For more complex applications, define handlers in separate files to keep your codebase clean. See the docs for best practices.

## Core Concepts

Nile's architecture is based on a few core concepts. For a deeper dive, please refer to the detailed documentation.

### Service-Action Model & API Discovery

Services are the building blocks of a Nile application. The REST-RPC protocol allows you to discover services and their actions via `GET` requests, making the API self-documenting.

- `GET /services`: Lists all available services.
- `GET /services/{serviceName}`: Shows details and available actions for a service.
- `GET /services/{serviceName}/{actionName}`: Provides the schema and hook information for a specific action.

- **[Read more about the Architecture](./docs/architecture.md)**

### Multi-Protocol & Agentic Interaction

Nile provides multiple ways to interact with your services, all sharing the same underlying logic.

- **REST-RPC**: A REST-like HTTP interface for discovery and execution.
- **WebSocket RPC**: A real-time interface with full parity to REST-RPC.
- **In-Process RPC**: Direct, type-safe function calls for internal service-to-service communication.
- **Agentic Endpoint**: Let AI agents or automation call your actions using natural language or structured prompts.

- **[REST-RPC Specification](./docs/rest-rpc.spec.md)**
- **[WebSocket RPC Specification](./docs/ws-rpc.spec.md)**
- **[Agentic System](./docs/agentic.spec.md)**

### Hooks

Hooks allow you to run your own code before or after an action is executed. They are a powerful way to handle cross-cutting concerns like authentication, logging, or data validation.

- **[Read more about Action Hooks](./docs/action-hooks.md)**

### Authentication

Nile is secure by default and supports multiple authentication strategies, including JWT and session-based authentication. You can protect individual actions or entire services.

- **[Read the Authentication Guide](./docs/auth.md)**

## Error Handling, Logging, and Handler Semantics

Nile encourages a consistent, robust pattern for error handling and logging in your service action handlers. This ensures reliability, observability, and a great developer experience.

### Handler Semantics

- **Signature:** Handlers are always async functions that receive a `data` argument (defaults to `{}`) and optionally a `context`.
- **Return Convention:** Use the `Ok(data)` helper to return successful results, and `safeError(message, error_id?)` for errors.
- **Short-Circuiting:** If any step fails, return early with a safe error.

### Error Pattern

- **Detection:** Use `isError(result)` to check if a function returned an error.
- **Reporting:** Use `safeError` to return a user-friendly error message, optionally including an error ID for traceability.
- **Propagation:** Always return errors in a consistent shape so clients and other services can handle them predictably.

### Logging

- **Logger:** Use `createLogger(context)` to create a logger instance for your handler or service.
- **Error Logging:** Log errors with structured data, including a message, the error object, and the function name. The logger returns an `error_id` for tracking.
- **Best Practice:** Log at the point of failure, and always include enough context for debugging.

#### Example: Robust Handler with Logging and Error Handling

```typescript
import { createLogger } from '@nile-squad/nile/logging';
import { isError, Ok, safeError } from '@nile-squad/nile/utils';
import type { ActionTypes } from '@nile-squad/nile/types';

export const getAllDashboardData: ActionTypes.ActionHandler = async (data = {}) => {
  const logger = createLogger('main');
  const dashboardData: Record<string, any> = {};

  const functions = [getAllProspects, getAllAppointments, getAllActivities];
  const results = await Promise.all(functions.map((fn) => fn()));

  for (let i = 0; i < functions.length; i++) {
    const fn = functions[i];
    const result = results[i];

    if (isError(result)) {
      const error_id = logger.error({
        message: `Error fetching data from ${fn.name}`,
        data: result,
        atFunction: 'getAllDashboardData',
      });
      return safeError(`Failed to fetch data from ${fn.name}`, error_id);
    }

    dashboardData[fn.name as string] = result.data;
  }

  return Ok(dashboardData);
};
```

- **Consistent:** All handlers should follow this pattern for reliability and maintainability.
- **Traceable:** Every error is logged with a unique ID, making it easy to trace issues in production.
- **Safe:** Only safe, user-friendly error messages are returned to clients.

## 📂 Project Structure

A well-structured Nile backend project follows a strict, layered architecture for clarity, maintainability, and scalability. Here’s a recommended layout, with each folder mapped to its architectural role:

```
backend/
├── db/
│   ├── schemas/         # Layer 4: Drizzle ORM table definitions (database schema)
│   ├── models/          # Layer 3: Data access layer (atomic CRUD, no business logic)
│   ├── seed/            # Database seeding scripts
│   ├── shapes/          # Data shape/type helpers
│   ├── types/           # DB-related TypeScript types
│   └── ...              # Other DB utilities
├── services/
│   ├── db/
│   │   ├── subs/        # Auto-generated CRUD service configs (SubService objects)
│   │   ├── [domain]/    # Custom business logic handlers (e.g., get-dashboard-data.ts)
│   │   ├── actions.ts   # Composes and exports all custom actions
│   │   └── index.ts     # Assembles the service for the engine
│   ├── accounts/        # Other domain services (business logic)
│   ├── messaging/
│   ├── storage/
│   └── ...
├── validations/         # Layer 5: Zod schemas, organized by domain
├── hooks/               # Cross-cutting hooks (e.g., access-control, messaging)
├── integrations/        # Third-party integrations (GCP, Resend, etc.)
├── utils/               # Utility functions (e.g., password hashing, config builders)
├── tests/               # Test files and setup
├── config.ts            # Project configuration
├── server.config.ts     # Nile server configuration
└── ...
```

**Layer Mapping:**

- **Layer 5: Validation** — `backend/validations/`
- **Layer 4: Schema** — `backend/db/schemas/`
- **Layer 3: Model** — `backend/db/models/`
- **Layer 2: Service** — `backend/services/` (with `subs/` for auto-CRUD, `[domain]/` for custom logic)
- **Layer 1: API** — Assembled in `backend/services/db/index.ts` and configured in `server.config.ts`

**Best Practices:**

- Keep each layer focused: no business logic in models, no DB access in services, no validation in handlers.
- Organize by domain for scalability (e.g., `accounts`, `messaging`, `complaints`).
- Use hooks and integrations for cross-cutting concerns and third-party APIs.
- Compose all actions and subs in a single service definition for the engine.

## Configuration & Service Patterns

### Configuration Files

A typical Nile backend project uses several configuration files to manage environment variables, server setup, database connections, and background tasks:

- **`.env`**
  - Stores environment-specific secrets and settings (e.g., database URLs, API keys, hostnames).
  - Loaded at startup; referenced by other config files.

- **`config.ts`**
  - Centralizes application configuration, reading from environment variables and providing typed constants for use throughout the backend.
  - Validates required environment variables at startup.
  - Example:

    ```typescript
    import 'dotenv/config';

    export const PORT = process.env.PORT ? Number(process.env.PORT) : 8000;
    export const MODE = process.env.MODE;
    export const AUTH_SECRET = process.env.AUTH_SECRET;
    export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [];

    if (!PORT || !MODE || !AUTH_SECRET) {
      throw new Error('Missing required environment variables');
    }
    ```

  - See [Backend Architecture](./docs/architecture.md#core-principles) for more.

- **`drizzle.config.ts`**
  - Configures the Drizzle ORM for database migrations and connections.
  - Used by the Drizzle CLI and application code to connect to the database.
  - Example:

    ```typescript
    import 'dotenv/config';
    import { defineConfig } from 'drizzle-kit';

    export default defineConfig({
      out: './drizzle',
      schema: ['./db/schema.ts'],
      dialect: 'postgresql',
      dbCredentials: { url: process.env.DB_URL },
    });
    ```

  - See [Database Layer](./docs/architecture.md#the-schema-layer) for more.

- **`index.ts`**
  - The main entrypoint for the backend server.
  - Loads environment variables, imports the server configuration, creates the Nile REST-RPC app, and starts the server.
  - Example:

    ```typescript
    import 'dotenv/config';
    import { serve } from '@hono/node-server';
    import { createRestRPC } from '@nile-squad/nile/rest-rpc';
    import { serverConfig } from './server.config';

    const app = createRestRPC(serverConfig);

    serve({
      port: Number(serverConfig.port),
      fetch: app.fetch,
      hostname: '0.0.0.0',
    });
    ```

  - See [API Layer](./docs/architecture.md#the-api-layer) for more.

- **`server.config.ts`**
  - Central configuration for the Nile REST-RPC engine/server.
  - Specifies server details, registers services and hooks, and provides database connection info.
  - Example:

    ```typescript
    import type { ServerConfig } from '@nile-squad/nile/rest-rpc';
    import { PORT, AUTH_SECRET, ALLOWED_ORIGINS } from './config';
    import { services } from './services';

    export const serverConfig: ServerConfig = {
      serverName: 'My Nile Server',
      port: String(PORT),
      allowedOrigins: ALLOWED_ORIGINS,
      
      // Configurable authentication
      auth: {
        method: 'payload',  // 'payload' | 'cookie' | 'header'
        secret: AUTH_SECRET,
        cookieName: 'auth_token',     // Optional: custom cookie name
        headerName: 'authorization'   // Optional: custom header name
      },
      
      services,
      // ...other config
    };
    ```

  - See [API Layer](./docs/architecture.md#the-api-layer) for more.

- **`tasks.config.ts`**
  - Defines and initializes background tasks and scheduled jobs.
  - Used by the task runner to register and execute background jobs, event handlers, and scheduled tasks.
  - Example:

    ```typescript
    import { createTaskRunner } from '@nile-squad/nile/task-runner';

    const runner = createTaskRunner({ dbPath: './tasks.db', timezone: 'UTC' });

    runner.createTask({
      id: 'daily-cleanup',
      type: 'schedule',
      preset: '@daily',
      handler: async () => { /* ... */ },
    });

    export { runner as taskRunner };
    ```

  - See [Task Runner](./docs/task-runner.spec.md) for more.

---

### Service Patterns: Subs and Actions

Nile exposes backend logic as API endpoints using two main patterns:

- **Subs (Auto-Generated CRUD Services)**
  - Configuration objects that instruct Nile to automatically generate standard CRUD endpoints for a database table.
  - Ideal for simple, standard CRUD operations where no custom business logic is needed.
  - Example:

    ```typescript
    // services/db/subs/users.ts
    import { z } from 'zod';

    export const usersSubs = [{
      name: 'users',
      tableName: 'users',
      idName: 'id',
      validation: {
        zodSchema: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
      },
    }];
    ```

  - **Registering Subs in a Service:**

    ```typescript
    // services/db/index.ts
    import { usersSubs } from './subs/users';
    import { composeSubs } from '@nile-squad/nile';

    export const dbService = {
      name: 'db',
      description: 'Database-backed auto CRUD and custom actions',
      subs: composeSubs([
        ...usersSubs,
        // ...other subs
      ]),
      actions: [
        // custom actions here
      ],
    };
    ```

  - **Endpoint Naming Convention:**
    - Each sub exposes endpoints under `/services/{serviceName}/{subName}`.
    - Example: `POST /services/db/users` for CRUD operations on the `users` table.
  - See [Auto-Generated CRUD Services](./docs/architecture.md#auto-generated-crud-services-subs) for more.

- **Actions (Custom Business Logic Handlers)**
  - Handler functions that implement custom, multi-step business workflows or logic.
  - Used for any operation that requires logic beyond basic CRUD—such as aggregating data, orchestrating multiple database calls, or enforcing business rules.
  - Example:

    ```typescript
    // services/db/users/assignRole.ts
    import { Ok, safeError, isError } from '@nile-squad/nile';

    export const assignRoleHandler = async (payload) => {
      // ...custom logic...
      if (/* error */) return safeError('Failed to assign role');
      return Ok({ success: true });
    };
    ```

  - See [Custom Business Actions & Handlers](./docs/architecture.md#custom-business-actions--handlers) for more.

This structure keeps your project organized, scalable, and easy to maintain—whether you’re building a simple CRUD API or a complex, business-driven backend.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add some amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

## License

This project is provided as-is with no guarantees or warranties and is licensed under the MIT License.

**Author:** [Hussein Kizz](https://github.com/Hussseinkizz) at [Nile Squad Labz](https://github.com/nile-squad)

*This specification reflects the current implementation and is subject to evolution. Contributions and feedback are welcome.*
