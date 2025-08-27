# 🌊 Nile

**Version:** 1.1.0  
**Date:** August 18, 2025  
**Author:** Hussein Kizz

The Nile Backend Framework - A modern service-oriented architecture with REST-RPC and WebSocket RPC capabilities.

## Installation

```bash
pnpm install @nile-squad/nile
```

## Features

### 🔧 Core Framework

- **REST-RPC Architecture**: Service-oriented design with HTTP GET discovery and POST execution
- **WebSocket RPC**: Real-time bidirectional communication with complete HTTP parity
- **Self-Documenting APIs**: Automatic schema introspection and service discovery
- **Hook-Based Workflows**: Composable before/after hooks for complex business logic
- **Agent Integration**: AI-driven service interactions and automation
- **Database Model Automation**: Generated CRUD operations with schema validation

### 🌐 Multi-Protocol Support

- **HTTP RPC**: RESTful service discovery with RPC-style action execution
- **WebSocket RPC**: Real-time event-driven communication
- **Direct RPC**: In-process function calls
- **Agent-Based**: AI-driven service orchestration

### 🔒 Authentication & Security

- **JWT Authentication**: Stateless token-based authentication
- **BetterAuth Integration**: Session-based authentication support
- **Agent Authentication**: Secure AI agent access
- **Action Protection**: Fine-grained access control per action
- **CORS Support**: Configurable cross-origin resource sharing

### 📊 Developer Experience

- **TypeScript First**: Full TypeScript support with strict typing
- **Schema Validation**: Zod-based request/response validation
- **Comprehensive Testing**: Built-in testing utilities and patterns
- **Hot Reloading**: Development-friendly with fast iteration
- **Logging**: Structured logging with configurable levels

## Quick Start

### Basic Server Setup

```typescript
import { createRestRPCServer } from '@nile-squad/nile';

const server = createRestRPCServer({
  port: 3000,
  services: () => [
    {
      name: 'accounts',
      description: 'User account management',
      actions: [
        {
          name: 'create',
          description: 'Create a new user account',
          handler: async (payload) => {
            // Your business logic here
            return {
              status: true,
              message: 'Account created successfully',
              data: { id: '123', ...payload }
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
  ],
  websocket: {
    enabled: true,
    namespace: '/ws/rpc'
  }
});

server.listen();
```

### WebSocket RPC Client

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/ws/rpc', {
  auth: { token: 'Bearer your-jwt-token' }
});

// Execute action via WebSocket
socket.emit('executeAction', {
  service: 'accounts',
  action: 'create',
  payload: { name: 'John Doe', email: 'john@example.com' }
}, (response) => {
  console.log(response);
  // { status: true, message: 'Account created successfully', data: {...} }
});

// List available services
socket.emit('listServices', {}, (response) => {
  console.log(response.data); // ['accounts', 'posts', ...]
});
```

### HTTP RPC Usage

```bash
# Discover services
curl http://localhost:3000/services

# Get service details
curl http://localhost:3000/services/accounts

# Execute action
curl -X POST http://localhost:3000/services/accounts/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{"name": "John Doe", "email": "john@example.com"}'
```

## API Reference

### REST-RPC Endpoints

- **`GET /services`** - List all available services
- **`GET /services/{service}`** - Get service details and available actions
- **`GET /services/{service}/{action}`** - Get action details and validation schema
- **`GET /services/schema`** - Get all service schemas
- **`POST /services/{service}/{action}`** - Execute a service action

### WebSocket RPC Events

- **`listServices`** - List all available services
- **`getServiceDetails`** - Get service details and available actions
- **`getActionDetails`** - Get action details and validation schema
- **`getSchemas`** - Get all service schemas
- **`executeAction`** - Execute a service action

All WebSocket events return identical response formats to their HTTP equivalents.

## Configuration

### Server Configuration

```typescript
interface ServerConfig {
  port?: number;
  cors?: CorsOptions;
  services: () => Service[];
  auth?: AuthConfig;
  websocket?: {
    enabled?: boolean;           // Default: true
    path?: string;              // Default: '/socket.io/'
    namespace?: string;         // Default: '/ws/rpc'
    cors?: SocketCorsOptions;
  };
  hooks?: {
    before?: GlobalHook[];
    after?: GlobalHook[];
  };
}
```

### Authentication Configuration

```typescript
interface AuthConfig {
  jwt?: {
    secret: string;
    algorithms?: string[];
  };
  betterAuth?: {
    baseURL: string;
    trustedOrigins?: string[];
  };
  agents?: {
    enabled?: boolean;
    apiKey?: string;
  };
}
```

## Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test --coverage

# Run specific test file
pnpm test ws-server.test.ts
```

## Architecture

### Service-Action Model

```typescript
interface Service {
  name: string;
  description?: string;
  actions: Action[];
}

interface Action {
  name: string;
  description?: string;
  handler: ActionHandler;
  validation?: ValidationConfig;
  isProtected?: boolean;
  hooks?: {
    before?: Hook[];
    after?: Hook[];
  };
}
```

### Hook System

```typescript
interface Hook {
  name: string;
  handler: HookHandler;
  critical?: boolean;
}

type HookHandler = (
  payload: any,
  context: HookContext
) => Promise<HookResult>;
```

## Documentation

- **[Architecture](./architecture.md)** - Framework architecture and design principles
- **[REST-RPC Specification](../docs/rest-rpc.spec.md)** - Complete HTTP RPC documentation
- **[WebSocket RPC Specification](../docs/ws-rpc.spec.md)** - Complete WebSocket RPC documentation
- **[Authentication Guide](../docs/auth.md)** - Authentication setup and configuration
- **[Style Guide](../docs/STYLE-GUIDE.md)** - Code style and best practices

## Examples

### With Hooks

```typescript
{
  name: 'create',
  handler: async (payload) => {
    return { status: true, message: 'User created', data: payload };
  },
  hooks: {
    before: [
      {
        name: 'validateEmail',
        handler: async (payload) => {
          if (!payload.email.includes('@')) {
            throw new Error('Invalid email');
          }
          return { success: true, data: payload };
        }
      }
    ],
    after: [
      {
        name: 'sendWelcomeEmail',
        handler: async (payload) => {
          await sendEmail(payload.email, 'Welcome!');
          return { success: true, data: payload };
        }
      }
    ]
  }
}
```

### Database Integration

```typescript
// Sub-services automatically generate CRUD actions for database tables
const userService = {
  name: 'users',
  description: 'User management service',
  actions: [], // Empty - actions auto-generated from sub-service config
  tableName: 'users',
  idName: 'id',
  protectedActions: ['create', 'update', 'delete', 'getAll'],
  unprotectedActions: ['getOne'], // Public profile access
  validation: {
    validationMode: 'auto',
    omitFields: ['id', 'created_at', 'updated_at']
  }
};

// Automatically generates: create, getAll, getOne, update, delete actions
// Plus: getEvery, getManyWith, getOneWith, getOneWithRelations
```

## Performance

- **Lightweight**: Minimal overhead with efficient request processing
- **Scalable**: Stateless design supports horizontal scaling
- **Fast**: Optimized for high-throughput scenarios
- **Memory Efficient**: Smart resource management and cleanup

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [GitHub Repository](https://github.com/nile-squad/nile)
- **Issues**: [GitHub Issues](https://github.com/nile-squad/nile/issues)
- **Discussions**: [GitHub Discussions](https://github.com/nile-squad/nile/discussions)

**Author:** [Hussein Kizz](https://github.com/Hussseinkizz) at [Nile Squad Labz](https://github.com/nile-squad)

*Built with ❤️ for the modern web*