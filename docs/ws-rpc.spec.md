# WebSocket RPC Specification

**Version:** 1.0  
**Date:** August 18, 2025  
**Author:** Hussein Kizz

## 1. Overview

WebSocket RPC extends the REST-RPC architecture with real-time, bidirectional communication capabilities. It provides identical functionality to HTTP RPC through WebSocket events while maintaining complete response parity and leveraging existing authentication, validation, and execution infrastructure.

### 1.1 Key Features

- **Complete HTTP Parity**: All HTTP RPC operations available via WebSocket events
- **Real-time Communication**: Bidirectional, persistent connections
- **Unified Authentication**: Uses existing HTTP-issued tokens and sessions
- **Maximum Code Reuse**: Leverages existing REST-RPC infrastructure
- **Event-Driven Architecture**: Five core RPC events for discovery and execution
- **Production Ready**: Comprehensive error handling and test coverage

### 1.2 Transport Protocol

- **Protocol**: WebSocket with Socket.IO
- **Namespace**: `/ws/rpc`
- **Authentication**: HTTP-first approach with token verification
- **Response Format**: Identical to HTTP RPC responses

## 2. Connection and Authentication

### 2.1 Connection Establishment

**Endpoint:** `ws://localhost:3000/ws/rpc`

Clients connect to the WebSocket RPC namespace using Socket.IO client libraries:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/ws/rpc', {
  auth: {
    token: 'Bearer <jwt_token>'
  }
});
```

### 2.2 Authentication Methods

The WebSocket server accepts authentication through multiple sources:

- **`socket.handshake.auth.token`**: Preferred method with "Bearer <jwt>" format
- **Authorization Header**: Standard HTTP header in handshake
- **Cookies**: For BetterAuth session-based authentication (requires `withCredentials: true`)

**Authentication Verification:**

- All connections undergo immediate authentication verification
- Invalid authentication results in connection rejection
- Successful authentication stores user context in `socket.data.authResult`
- Protected actions respect existing `isProtected` configuration

### 2.3 Error Responses

Authentication failures return specific error messages:

- **JWT Errors**: `"Invalid token"`
- **BetterAuth Errors**: `"Invalid session"`
- **Generic Failures**: `"UNAUTHORIZED"`

## 3. RPC Events

### 3.1 Service Discovery Events

#### 3.1.1 List Services

**Event:** `listServices`

Lists all available services in the system.

**Request:**

```javascript
socket.emit('listServices', {}, (response) => {
  console.log(response);
});
```

**Response:**

```json
{
  "status": true,
  "message": "List of all available services",
  "data": ["accounts", "posts", "notifications"]
}
```

#### 3.1.2 Get Service Details

**Event:** `getServiceDetails`

Retrieves detailed information about a specific service.

**Request:**

```javascript
socket.emit('getServiceDetails', {
  "service": "accounts"
}, (response) => {
  console.log(response);
});
```

**Response:**

```json
{
  "status": true,
  "message": "Service Details",
  "data": {
    "name": "accounts",
    "description": "User account management service",
    "availableActions": ["create", "update", "delete", "getAll"]
  }
}
```

#### 3.1.3 Get Action Details

**Event:** `getActionDetails`

Retrieves detailed information about a specific action within a service.

**Request:**

```javascript
socket.emit('getActionDetails', {
  "service": "accounts",
  "action": "create"
}, (response) => {
  console.log(response);
});
```

**Response:**

```json
{
  "status": true,
  "message": "Action Details",
  "data": {
    "name": "create",
    "description": "Create a new user account",
    "validation": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "email": { "type": "string", "format": "email" }
      },
      "required": ["name", "email"]
    },
    "isProtected": true,
    "isSpecial": false,
    "hooks": {
      "before": ["validateEmail"],
      "after": ["sendWelcomeEmail"]
    },
    "pipeline": null
  }
}
```

#### 3.1.4 Get Schemas

**Event:** `getSchemas`

Retrieves validation schemas for all actions across all services.

**Request:**

```javascript
socket.emit('getSchemas', {}, (response) => {
  console.log(response);
});
```

**Response:**

```json
{
  "status": true,
  "message": "Services actions zod Schemas",
  "data": [
    {
      "accounts": [
        {
          "name": "create",
          "description": "Create a new user account",
          "validation": { /* JSON Schema */ },
          "hooks": { "before": [], "after": [] },
          "pipeline": null
        }
      ]
    }
  ]
}
```

### 3.2 Action Execution Event

#### 3.2.1 Execute Action

**Event:** `executeAction`

Executes a specific action with the provided payload.

**Request:**

```javascript
socket.emit('executeAction', {
  "service": "accounts",
  "action": "create",
  "payload": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}, (response) => {
  console.log(response);
});
```

**Success Response:**

```json
{
  "status": true,
  "message": "Account created successfully",
  "data": {
    "id": "123",
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2025-08-18T10:30:00Z"
  }
}
```

**Error Response:**

```json
{
  "status": false,
  "message": "Invalid request format",
  "data": {
    "error": [
      {
        "code": "invalid_type",
        "expected": "string",
        "received": "undefined",
        "path": ["email"],
        "message": "Required"
      }
    ]
  }
}
```

## 4. Error Handling

### 4.1 Error Response Format

All errors follow the standard REST-RPC error format:

```json
{
  "status": false,
  "message": "Error description",
  "data": {
    "error": "Additional error details"
  }
}
```

### 4.2 Common Error Types

#### 4.2.1 Service Not Found

```json
{
  "status": false,
  "message": "Service accounts not found",
  "data": {}
}
```

#### 4.2.2 Action Not Found

```json
{
  "status": false,
  "message": "Action create not found in service accounts",
  "data": {}
}
```

#### 4.2.3 Authorization Error

```json
{
  "status": false,
  "message": "Unauthorized",
  "data": {
    "error": "Invalid token"
  }
}
```

#### 4.2.4 Validation Error

```json
{
  "status": false,
  "message": "Invalid request format",
  "data": {
    "error": [
      {
        "code": "invalid_type",
        "path": ["email"],
        "message": "Required"
      }
    ]
  }
}
```

## 5. Configuration

### 5.1 Server Configuration

WebSocket RPC is configured through the `ServerConfig` interface:

```typescript
import { createRestRPCServer } from '@nile-squad/nile';

