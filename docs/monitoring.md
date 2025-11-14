# Monitoring and Diagnostics

**Version:** 1.0  
**Date:** November 15, 2025  
**Author:** Hussein Kizz

## 1. Overview

Nile provides built-in diagnostics capabilities across multiple system components to help you debug, monitor, and understand your application's behavior in development and production environments.

This document covers all available diagnostic settings, what information they provide, and best practices for using them effectively.

## 2. Diagnostics Configuration

Diagnostics are configured through the `ServerConfig` object when creating your REST-RPC server. Each major feature area has its own diagnostics toggle.

### 2.1. Complete Configuration Example

```typescript
import { createRestRPC } from '@nile-squad/nile';

const config: ServerConfig = {
  serverName: 'my-api',
  baseUrl: '/api',
  apiVersion: 'v1',
  allowedOrigins: ['http://localhost:3000'],
  
  // Auth diagnostics
  auth: {
    secret: process.env.AUTH_SECRET,
    method: 'cookie',
    diagnostics: true  // Enable auth debugging
  },
  
  // Upload diagnostics
  uploads: {
    limits: {
      maxFiles: 10,
      maxFileSize: 10 * 1024 * 1024,
      minFileSize: 1  // Minimum 1 byte (default)
    },
    diagnostics: true  // Enable upload debugging
  },
  
  // Rate limiting diagnostics
  rateLimiting: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    limit: 100,
    limitingHeader: 'X-RateLimit-Limit',
    diagnostics: true  // Enable rate limit debugging
  },
  
  // Agentic handler diagnostics
  agenticConfig: {
    handler: async (payload) => {
      // Your agentic handler logic
      return 'response';
    },
    diagnostics: true  // Enable agentic debugging
  }
};

const server = createRestRPC(config);
```

## 3. Authentication Diagnostics

### 3.1. Configuration

```typescript
auth: {
  secret: 'your-secret-key',
  method: 'cookie',  // or 'payload' or 'header'
  cookieName: 'auth-token',
  diagnostics: true  // Enable auth diagnostics
}
```

### 3.2. Information Logged

When `auth.diagnostics` is enabled, the following information is logged to the console:

- **Token extraction attempts**: Shows where tokens are being looked for (cookie, header, payload)
- **Token validation results**: Success or failure of token verification
- **User session information**: Details about authenticated user
- **Authentication method used**: Which auth method was active (cookie/header/payload)
- **JWT decode errors**: Specific errors when token parsing fails
- **Better Auth session retrieval**: Results from Better Auth integration

### 3.3. Example Output

```
[AUTH] Extracting token from cookie: auth-token
[AUTH] Token found in cookie
[AUTH] Validating JWT token...
[AUTH] Token valid - User ID: user-123
[AUTH] Session established for: john@example.com
```

### 3.4. Use Cases

- **Debugging authentication failures**: See exactly where token extraction fails
- **Testing multiple auth methods**: Verify which method is being used
- **Session troubleshooting**: Understand session lifecycle
- **Integration testing**: Validate auth flow end-to-end

## 4. Upload Diagnostics

### 4.1. Configuration

```typescript
uploads: {
  enforceContentType: true,
  limits: {
    maxFiles: 10,
    maxFileSize: 10 * 1024 * 1024,
    minFileSize: 1,  // Prevent empty files
    maxTotalSize: 20 * 1024 * 1024,
    maxFilenameLength: 128
  },
  allow: {
    mimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
    extensions: ['.png', '.jpg', '.jpeg', '.pdf']
  },
  diagnostics: true  // Enable upload diagnostics
}
```

### 4.2. Information Logged

When `uploads.diagnostics` is enabled, detailed upload information is logged:

- **File count and names**: All files in the request
- **File sizes**: Individual and total upload size
- **MIME types and extensions**: Detected file types
- **Validation steps**: Each validation check result
  - Filename length validation
  - Minimum file size validation (prevents empty files)
  - Zero-byte file detection
  - File count limits
  - Individual file size limits
  - Total upload size limits
  - MIME type and extension allowlist validation
- **Processing time**: How long upload parsing and validation took
- **Payload structure**: Fields vs files breakdown

### 4.3. Example Output

```
[UPLOADS] Received multipart/form-data request
[UPLOADS] Files detected: 2
  - document1.pdf (248KB, application/pdf)
  - document2.pdf (156KB, application/pdf)
[UPLOADS] Total upload size: 404KB
[UPLOADS] Running validation sequence...
[UPLOADS] ✓ Filename length check passed
[UPLOADS] ✓ Minimum file size check passed (minFileSize: 1 byte)
[UPLOADS] ✓ Zero-byte file check passed
[UPLOADS] ✓ File count check passed (2/10)
[UPLOADS] ✓ Individual file size check passed
[UPLOADS] ✓ Total size check passed (404KB/20MB)
[UPLOADS] ✓ Allowlist validation passed
[UPLOADS] Processing completed in 12ms
[UPLOADS] Payload structure: { fields: 3, files: 2 }
```

