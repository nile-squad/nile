# Hook System Refactoring Intent

**Date:** October 28, 2025  
**Files to Modify:**
- `/nile/src/types/action-hook.ts`
- `/nile/src/core/unified-executor.ts`
- `/nile/src/core/auth-handlers.ts`
- `/nile/docs/action-execution-lifecycle.md`

---

## Purpose

Refactor hook system based on user requirements:

1. **Rename hooks for clarity:**
   - `onActionHandler` → `onBeforeActionHandler` (authorization)
   - Add `onAfterActionHandler` (exit gate/cleanup)

2. **Update signatures:**
   - Remove `stage` parameter (not needed with separate hooks)
   - `onAfterActionHandler` receives `result` parameter
   - Both receive original `payload` and `nileContext`

3. **Fix hard-coded error IDs:**
   - Replace all hard-coded error IDs with `log()` returned IDs
   - Ensure proper error category usage

---

## User's Original Intent

> "it's ok after hook can exist like an exit gate maybe final global cleaning of data or something, we can expost it as onAfterActionHandler in config, akin to how we set onBeforeActionHandler (switch to this, more easy to think about than onActionHandler) and the after should get orignal payload, and last action or pipeline results, and nile context"

---

## Scope of Changes

### 1. Type Definitions (action-hook.ts)
- Add `OnBeforeActionHandler` type
- Add `OnAfterActionHandler` type
- Keep old `ActionHookHandler` for backwards compatibility (deprecated)

### 2. Unified Executor (unified-executor.ts)
- Update `ServerConfig` type
- Rename function calls from `onActionHandler` to `onBeforeActionHandler`
- Update `executeAfterHook` to receive and return `result`
- Fix 5 hard-coded error IDs
- Update integration flow

### 3. Auth Handlers (auth-handlers.ts)
- Fix all hard-coded error IDs
- Use `log()` to generate error IDs

### 4. Documentation (action-execution-lifecycle.md)
- Update all hook examples
- Clarify before vs after purposes
- Remove confusing examples

---

## Changes Will Be Made In Order:

1. ✅ Backup all files
2. Update type definitions
3. Update unified-executor.ts (hooks + error IDs)
4. Update auth-handlers.ts (error IDs)
5. Update documentation
6. Run TypeScript checks
7. Run tests
8. Verify all changes

---

**Proceeding with implementation...**