const server = createRestRPCServer({
  // ... other config
  websocket: {
    enabled: true,              // Default: true
    path: '/socket.io/',        // Default: '/socket.io/'
    namespace: '/ws/rpc',       // Default: '/ws/rpc'
    cors: {
      origin: 'http://localhost:3000',
      credentials: true
    }
  }
});
```

### 5.2 Configuration Options

- **`enabled`**: Enable/disable WebSocket RPC (default: `true`)
- **`path`**: Socket.IO server path (default: `'/socket.io/'`)
- **`namespace`**: WebSocket namespace for RPC events (default: `'/ws/rpc'`)
- **`cors`**: CORS configuration for WebSocket connections

## 6. Client Implementation

### 6.1 JavaScript/TypeScript Client

```typescript
import { io, Socket } from 'socket.io-client';

class WSRPCClient {
  private socket: Socket;

  constructor(url: string, token: string) {
    this.socket = io(`${url}/ws/rpc`, {
      auth: { token: `Bearer ${token}` }
    });
  }

  async listServices(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.socket.emit('listServices', {}, (response) => {
        if (response.status) {
          resolve(response.data);
        } else {
          reject(new Error(response.message));
        }
      });
    });
  }

  async executeAction(service: string, action: string, payload?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.socket.emit('executeAction', { service, action, payload }, (response) => {
        if (response.status) {
          resolve(response.data);
        } else {
          reject(new Error(response.message));
        }
      });
    });
  }
}

// Usage
const client = new WSRPCClient('http://localhost:3000', 'your-jwt-token');
const services = await client.listServices();
const result = await client.executeAction('accounts', 'create', { name: 'John', email: 'john@example.com' });
```

### 6.2 React Hook Example

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useWSRPC(url: string, token: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(`${url}/ws/rpc`, {
      auth: { token: `Bearer ${token}` }
    });

    newSocket.on('connect', () => setConnected(true));
    newSocket.on('disconnect', () => setConnected(false));

    setSocket(newSocket);

    return () => newSocket.close();
  }, [url, token]);

  const executeAction = async (service: string, action: string, payload?: any) => {
    if (!socket) throw new Error('Socket not connected');

    return new Promise((resolve, reject) => {
      socket.emit('executeAction', { service, action, payload }, (response) => {
        if (response.status) {
          resolve(response.data);
        } else {
          reject(new Error(response.message));
        }
      });
    });
  };

  return { socket, connected, executeAction };
}
```

## 7. Testing

### 7.1 Test Coverage

The WebSocket RPC implementation includes comprehensive test coverage:

- **Authentication Tests**: Valid/invalid token verification
- **Discovery Tests**: All service discovery events
- **Execution Tests**: Protected/unprotected action execution
- **Error Handling Tests**: All error scenarios
- **Integration Tests**: Full client-server flow

### 7.2 Running Tests

```bash
cd nile
pnpm test
```

All tests pass with 100% coverage across 81 test cases.

## 8. Performance Considerations

### 8.1 Connection Management

- **Persistent Connections**: WebSocket connections remain open for the session duration
- **Authentication Caching**: User context cached in socket data after initial verification
- **Resource Cleanup**: Automatic cleanup on disconnect

### 8.2 Scalability

- **Stateless Design**: Each event is self-contained and stateless
- **Load Balancing**: Compatible with Socket.IO clustering and Redis adapter
- **Resource Efficiency**: Minimal memory footprint per connection

## 9. Security

### 9.1 Authentication Security

- **Token Verification**: All tokens validated using existing HTTP RPC authentication
- **Connection Rejection**: Invalid authentication immediately rejects connections
- **Session Management**: Supports both JWT and session-based authentication

### 9.2 Action Protection

- **Consistent Protection**: Same `isProtected` logic as HTTP RPC
- **Authorization Context**: User context available for all protected actions
- **Audit Trail**: All actions logged through existing logging infrastructure

## 10. Migration from HTTP RPC

### 10.1 Response Compatibility

WebSocket RPC responses are identical to HTTP RPC responses, making migration straightforward:

**HTTP RPC:**
```bash
curl -X POST http://localhost:3000/services/accounts/create \
  -H "Authorization: Bearer <token>" \
  -d '{"name": "John", "email": "john@example.com"}'
```

**WebSocket RPC:**
```javascript
socket.emit('executeAction', {
  service: 'accounts',
  action: 'create',
  payload: { name: 'John', email: 'john@example.com' }
}, callback);
```

Both return identical response structures.

### 10.2 Feature Parity

- **Complete Feature Parity**: All HTTP RPC features available via WebSocket
- **Identical Validation**: Same Zod schemas and validation logic
- **Same Hooks**: Hook execution identical to HTTP RPC
- **Error Handling**: Identical error response formats

**Author:** [Hussein Kizz](https://github.com/Hussseinkizz) at Nile Squad Labz

*This specification reflects the current implementation and is subject to evolution. Contributions and feedback are welcome.*