# Unified Executor Diagnostics - Implementation Intent

**Date:** October 28, 2025  
**Task:** Add configurable diagnostic logging to unified-executor  
**Requested by:** User

## Purpose

Add detailed diagnostic logging for every stage of the action execution lifecycle to help debug intermittent failures and understand execution flow.

## Scope

### What We're Adding

1. **Configurable diagnostics** via `serverConfig.diagnostics` option
2. **Performance tracking** for each lifecycle stage
3. **Detailed logging** at each execution stage:
   - Service/action lookup
   - Authentication
   - Global before hook (authorization)
   - Payload validation
   - Action-level before hooks (with per-hook timing)
   - Main handler execution
   - Action-level after hooks (with per-hook timing)
   - Global after hook
   - Total execution time

### Configuration Interface

```typescript
serverConfig: {
  services: [...],
  diagnostics?: {
    enabled: boolean;
    logLevel?: 'minimal' | 'detailed' | 'verbose';
    includePayloads?: boolean;
    includeTimings?: boolean;
  }
}
```

### Log Format

```typescript
{
  timestamp: string;
  stage: string;
  actionName: string;
  serviceName: string;
  duration?: number;
  details?: any;
}
```

## Implementation Approach

1. Add type definitions for diagnostics config
2. Create diagnostic logger utility function
3. Add timing markers at each stage
4. Log stage entry/exit with performance data
5. Keep logs minimal by default (only if enabled)
6. Use existing `log()` function from internal.config

## User's Original Intent

User wants to:
- Debug intermittent test failures
- Understand execution timing
- Verify hooks execute at correct stages
- Have visibility into the complete lifecycle

## Constraints

- Must be opt-in (disabled by default)
- Should not impact performance when disabled
- Should use existing logging infrastructure
- Must not expose sensitive data (tokens, passwords)
- Should respect the existing execution flow (don't change logic)

## Success Criteria

- Diagnostics can be enabled via server config
- Each lifecycle stage is logged with timing
- Hook execution is visible (before/after chains)
- Total execution time is reported
- Logs are clear and actionable
- No performance impact when disabled
