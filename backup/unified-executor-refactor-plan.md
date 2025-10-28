# Unified Executor Refactoring Plan

## Goal
Reduce cognitive complexity from 42 to under 25 and fix lint issues:
- noExcessiveCognitiveComplexity (complexity 42 -> <25)
- useAtIndex (8 instances of array[length-1])
- noAwaitInLoop (2 instances - before/after hooks)
- Remove unused import (createHookExecutor)

## Strategy

### 1. Extract Helper Functions
Break down `executeUnified` into smaller focused functions:

- `executeActionHooks` - Execute before/after hooks for an action
- `executeBeforeHooks` - Execute before hooks chain
- `executeAfterHooks` - Execute after hooks chain  
- `getLastStageDuration` - Helper to get last stage duration from tracker
- `lookupServiceAndAction` - Extract service/action lookup logic

### 2. Fix Array Access
Replace all `array[array.length - 1]` with `array.at(-1)`

### 3. Fix Await in Loop
The before/after hooks MUST run sequentially (one transforms output for next).
This is not a performance issue - it's required behavior.
Solution: Extract to separate function with clear comment explaining why sequential execution is needed.

### 4. Remove Unused Import
Remove `createHookExecutor` import

## Implementation Steps

1. Create `getLastStageDuration` helper
2. Create `lookupServiceAndAction` helper  
3. Create `executeBeforeHooks` helper (with comment about sequential execution)
4. Create `executeAfterHooks` helper (with comment about sequential execution)
5. Replace array access patterns
6. Remove unused import
7. Test with `pnpm export`
