# REST Server Global State Refactor - Intent

## Date
2025-10-29

## Original Issue
Test failures in `rest-jwt-auth.test.ts` due to global state pollution:
- Tests fail when run in full suite but pass in isolation
- Multiple server instances (main on port 9877, payload on port 9879) overwrite shared global variables
- Global `CONFIG` and `CURRENT_APP` cause test interference

## Root Cause
Located in `/nile/src/interfaces/rest/rest-server.ts`:

```typescript
// Lines 29-30: Global mutable variables
let CONFIG: ServerConfig | null = null;
let CURRENT_APP: Hono<AppContext> | null = null;

// Line 115: Each createRestRPC() overwrites the global
export const createRestRPC = (config: ServerConfig) => {
  CONFIG = config;  // ← BUG: Overwrites global state
  CURRENT_APP = restApp;
  // ...
}

// Lines 632-635: Exported for external access
export const useAppInstance = () => CURRENT_APP || app;
export const getAutoConfig = () => CONFIG;
```

**Why globals existed:**
- `getAutoConfig()` used by:
  - `/nile/src/interfaces/rpc/service-utils.ts` (lines 13, 127, 231)
  - `/nile/src/interfaces/rpc/agent-auth.ts` (line 11)
- `useAppInstance()` allows adding custom routes to Hono app
- Both enable accessing server config/app instance from utility functions

## Proposed Solution
**User's suggestion:** Instead of exporting global functions, `createRestRPC` should return an object containing everything needed from its scope, eliminating the need for globals.

## New Interface Design

```typescript
export interface RestRPCInstance {
  app: Hono<AppContext>;
  config: ServerConfig;
  getConfig: () => ServerConfig;
  getApp: () => Hono<AppContext>;
  // Keep any other currently exported methods
}

export const createRestRPC = (config: ServerConfig): RestRPCInstance => {
  // Returns instance-scoped object instead of relying on globals
}
```

## Changes Required

### 1. `/nile/src/interfaces/rest/rest-server.ts`
- **Remove:** Global `CONFIG` and `CURRENT_APP` variables
- **Remove:** Exported functions `getAutoConfig()` and `useAppInstance()`
- **Change:** `createRestRPC` return type from `Hono<AppContext>` to `RestRPCInstance`
- **Add:** Return object with `app`, `config`, `getConfig()`, `getApp()` methods

### 2. `/nile/src/interfaces/rpc/service-utils.ts`
- **Update:** All functions to accept optional `serverConfig?: ServerConfig` parameter
- **Change:** `getAutoConfig()` calls to use passed config parameter
- **Impact:** 3 locations (lines 13, 127, 231)

### 3. `/nile/src/interfaces/rpc/agent-auth.ts`
- **Update:** `createAgentToken()` to accept `config: ServerConfig` parameter
- **Change:** `getAutoConfig()` call to use passed config parameter
- **Impact:** 1 location (line 11)

### 4. `/backend/index.ts`
- **Update:** Destructure returned object: `const { app } = createRestRPC(serverConfig)`
- **Change:** Use `app` in serve() call

### 5. Test files
- `/nile/src/interfaces/rest/rest-jwt-auth.test.ts` (5 instances)
- `/nile/src/interfaces/rest/rest-layer-integration.test.ts` (1 instance)
- **Update:** All to destructure returned object appropriately

## Expected Benefits
1. **Test isolation:** Each server instance maintains its own config and app
2. **No global state:** Eliminates shared mutable state issues
3. **Better API:** Explicit return value instead of side effects
4. **Thread-safe:** Could support multiple servers in same process
5. **Cleaner architecture:** Dependencies passed explicitly, not accessed globally

## Potential Risks
1. Breaking changes for any code using `getAutoConfig()` or `useAppInstance()`
2. Need to update all call sites that use utility functions
3. Tests may need additional updates beyond just destructuring

## Testing Strategy
1. Run full test suite after changes
2. Specifically verify the 2 failing tests in `rest-jwt-auth.test.ts` now pass
3. Ensure all 73 model tests still pass
4. Check for any other test failures

## Scope
This refactor touches core `/nile` framework code and requires careful implementation following defensive programming principles.

## Implementation Notes
- Follow interface-first approach: Design agreed upon before implementation
- Maintain backward compatibility where possible via optional parameters
- Ensure error messages remain clear and user-friendly
- Document any breaking changes for library users