### 4.4. Minimum File Size Validation

The `minFileSize` limit prevents empty or near-empty files from being uploaded:

```typescript
uploads: {
  limits: {
    minFileSize: 1024  // Require at least 1KB
  }
}
```

**Default**: 1 byte (prevents truly empty files)

**When validation fails**:
```json
{
  "status": false,
  "message": "file too small",
  "data": {
    "error_category": "validation",
    "file": "empty.txt",
    "size": 512,
    "minSize": 1024
  }
}
```

**Use cases**:
- Prevent accidental empty file uploads
- Enforce minimum viable file sizes for your use case
- Reject incomplete uploads or corrupted files
- Set domain-specific requirements (e.g., avatars must be at least 5KB)

### 4.5. Use Cases

- **Debugging upload failures**: See which validation step is failing
- **Performance monitoring**: Track upload processing time
- **Security auditing**: Verify allowlist enforcement
- **Development testing**: Understand multipart/form-data parsing
- **Empty file prevention**: Ensure only valid content is uploaded

## 5. Rate Limiting Diagnostics

### 5.1. Configuration

```typescript
rateLimiting: {
  windowMs: 15 * 60 * 1000,  // 15 minutes
  limit: 100,                 // Max 100 requests per window
  standardHeaders: true,
  limitingHeader: 'X-RateLimit-Limit',
  diagnostics: true  // Enable rate limit diagnostics
}
```

### 5.2. Information Logged

When `rateLimiting.diagnostics` is enabled:

- **Request counts**: Current request count per client
- **Limit status**: How close to limit each client is
- **Window reset times**: When rate limit windows reset
- **Client identifiers**: IP addresses or custom identifiers
- **Rate limit hits**: When clients exceed limits
- **Store operations**: Cache/store read/write operations

### 5.3. Example Output

```
[RATE_LIMIT] Request from IP: 192.168.1.100
[RATE_LIMIT] Current count: 45/100
[RATE_LIMIT] Window resets in: 8m 32s
[RATE_LIMIT] Request allowed
---
[RATE_LIMIT] Request from IP: 192.168.1.101
[RATE_LIMIT] Current count: 101/100
[RATE_LIMIT] Rate limit exceeded
[RATE_LIMIT] Request blocked (429)
```

### 5.4. Use Cases

- **Rate limit tuning**: Understand actual usage patterns
- **DDoS detection**: Identify suspicious traffic patterns
- **Capacity planning**: Track request volume trends
- **Client debugging**: Help users understand rate limit issues

## 6. Agentic Handler Diagnostics

### 6.1. Configuration

```typescript
agenticConfig: {
  handler: async (payload) => {
    const { input, organization_id, user_id } = payload;
    
    // Your AI/agentic processing logic
    const response = await processWithAI(input);
    
    return response;
  },
  diagnostics: true  // Enable agentic diagnostics
}
```

### 6.2. Information Logged

When `agenticConfig.diagnostics` is enabled:

- **Handler invocations**: When agentic handler is called
- **Input payloads**: Organization ID, User ID, and input content
- **Processing time**: How long the handler takes to respond
- **Response summaries**: Size and structure of responses
- **Error details**: Any errors during agentic processing

### 6.3. Example Output

```
[AGENTIC] Handler invoked
[AGENTIC] Organization: org-123
[AGENTIC] User: user-456
[AGENTIC] Input length: 256 characters
[AGENTIC] Processing request...
[AGENTIC] Handler completed in 1.2s
[AGENTIC] Response length: 512 characters
```

### 6.4. Use Cases

- **AI integration debugging**: Track AI service interactions
- **Performance monitoring**: Measure response times
- **Usage analytics**: Understand user interaction patterns
- **Error tracking**: Debug agentic handler failures

## 7. Best Practices

### 7.1. Environment-Based Configuration

Use environment variables to control diagnostics per environment:

```typescript
const config: ServerConfig = {
  auth: {
    secret: process.env.AUTH_SECRET,
    method: 'cookie',
    diagnostics: process.env.NODE_ENV === 'development'
  },
  uploads: {
    diagnostics: process.env.DEBUG_UPLOADS === 'true'
  },
  rateLimiting: {
    diagnostics: process.env.NODE_ENV !== 'production'
  }
};
```

### 7.2. Production Considerations

**DO enable diagnostics in production when**:
- Investigating specific issues
- Monitoring critical features
- Initial deployment periods
- Performance testing

**DO NOT enable diagnostics in production**:
- By default (performance overhead)
- For high-traffic endpoints
- When logging sensitive data
- In resource-constrained environments

### 7.3. Selective Diagnostics

Enable only the diagnostics you need:

```typescript
// During auth debugging
auth: {
  diagnostics: true  // Only auth logs
}

// During file upload testing
uploads: {
  diagnostics: true  // Only upload logs
}
```

### 7.4. Log Management

**Console output**: All diagnostics log to `console.log` by default

