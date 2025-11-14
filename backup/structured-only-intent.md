# Upload System Simplification - Structured Mode Only

**Date:** November 14, 2025  
**Author:** Hussein Kizz  
**Type:** Breaking Change Implementation

## User Intent

Eliminate backward compatibility and mode guessing in the file upload system. Enforce strict, predictable behavior:

1. **Structured Mode Only**: Remove flat mode entirely. Always separate `fields` and `files` objects
2. **Array Aggregation**: Always aggregate duplicate keys into arrays
3. **Strict Content-Type Enforcement**: Actions MUST declare `isSpecial.contentType: 'multipart/form-data'` to receive FormData
4. **Better Documentation**: Add frontend fetch/FormData examples alongside curl examples

## Rationale

- **Eliminate Ambiguity**: No mode switching or backward compatibility guessing
- **Predictable Behavior**: Developers always know exactly what payload structure to expect
- **Clearer Intent**: Actions explicitly declare they handle file uploads
- **Better DX**: Frontend examples help developers implement uploads correctly

## Scope of Changes

### Files to Modify

1. **docs/uploads-handling.md** (908 lines → ~650 lines)
   - Remove all flat mode documentation (Sections 3.1, 9.1)
   - Remove mode configuration option
   - Make structured mode the default and only behavior
   - Add frontend fetch/FormData examples throughout
   - Simplify migration guide (no backward compatibility)
   - Update all handler examples to use `{ fields, files }` structure

2. **src/interfaces/rest/uploads/parse-formdata.ts** (405 lines → ~300 lines)
   - Remove `ParseMode` type ('flat' | 'structured')
   - Remove `parseFormDataFlat()` function
   - Remove `mode` parameter from `parseFormData()`
   - Always return `StructuredPayload` type
   - Simplify configuration type

3. **src/interfaces/rest/rest-server.ts** (lines 97-111, 319-320)
   - Remove `mode` option from `uploads` config
   - Remove mode selection logic (line 319)
   - Always call structured parsing

4. **docs/rest-rpc.spec.md** (Section 3.6)
   - Update quick reference to reflect structured-only mode
   - Remove mode options from configuration examples

5. **CHANGELOG.md**
   - Add breaking change note for v2.0.0 or next major version

### Implementation Details

#### Parse FormData Changes

**Before:**
```typescript
type ParseMode = 'flat' | 'structured';
function parseFormData(formData: FormData, mode: ParseMode = 'flat')
```

**After:**
```typescript
// No mode type needed
function parseFormData(formData: FormData): StructuredPayload
```

#### Configuration Changes

**Before:**
```typescript
uploads: {
  mode: 'flat' | 'structured',  // Choose mode
  enforceContentType: true,
  // ...
}
```

**After:**
```typescript
uploads: {
  // No mode option - always structured
  enforceContentType: true,  // Default: true
  // ...
}
```

#### Handler Pattern

**Only Pattern (Structured):**
```typescript
handler: async (data, context) => {
  const { fields, files } = data;
  
  // Access form fields
  const title = fields.title as string;
  const tags = Array.isArray(fields.tags) ? fields.tags : [fields.tags];
  
  // Access files
  const documents = Array.isArray(files.documents) 
    ? files.documents 
    : [files.documents];
  
  // Process...
}
```

### Content-Type Enforcement

Actions MUST declare content-type requirements:

```typescript
const uploadAction: Action = {
  name: 'uploadAvatar',
  isSpecial: {
    contentType: 'multipart/form-data'  // REQUIRED for uploads
  },
  handler: async (data) => {
    const { fields, files } = data;
    // Handler logic
  }
};
```

Without this declaration, the action won't receive FormData properly (enforced by default).

### Frontend Examples to Add

Add these patterns throughout the documentation:

**Browser Fetch:**
```javascript
// Single file upload
const formData = new FormData();
formData.append('action', 'uploadAvatar');
formData.append('userId', '123');
formData.append('avatar', fileInput.files[0]);

const response = await fetch('http://localhost:9000/api/v1/services/users', {
  method: 'POST',
  body: formData
});
```

**Multiple Files:**
```javascript
const formData = new FormData();
formData.append('action', 'uploadDocuments');
formData.append('title', 'Project Files');

// Add multiple files
for (const file of fileInput.files) {
  formData.append('documents', file);
}

const response = await fetch('http://localhost:9000/api/v1/services/documents', {
  method: 'POST',
  body: formData
});
```

**With Progress Tracking:**
```javascript
const xhr = new XMLHttpRequest();

xhr.upload.addEventListener('progress', (e) => {
  if (e.lengthComputable) {
    const percentComplete = (e.loaded / e.total) * 100;
    console.log(`Upload progress: ${percentComplete}%`);
  }
});

xhr.open('POST', 'http://localhost:9000/api/v1/services/users');
xhr.send(formData);
```

## Breaking Changes

1. **Removed flat mode** - All handlers must use `{ fields, files }` structure
2. **Removed mode configuration** - No `uploads.mode` option
3. **Strict content-type enforcement** - Actions must declare `isSpecial.contentType`

## Migration Path

### For Existing Applications

1. **Add content-type declaration** to all upload actions:
   ```typescript
   isSpecial: { contentType: 'multipart/form-data' }
   ```

2. **Update handlers** to use structured payload:
   ```typescript
   // Before
   const file = data.avatar;
   
   // After
   const file = data.files.avatar;
   ```

3. **Remove mode configuration** from server config:
   ```typescript
   // Remove this:
   uploads: { mode: 'structured' }
   
   // Keep this:
   uploads: { limits: {...}, allow: {...} }
   ```

## Testing Requirements

- Update all upload-related tests to use structured payload
- Verify content-type enforcement works correctly
- Test multiple file uploads aggregate into arrays
- Test mixed fields and files
- Verify error responses for missing content-type declaration

## Timeline

- **Phase 1:** Documentation updates (uploads-handling.md)
- **Phase 2:** Implementation changes (parse-formdata.ts, rest-server.ts)
- **Phase 3:** Related docs updates (rest-rpc.spec.md, CHANGELOG.md)
- **Phase 4:** Test updates and verification

## Success Criteria

- [ ] No mode switching logic in codebase
- [ ] All handlers use `{ fields, files }` structure
- [ ] Frontend examples present in documentation
- [ ] Content-type enforcement is clear and strict
- [ ] Breaking changes documented in CHANGELOG
- [ ] All tests pass with new structure
