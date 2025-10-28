# Logger Standardization - Intent Document

**Date:** October 28, 2025  
**Task:** Replace `createLogger` usage with `log` from `internal.config`  
**Original Request:** User feedback on action hook system implementation

## Background

During the action hook system implementation review, it was identified that the codebase has inconsistent logging approaches:
1. Some files use `createLogger` to create individual logger instances with custom app names
2. The new action hooks code uses `log` from `internal.config` which standardizes on `appName: 'nile'`

## Original Intent (User's Perspective)

The user wants standardized, centralized logging across the Nile framework:
- **Single source of truth**: Use `log` from `internal.config` instead of scattered `createLogger` instances
- **Consistent app naming**: All logs should use `appName: 'nile'` rather than custom names like `'nile-rpc-utils'`, `'nile-rpc-auth'`, `'nile-utils'`
- **Simplified maintenance**: One logging pattern to maintain across the codebase
- **Better consistency**: All framework code logs the same way

## Files to Update

### 1. `/nile/src/interfaces/rpc/action-utils.ts`
- **Current:** `const logger = createLogger("nile-rpc-utils")`
- **Change:** Import `log` from `internal.config`, replace `logger.error()` calls
- **Affected lines:** 3, 10, 70-74, 87-94

### 2. `/nile/src/interfaces/rpc/rpc-auth-handler.ts`
- **Current:** `const logger = createLogger('nile-rpc-auth')`
- **Change:** Import `log` from `internal.config`, replace `logger.error()` calls
- **Affected lines:** 2, 11, 99-104, 142-147, 174-178, 188-191, 199-203, 209-212

### 3. `/nile/src/utils/check-if-empty.ts`
- **Current:** `const logger = createLogger('nile-utils')`
- **Change:** Import `log` from `internal.config`, replace `logger.error()` calls
- **Affected lines:** 1, 10, 22-26, 31-35

## Implementation Strategy

For each file:
1. Replace `import { createLogger } from ...` with `import { log } from '../internal.config'`
2. Remove `const logger = createLogger(...)` declaration
3. Replace `logger.error({ ... })` with `log({ type: 'error', ... })`
4. Ensure all required parameters (`atFunction`, `message`, `data`, `type`) are present

## Expected Outcome

- All three files will use the standardized `log` function
- No more custom logger instances in the framework code
- Consistent logging pattern across the entire Nile codebase
- Easier to maintain and debug logging behavior

## Backups Created

- `/nile/backup/interfaces-rpc-action-utils.ts`
- `/nile/backup/interfaces-rpc-rpc-auth-handler.ts`
- `/nile/backup/utils-check-if-empty.ts`

## Testing

After changes:
1. Run TypeScript checks to ensure no type errors
2. Run all tests to ensure logging still works correctly
3. Verify error IDs are still being returned correctly from `log` function
