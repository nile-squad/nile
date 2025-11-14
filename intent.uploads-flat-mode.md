# Nile Uploads: Flat Mode Support

**Date:** November 14, 2025  
**Author:** Hussein Kizz  
**Context:** User requested flat payload structure support for file uploads

## Original Intent

User reported that Nile's structured payload format (`{ fields, files }`) is restrictive and doesn't support flat structure like Shot HTTP client and other common tools where files and fields are sent with arbitrary keys in FormData.

**Current behavior:**
- All multipart uploads are parsed as `{ fields: {...}, files: {...} }`
- Handlers must destructure `data.fields.name` and `data.files.avatar`
- No option for simpler flat-style submission

**User request:**
- Support flat payload submission (like Shot: `action=upload&title=foo&document=@file`)
- Internally aggregate to `{ fields, files }` so handlers remain consistent
- Detect and error on conflicts (same key used for both file and non-file)
- Duplicate keys aggregate into arrays
- Per-action opt-in with flat as default

## Design Decision

**Changes:**
1. Add `uploadMode?: 'flat' | 'structured'` to `isSpecial` config (default: `'flat'`)
2. Create `parseFormDataFlat()` that:
   - Accepts any FormData key (except `action`, `auth_token`)
   - Routes files to `files` bucket, strings to `fields` bucket
   - Detects conflicts (same key as both file and string) → 400 error
   - Aggregates duplicates into arrays
   - Returns same `{ fields, files }` shape as structured mode
3. Update `rest-server.ts` to dispatch parser based on action's `uploadMode`
4. Handlers unchanged (always receive `{ fields, files }`)
5. Add tests for flat mode, conflicts, and aggregation
6. Document in `uploads-handling.md`

## Files Modified
- `nile/src/types/actions.ts` - Add uploadMode to isSpecial
- `nile/src/interfaces/rest/uploads/parse-formdata.ts` - Add flat parser + conflict detection
- `nile/src/interfaces/rest/rest-server.ts` - Dispatch logic based on uploadMode
- `nile/src/interfaces/rest/__tests__/parse-formdata.test.ts` - Add flat mode tests
- `nile/docs/uploads-handling.md` - Document uploadMode behavior

## Backward Compatibility
- Existing actions without `uploadMode` default to `'flat'` (most permissive)
- Actions with `uploadMode: 'structured'` behave exactly as before
- Handler shape never changes (`{ fields, files }`)
- All existing validations (size, count, allowlist) remain unchanged

## Testing Strategy
- Unit tests for flat parsing with duplicates
- Unit tests for conflict detection
- Integration test with Shot-like flat payloads
- Ensure structured mode still works as before

## Rollout
1. Implement changes in Nile package
2. Build and pack new .tgz
3. Install in backend
4. Test with backend upload actions
5. Update backend actions to use `uploadMode: 'flat'` if needed (or rely on default)
