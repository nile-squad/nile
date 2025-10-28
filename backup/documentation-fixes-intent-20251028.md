# Documentation Fixes Intent - October 28, 2025

## Purpose
Fix critical API documentation errors discovered during comprehensive documentation audit.

## Scope of Changes

### Critical Fixes (P0)

#### 1. action-hooks.md - COMPLETE REWRITE NEEDED
**Issue:** Entire document uses wrong hook API throughout
- **Wrong API:** `ActionHookHandler` with `(context, action, payload)` signature
- **Correct API:** `OnBeforeActionHandler` and `OnAfterActionHandler` with `({ nileContext, action, payload })` signature
- **Action:** Complete rewrite with correct API, split into before/after hook sections

#### 2. rest-rpc.spec.md Section 10 - HOOK API FIX
**Issue:** Section 10 (lines 502-648) documents wrong global action hook API
- **Wrong:** `ActionHookHandler = (context, action, payload)`
- **Correct:** `OnBeforeActionHandler = ({ nileContext, action, payload })`
- **Wrong config:** `onActionHandler`
- **Correct config:** `onBeforeActionHandler`
- **Action:** Fix all examples and type references in section 10

#### 3. auth.md Section 7.4 - HOOK EXAMPLE FIX
**Issue:** Lines 506-677 show wrong hook API in access control examples
- **Wrong:** `ActionHookHandler = (context, action, payload)`
- **Correct:** `OnBeforeActionHandler = ({ nileContext, action, payload })`
- **Action:** Update all hook examples to use correct API

### Medium Priority Fixes (P1)

#### 4. security.md - BROKEN CODE EXAMPLE
**Issue:** Lines 62-76 use non-existent `createService` function
- **Problem:** Example shows hook configuration that doesn't match actual implementation
- **Action:** Replace with correct example or remove section

### Documentation Restructuring Needed

#### rest-rpc.spec.md - TOO BROAD
**Problem:** Document covers too many topics:
- REST-RPC protocol ✅ (belongs here)
- Hook systems 🔴 (should be in separate docs)
- Agent integration 🔴 (should be in separate docs)
- Authentication 🔴 (already covered in auth.md)
- Database models 🔴 (already covered in create-models.md)

**Recommendation:**
1. Create new docs:
   - `global-action-hooks.md` - Global pre-action hooks (onBeforeActionHandler/onAfterActionHandler)
   - `action-level-hooks.md` - Action-specific before/after hooks
   - `agentic-integration.md` - Agent mode and AI integration
2. Keep in rest-rpc.spec.md:
   - Protocol specification
   - Endpoint documentation
   - Request/response formats
   - Discovery flow
3. Reference other docs where appropriate

## Original Intent (User Request)
User requested comprehensive documentation audit and fixes for all inaccuracies, particularly:
- Wrong action hook API (most common error)
- Outdated implementation status
- Incorrect file paths
- Broken code examples

## Implementation Strategy
1. ✅ Backup all files before modification
2. Fix P0 critical issues first (wrong hook API)
3. Fix P1 medium issues (broken examples)
4. Restructure documentation as needed
5. Update cross-references between docs
6. Validate all code examples against actual implementation

## Files Being Modified
- action-hooks.md (complete rewrite)
- rest-rpc.spec.md (section 10 fix + potential restructure)
- auth.md (section 7.4 fix)
- security.md (broken example fix)

## Files Created (Backups)
- backup/action-hooks-20251028-pre-fix.md
- backup/rest-rpc.spec-20251028-pre-fix.md
- backup/auth-20251028-pre-fix.md
- backup/security-20251028-pre-fix.md

## Success Criteria
- All hook API examples use correct `OnBeforeActionHandler`/`OnAfterActionHandler` types
- All examples use destructured `{ nileContext, action, payload }` parameters
- All config references use `onBeforeActionHandler` not `onActionHandler`
- No broken code examples
- Clear separation of concerns in documentation structure
