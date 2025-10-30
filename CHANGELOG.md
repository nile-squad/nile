# Changelog

## [Unreleased]

### Added
- **New 'read' operation for validation**: Added support for `operation: 'read'` in validation context, which uses `createSelectSchema` with `.partial().strict()` to validate that only valid table columns are provided, with all fields optional.
- **New `getSchema()` method on models**: Models now expose a `getSchema(actionName: string)` method that returns the pre-generated Zod validation schema for any action (e.g., 'create', 'update', 'findMany', etc.).
- **Schema pre-generation**: Validation schemas are now pre-generated at model creation time for all operations, improving performance and enabling proper type generation.

### Changed
- **Validation context for updates**: The `update` operation now correctly uses `createInsertSchema` (not `createSelectSchema`) with `.partial()` mode, allowing partial updates while maintaining proper field validation.
- **SubService validation flow**: SubService validation config (omitFields, validationMode, customValidations) now properly flows through to model creation and is reflected in generated API types.
- **ModelConfig interface**: Extended `ModelConfig` to directly accept validation properties (omitFields, validationMode, customValidations, zodSchema, validationModifierHandler) for cleaner API.

### Fixed
- **Auto-generated API types**: Fixed issue where auto-generated TypeScript types from RPC schemas were showing `unknown[]` for filters, sorts, and other fields. They now properly generate typed interfaces based on table schemas.
- **Validation schema extraction**: Action factories now properly extract validation schemas from models using `model.getSchema()`, ensuring schemas are available for RPC/REST schema generation.
- **Config merging**: ORM methods now properly merge model config with runtime options when generating validation schemas.

### Impact
- **Generated TypeScript types**: The `frontend/lib/generated/api-types.ts` file will now contain properly typed interfaces instead of generic `unknown[]` types.
- **No breaking changes**: Existing code continues to work. The changes are additive only - new `getSchema()` method and enhanced validation logic.
- **Better type safety**: Frontend code using generated types will now have full IntelliSense and type checking.

### Technical Details

**Validation Operation Modes:**
- `'create'`: Uses `createInsertSchema().strict()` - all required fields must be present, no extra fields allowed
- `'update'`: Uses `createInsertSchema().partial()` - all fields optional for partial updates
- `'read'`: Uses `createSelectSchema().partial().strict()` - validates column names exist, all optional
- `'other'`: Uses `createSelectSchema()` - for aggregations and other operations

**Schema Flow:**
```
SubService config → createModel (pre-generates schemas) → model.getSchema() → 
Action validation → RPC getSchemas → JSON Schema → TypeScript types
```

---

## Previous versions
[Previous changelog entries remain below]

