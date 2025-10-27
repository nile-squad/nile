# Refactor intent for crud.ts (findFirst)

## Purpose
Reduce cognitive complexity in the `findFirst` function in `src/core/orm/crud.ts` to pass lint/style checks (max complexity 25).

## Scope
- Collapse nested error handling in the catch block
- Use early returns and helper functions for error formatting
- Reduce conditional branches and improve readability
- No change to external interface or behavior

## Original User Intent
- Pass all lint/style/type checks after pnpm export
- Follow AGENTS.md and project coding rules
- Always backup before refactoring

## Impact
- Improved maintainability and readability
- No change to function signature or output
- All changes documented and reversible via backup
