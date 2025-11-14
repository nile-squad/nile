# Nile Framework Changelog

## [Unreleased] - Next Major Version

### Added

#### Diagnostics System Enhancements
- **New:** Added `diagnostics` option to `auth` configuration for authentication debugging
- **New:** Added `diagnostics` option to `rateLimiting` configuration for rate limit monitoring
- **New:** Added `diagnostics` option to `agenticConfig` for agentic handler debugging
- **New:** Comprehensive diagnostics documentation in `/docs/monitoring.md`
- **Feature:** Environment-based diagnostic configuration support
- **Feature:** Production-safe diagnostic logging patterns

#### Minimum File Size Validation
- **New:** Added `minFileSize` option to `uploads.limits` configuration
- **Default:** 1 byte (prevents empty file uploads)
- **Feature:** Prevents accidental empty or corrupted file uploads
- **Feature:** Configurable per-application requirements (e.g., avatars must be at least 5KB)
- **Validation:** Fails fast with detailed error messages
- **Documentation:** Complete usage guide in uploads-handling.md and monitoring.md

### Documentation

#### New Files
- `/docs/monitoring.md` - Comprehensive diagnostics and monitoring guide
  - Authentication diagnostics configuration and usage
  - Upload diagnostics with minFileSize validation details
  - Rate limiting diagnostics
  - Agentic handler diagnostics
  - Best practices for production environments
  - Security considerations for diagnostic logging
  - Performance impact analysis
  - Troubleshooting guides

#### Updated Files
- `/docs/uploads-handling.md` - Added minFileSize validation documentation

### Test Coverage

#### New Tests
- `src/interfaces/rest/__tests__/parse-formdata.test.ts` - Added 3 tests for `validateMinFileSize()`
  - Minimum size validation enforcement
  - Default 1 byte minimum
  - Error response structure validation
- **Total:** 512 tests passing (including 3 new minFileSize tests)

### Breaking Changes

#### File Upload System Simplification
- **BREAKING:** Removed flat mode - all file uploads now use structured mode exclusively
- **BREAKING:** Removed `uploads.mode` configuration option
- **BREAKING:** File upload payloads always use `{ fields: {...}, files: {...} }` structure
- **BREAKING:** Duplicate keys automatically aggregate into arrays

**Migration Required:**
```typescript
// Before (flat mode)
handler: async (data) => {
  const file = data.avatar;
  const name = data.name;
}

// After (structured mode - required)
handler: async (data) => {
  const { fields, files } = data;
  const file = files.avatar;
  const name = fields.name;
}
```

**Actions must declare content-type for file uploads:**
```typescript
const action: Action = {
  name: 'uploadFile',
  isSpecial: {
    contentType: 'multipart/form-data'  // REQUIRED
  },
  handler: async (data) => { /* ... */ }
};
```

**Benefits:**
- Eliminates mode switching and backward compatibility complexity
- Predictable, consistent payload structure
- Clear separation between form fields and file data
- Better support for multiple file uploads

See [File Upload Handling Documentation](./uploads-handling.md) for complete migration guide.

## [1.4.6] - 2024-10-30

### Added

#### New `getSchema()` Method on Models
- All `createModel` instances now expose a `getSchema(actionName)` method
- Returns pre-generated Zod validation schemas for any operation
- Available schemas: `'create'`, `'update'`, `'findMany'`, `'deleteById'`, etc.
- Schemas are generated once at initialization for optimal performance
- Returns `null` for unknown action names

#### Read Operation Context for Validation
- Added `'read'` as a valid operation context alongside `'create'`, `'update'`, `'other'`
- Read operations use `.partial().strict()` mode:
  - All fields are optional (can query by any subset of columns)
  - Only valid table columns are accepted (rejects unknown fields)
  - Perfect for filtering and search operations

### Changed

#### Validation Schema Generation
- **Priority Order**: Custom `zodSchema` now takes precedence over `inferTable`
- **Operation-Specific Modes**:
  - `create`: `.strict()` - All required fields, no extra fields
  - `update`: `.partial()` - All fields optional
  - `read`: `.partial().strict()` - Optional fields, only valid columns
  - `other`: No mode applied, uses base schema

#### Schema Pre-Generation
- Schemas are now pre-generated for all operations during model initialization
- Eliminates schema generation overhead on each operation
- Ensures consistency across all layers (ORM, Actions, RPC, REST, WebSocket)
- Sub-service validation configs are properly integrated into pre-generated schemas

#### Runtime Validation in ORM Methods
- All CRUD and bulk methods now perform runtime validation
- Validation uses pre-generated schemas with optional runtime overrides
- Early return on validation errors with detailed error messages
- Maintains existing `{ data, error }` return signature

### Fixed

- Custom `zodSchema` in validation config now properly overrides `inferTable`
- Empty schema handling now correctly uses `.passthrough()` mode
- Delete action schemas now use custom payload validation (not table schemas)
- TypeScript null checks added for schema safety

### Documentation

#### Updated Files
- `/docs/create-models.md` - Added Section 14: Schema Retrieval
  - Complete guide on using `getSchema()` method
  - Examples of schema behavior by operation
  - JSON Schema conversion examples
  
- `/docs/architecture.md` - Added Schema Access section in Model Layer
  - Brief overview of `getSchema()` method
  - Link to detailed documentation

- `/docs/validation-schema-implementation.md` - New comprehensive documentation
  - Complete technical implementation details
  - Changes made to all files
  - Test coverage information
  - Usage examples and best practices

### Test Coverage

#### New Test Files
- `src/utils/validation-utils.test.ts` (19 tests)
  - Tests for all operation contexts (create, update, read, other)
  - Validation mode tests (strict, partial, auto, lenient)
  - Custom validation, omitFields, modifiers
  - Edge cases and error scenarios

#### Updated Test Files
- `src/core/__tests__/create-models.test.ts` - Added Schema Retrieval suite (15 tests)
  - Tests for `getSchema()` method
  - Schema validation by operation type
  - Configuration respect tests
  - Null handling for unknown actions

### Performance Improvements

- **Schema Generation**: One-time generation at model initialization vs. per-request
- **Consistency**: Eliminates duplicate schema generation across layers
- **Type Safety**: Schemas always match table structure

### Breaking Changes

None - All changes are backward compatible. Existing code continues to work without modifications.

### Migration Guide

No migration needed. The new `getSchema()` method is an addition that doesn't affect existing functionality.

**Optional Enhancement**: You can now access validation schemas programmatically:

```typescript
const userModel = createModel({ table: users, dbInstance: db });

// New feature - access schemas
const createSchema = userModel.getSchema('create');
const result = createSchema.safeParse(data);
```

---

## Previous Versions

See git history for changes in versions prior to 1.4.6.

