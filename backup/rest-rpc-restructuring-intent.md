# Documentation Restructuring Intent

**Date:** October 28, 2025  
**File:** rest-rpc.spec.md  
**Scope:** Major restructuring to reduce duplication and improve documentation organization

## Original Issue

The `rest-rpc.spec.md` file (1,857 lines) contains significant duplication and covers topics that are better suited for separate documents:

- Section 5 (Hook System Architecture) - overlaps with action-hooks.md
- Section 6 (Agent Integration) - duplicates agentic.spec.md
- Section 7 (Database Model System) - duplicates create-models.md
- Section 9 (Authentication) - duplicates auth.md
- Section 10 (Global Action Hooks) - duplicates action-hooks.md
- Section 3.11 (Action-Level Hooks) - should be its own document

## Goals

1. **Create action-level-hooks.md** - Extract Section 3.11 (lines 1611-1686) into a dedicated document covering action-specific hooks
2. **Enhance action-hooks.md** - Move hook system architecture from Section 5 (lines 113-179) to action-hooks.md
3. **Remove duplicates from rest-rpc.spec.md**:
   - Section 6 (Agent Integration) - reference agentic.spec.md instead
   - Section 7 (Database Models) - reference create-models.md instead
   - Section 9 (Authentication) - reference auth.md instead
   - Section 10 (Global Action Hooks) - reference action-hooks.md instead
4. **Add cross-references** - Include "See Also" sections linking related docs
5. **Update architecture.md** - Document the new structure

## Expected Outcome

- **rest-rpc.spec.md**: ~800-900 lines (protocol specification only)
- **action-level-hooks.md**: ~400 lines (new document for action-specific hooks)
- **action-hooks.md**: Enhanced with hook system architecture
- Better separation of concerns
- Easier navigation and maintenance
- Less duplication across documentation

## Changes Made

This document will be updated as changes are made.