**Best practices**:
- Use structured logging (JSON format) in production
- Integrate with logging services (Winston, Pino, etc.)
- Set up log rotation and retention policies
- Sanitize sensitive data before logging
- Use log levels appropriately

**Example with structured logging**:

```typescript
// Custom logger wrapper
const logger = {
  info: (message: string, data?: any) => {
    console.log(JSON.stringify({
      level: 'info',
      message,
      data,
      timestamp: new Date().toISOString()
    }));
  }
};

// Configure with custom logging
if (config.uploads?.diagnostics) {
  // Nile will use console.log, but you can intercept:
  const originalLog = console.log;
  console.log = (...args) => {
    logger.info('NILE_DIAGNOSTIC', { args });
    originalLog(...args);
  };
}
```

### 7.5. Security Considerations

**Never log**:
- Raw authentication tokens
- User passwords or credentials
- Sensitive user data (PII)
- API secrets or keys

**Do log**:
- Token validation results (pass/fail only)
- User IDs (not full user objects)
- Request metadata (not sensitive payload data)
- Timing and performance metrics

**Example safe logging**:
```typescript
// ❌ Bad - logs sensitive data
console.log('[AUTH] Token:', token);

// ✅ Good - logs validation result only
console.log('[AUTH] Token validation: success');
```

## 8. Troubleshooting with Diagnostics

### 8.1. Authentication Issues

**Problem**: Users can't log in

**Solution**:
1. Enable `auth.diagnostics: true`
2. Look for token extraction logs
3. Check token validation errors
4. Verify auth method configuration

**Example debugging session**:
```
[AUTH] Extracting token from cookie: auth-token
[AUTH] Token not found in cookie
[AUTH] Authentication failed: no token
```

**Fix**: User's cookie expired or wasn't set. Check cookie settings.

### 8.2. Upload Failures

**Problem**: File uploads are rejected

**Solution**:
1. Enable `uploads.diagnostics: true`
2. Review validation sequence logs
3. Identify which validation step fails
4. Adjust configuration or client code

**Example debugging session**:
```
[UPLOADS] Running validation sequence...
[UPLOADS] ✓ Filename length check passed
[UPLOADS] ✓ Minimum file size check passed
[UPLOADS] ✓ Zero-byte file check passed
[UPLOADS] ✓ File count check passed
[UPLOADS] ✗ Allowlist validation failed
[UPLOADS] Rejected: script.sh (not in allowlist)
```

**Fix**: File type not allowed. Add `.sh` to allowed extensions or change file type.

### 8.3. Rate Limit Confusion

**Problem**: Users reporting rate limit errors

**Solution**:
1. Enable `rateLimiting.diagnostics: true`
2. Monitor request counts per client
3. Analyze usage patterns
4. Adjust limits if needed

**Example debugging session**:
```
[RATE_LIMIT] Request from IP: 10.0.1.5
[RATE_LIMIT] Current count: 95/100
[RATE_LIMIT] Next window resets in: 2m 15s
```

**Fix**: User is close to limit. Either wait for reset or increase limit.

## 9. Performance Impact

### 9.1. Overhead Analysis

**Minimal impact features** (< 1% overhead):
- `auth.diagnostics`
- `rateLimiting.diagnostics`
- `agenticConfig.diagnostics`

**Moderate impact features** (1-3% overhead):
- `uploads.diagnostics` (due to file size calculations)

**Recommendations**:
- Safe to enable all diagnostics in development
- Enable selectively in production
- Disable after debugging is complete
- Monitor application performance metrics

### 9.2. Benchmarking

To measure diagnostics overhead in your application:

```typescript
const startTime = Date.now();

// Run with diagnostics disabled
await testUpload();
const baselineTime = Date.now() - startTime;

// Run with diagnostics enabled
config.uploads.diagnostics = true;
const diagStartTime = Date.now();
await testUpload();
const diagnosticsTime = Date.now() - diagStartTime;

console.log(`Overhead: ${diagnosticsTime - baselineTime}ms`);
```

## 10. Related Documentation

- [File Upload Handling](./uploads-handling.md) - Complete upload documentation including diagnostics
- [Authentication](./auth.md) - Auth system architecture and configuration
- [REST-RPC Specification](./rest-rpc.spec.md) - Complete protocol specification
- [Error Handling](./error-handling.md) - Error patterns and debugging

## 11. Future Enhancements

Planned diagnostic improvements:

- **Structured logging integration**: Built-in support for Winston, Pino, Bunyan
- **Metrics export**: Prometheus/OpenTelemetry integration
- **Diagnostic levels**: `verbose`, `normal`, `minimal` modes
- **Custom diagnostic handlers**: Plugin system for custom logging
- **Performance profiling**: Built-in performance metrics
- **Distributed tracing**: Request ID propagation and trace correlation

---

**Author:** [Hussein Kizz](https://github.com/Hussseinkizz) at Nile Squad Labz

*This documentation reflects the current implementation and is subject to evolution. Contributions and feedback are welcome.*
