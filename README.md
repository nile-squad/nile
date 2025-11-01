# 🌊 Nile

[![NPM Version](https://img.shields.io/npm/v/@nile-squad/nile.svg)](https://www.npmjs.com/package/@nile-squad/nile)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

**Nile is a TypeScript-first, service-oriented backend framework for building modern, AI-ready backends with simplest developer experience and speed.**

**Built with cutting edge stack:**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?logo=zod&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle-C5F74F?logo=drizzle&logoColor=black)

Nile was created at [Nile Squad Labz](https://nilesquad.com) to power our own B2B saas products and services, and is now open-sourced for the community.

And right now its not perfect yet, some things are still being figured out and docs may not be at par with the codebase. But it is already being used in production at Nile Squad Labz, and we are committed to making it better.

> Note: For Database so far it can work well with Postgres, Sqlite, and mostly any drizzle supported db.

## There Other Backend Frameworks, Why Nile?

- **No MVC or REST clutter:** Nile uses a simple service-and-action model—just define your business logic as actions, and Nile exposes them everywhere you need. No controllers, no routes, no REST duplication, you only focus on business operations and code it handles the rest.
- **Service-Oriented Architecture**: A clear and organized way to structure your backend logic.
- **Multi-Protocol Support**: Access your services via REST-RPC, WebSocket RPC, or direct in-process calls.
- **Automatic API Discovery**: Endpoints are self-documenting. You can programmatically explore services, actions, and their validation schemas.
- **Hook-Based System**: Intercept and modify behavior with `before` and `after` hooks at both global and action-specific levels.
- **Database Automation**: Automatically generate type-safe CRUD services from your Drizzle schemas.
- **Agentic by Design**: Built with agentic workflows in mind, supporting AI agents as first-class citizens.
- **Secure by Default**: All actions are protected unless you explicitly mark them as public.

## 📚 Documentation

For detailed guides and specifications, see the `docs` directory:

- **[Architecture](./docs/architecture.md)** - How to structure your Nile applications
- **[REST-RPC Specification](./docs/rest-rpc.spec.md)** - Complete API specification
- **[WebSocket RPC Specification](./docs/ws-rpc.spec.md)** - Real-time API capabilities
- **[Agentic System (AI endpoint)](./docs/agentic.spec.md)** - AI integration guide
- **[Authentication Guide](./docs/auth.md)** - Security and auth patterns
- **[Error Handling](./docs/error-handling.md)** - Error patterns and logging
- **[Action Hooks](./docs/action-hooks.md)** - Workflow composition
- **[Task Runner](./docs/task-runner.spec.md)** - Background job processing
- **[Meta System](./docs/meta-system.md)** - Metadata management
- **[Invoke Service Action](./docs/invoke-service-action.md)** - Service communication

## Installation

To get started, add Nile to your project using your favorite package manager:

```bash
pnpm install @nile-squad/nile typescript drizzle-orm
```

**Peer Dependencies:**
- `typescript` (^5.0.0) - Required
- `drizzle-orm` (^0.44.0) - Required

**Optional Peer Dependencies** (install based on your database needs):
- `better-sqlite3` - For SQLite databases
- `@electric-sql/pglite` - For PGLite databases
- `@neondatabase/serverless` - For Neon serverless Postgres

Example with optional dependencies:
```bash
# For PostgreSQL with Neon
pnpm install @nile-squad/nile typescript drizzle-orm @neondatabase/serverless

# For SQLite
pnpm install @nile-squad/nile typescript drizzle-orm better-sqlite3
```
And any drizzle orm supported db can be supported.

## ✅ Project Status

Nile has been in development for over seven months and is actively used in production at Nile Squad Labz, evolving super fast.

However, it is an ongoing project and will continue to evolve. It is not yet recommended for production use for those uncomfortable with potential breaking changes or the need to consult the source code where documentation may be incomplete. The documentation will be steadily updated to fully cover all aspects of the framework.

> **Nile CLI is being worked on to make it easy to try it out.**

For those more curious you can see /docs directory for spec and test files for sample server setup.

## Core Concepts

Nile's architecture is based on a few core concepts. For a deeper dive, please refer to the detailed documentation.

### Service-Action Model & API Discovery

Services are the building blocks of a Nile application. The REST-RPC protocol allows you to discover services and their actions via `GET` requests, making the API self-documenting.

- `GET /services`: Lists all available services.
- `GET /services/{serviceName}`: Shows details and available actions for a service.
- `GET /services/{serviceName}/{actionName}`: Provides the schema and hook information for a specific action.
- `POST /services/{serviceName}`: Receives action name and payload to run on a given service.

> Simply put, GETs are like exploring restaurant menu on what dishes are available, then POST is ordering what exactly you want to eat after that. Example service: auth, action: login, payload: username, password.

- **[Read more about ideal project structure and architecture](./docs/architecture.md)**

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


## Roadmap

Nile is actively developed with several features in various stages of completion:

**Completed:**
- Comprehensive test suite (95% coverage)
- Type-safe ORM integration with Drizzle
- Background task runner with scheduling

**In Progress:**
- Official CLI tool for scaffolding and migrations (80% complete)
- Documentation website (60% complete)

For detailed architecture, project structure, configuration guides, and service patterns, see:
- **[Architecture Guide](./docs/architecture.md)** - Complete architecture reference
- **[Error Handling](./docs/error-handling.md)** - Error patterns and logging

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
