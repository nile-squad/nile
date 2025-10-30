# Validation Schema Implementation Summary

## Overview
This document summarizes the validation schema implementation across the Nile framework, including the new `read` operation context and the `model.getSchema()` method.

## Changes Made

### 1. Enhanced Validation Utilities (`src/utils/validation-utils.ts`)

#### New Operation Context: `read`
- Added `'read'` as a valid operation context alongside `'create'`, `'update'`, and `'other'`
- **Read operation behavior**: Uses `createSelectSchema` (all table columns) with `.partial().strict()` mode
  - All fields are optional (can query by any subset of columns)
  - Only valid table columns are accepted (rejects unknown fields)
  - Perfect for filtering and search operations

#### Updated Schema Generation Logic
```typescript
if (operation === 'create' || operation === 'update') {
  schema = createInsertSchema(validation.inferTable); // Insert-compatible schema
} else {
  schema = createSelectSchema(validation.inferTable); // Read and other operations
}
```

#### Schema Priority
Changed the priority order to: **custom zodSchema > inferTable > empty passthrough**
- Custom `zodSchema` now takes precedence over `inferTable` when both are provided
- Empty schemas use `.passthrough()` to accept any data

#### Operation-Specific Modes
- **create**: `.strict()` - All required fields must be present, no extra fields
- **update**: `.partial()` - All fields optional, allows incomplete updates
- **read**: `.partial().strict()` - All fields optional, but only valid columns allowed
- **other**: No mode applied, uses base schema as-is

### 2. Model Schema Retrieval (`src/core/orm/index.ts`)

#### New `getSchema(actionName)` Method
All `createModel` instances now expose a `getSchema` method:

```typescript
const model = createModel({ table, dbInstance, config });
const createSchema = model.getSchema('create');
const updateSchema = model.getSchema('update');
const readSchema = model.getSchema('findMany');
```

#### Pre-Generated Schemas
Schemas are pre-generated for all operations during model initialization:
- **CRUD Operations**: `create`, `update`, `deleteById`, `deleteMany`
- **Find Operations**: `findById`, `findByIds`, `findFirst`, `findMany`
- **Bulk Operations**: `createMany`, `updateMany`
- **Atomic Operations**: `increment`, `decrement`
- **Utility Operations**: `count`, `exists`, `distinct`
- **Soft Delete**: `restore`, `forceDelete` (when soft delete enabled)

Benefits:
- ✅ Schemas generated once at initialization
- ✅ Consistent validation across all layers
- ✅ Sub-service validation configs properly integrated
- ✅ External layers can access schemas without calling `getValidationSchema`

### 3. Runtime Validation in ORM Methods (`src/core/orm/crud.ts`, `src/core/orm/bulk.ts`)

All ORM methods now:
1. Retrieve pre-generated schema from `schemaMap`
2. Merge with runtime `options?.validation` if provided
3. Validate data using `safeParse`
4. Return early on validation errors
5. Proceed with DB operation on success

Example:
```typescript
const create = async (data: InsertType, options: ModelOptions = {}): Promise<ModelResult<SelectType>> => {
  const validator = getValidationSchema({
    inferTable: table,
    ...config, // Pre-configured validation
    ...options.validation, // Runtime overrides
    context: { operation: 'create' },
  });
  
  const parsed = validator.safeParse(data);
  if (!parsed.success) {
    return { 
      data: null, 
      error: { 
        type: 'validation', 
        message: 'Validation failed',
        details: parsed.error.flatten()
      } 
    };
  }
  
  // Perform DB operation...
  return { data: result, error: null };
};
```

### 4. Action Factories (`src/core/actions-factory.ts`)

Updated to pass `sub.validation` from sub-services configuration to `createModel`:

```typescript
const model = createModel({
  table,
  dbInstance: db,
  config: {
    ...sub.validation, // ✅ Passes validation config from sub-services
  },
});
```

This ensures sub-service validation overrides (e.g., `omitFields`, `validationMode`) are reflected in:
- Model method validation
- Pre-generated schemas
- RPC and REST schema endpoints

### 5. Action Generators

#### Actions Using `model.getSchema()`
- **create.ts**: `model.getSchema('create')`
- **update.ts**: `model.getSchema('update')`

These validate **table data** being created/updated.

#### Actions Using Custom Schemas
All other actions use custom schemas because they validate **action payloads**, not table data:

- **delete.ts**: Validates `{ id: string }` or `{ filters: array }`
- **find.ts**: Validates `{ id }`, `{ ids }`, `{ filters }`, `{ page, perPage }`
- **atomic.ts**: Validates `{ id, field, value }`
- **utility.ts**: Validates `{ filters }`, `{ field }`
- **relations.ts**: Validates `{ id, options }`

### 6. Interface Compatibility

#### RPC Interface (`src/interfaces/rpc/service-utils.ts`)
Already extracts `a.validation?.zodSchema` correctly:
```typescript
validation: a.validation?.zodSchema 
  ? z.toJSONSchema(a.validation?.zodSchema, { unrepresentable: 'any' })
  : null
```
✅ Works with new schema generation

#### WebSocket Interface (`src/interfaces/ws/ws-server.ts`)
Already extracts `a.validation?.zodSchema` correctly:
```typescript
validation: a.validation?.zodSchema
  ? z.toJSONSchema(a.validation?.zodSchema)
  : null
```
✅ Works with new schema generation

#### REST Interface
Uses the same `getSchemas()` function from RPC utils.
✅ Works with new schema generation

## Test Coverage

### Validation Utils Tests (`src/utils/validation-utils.test.ts`)
Comprehensive tests for:
- ✅ Create operation (strict mode)
- ✅ Update operation (partial mode)
- ✅ Read operation (partial.strict mode)
- ✅ Other operation (default mode)
- ✅ Custom validation modes
- ✅ omitFields handling
- ✅ customValidations
- ✅ validationModifierHandler
- ✅ Custom zodSchema priority
- ✅ Edge cases (empty schemas, no sources)

### Model Tests (`src/core/__tests__/create-models.test.ts`)
New schema retrieval tests:
- ✅ `getSchema()` method exists
- ✅ Returns schemas for all operations
- ✅ Schemas validate correctly (strict vs partial)
- ✅ Respects model config (omitFields)
- ✅ Returns null for unknown actions
- ✅ Different schemas for different operations

### All Tests Passing
```
Test Files  27 passed (27)
Tests       460 passed (460)
```

## Benefits

### 1. Type Safety
- Frontend receives proper TypeScript types instead of `unknown[]`
- Validation schemas match actual table structures

### 2. Consistency
- Same validation logic across all layers (ORM, Actions, RPC, REST, WS)
- Sub-service configs properly propagated everywhere

### 3. Performance
- Schemas pre-generated at initialization
- No repeated schema generation on each request

### 4. Flexibility
- Runtime validation overrides still supported
- Custom zodSchemas can override inferred schemas
- Validation modes can be set per operation

### 5. Developer Experience
- Clear separation between action payload validation and table data validation
- `model.getSchema()` provides easy access to validation schemas
- Comprehensive test coverage ensures correctness

## Usage Examples

### Direct Model Usage (Backend)
```typescript
const userModel = createModel({
  table: users,
  dbInstance: db,
  config: {
    omitFields: ['created_at', 'updated_at'],
  },
});

// Uses pre-generated schema with omitFields
const { data, error } = await userModel.create({ 
  name: 'John', 
  email: 'john@example.com' 
});

// Get the schema for external use
const createSchema = userModel.getSchema('create');
```

### Sub-Service Usage (Factory)
```typescript
const subServices = [
  {
    name: 'users',
    tableName: 'users',
    validation: {
      validationMode: 'auto',
      omitFields: ['id', 'created_at', 'updated_at'],
    },
  },
];

// Factory creates model with sub.validation
// All actions get correct schemas
// RPC/REST endpoints expose correct schemas
```

### Frontend Type Generation
```typescript
// generate-api.ts calls rpc.getSchemas()
// Each action now has proper validation schema
// json-schema-to-typescript generates correct types

export interface SubscriptionPlansFindMany {
  page?: number;
  perPage?: number;
  sort?: SortOption[];      // ✅ Proper type
  filters?: FilterOption[]; // ✅ Proper type
}
```

## Files Modified

1. `nile/src/utils/validation-utils.ts` - Added read operation, fixed priority
2. `nile/src/core/orm/index.ts` - Added schemaMap and getSchema method
3. `nile/src/core/orm/types.ts` - Updated ModelOptions type
4. `nile/src/core/orm/crud.ts` - Added runtime validation
5. `nile/src/core/orm/bulk.ts` - Added runtime validation
6. `nile/src/core/actions-factory.ts` - Pass sub.validation to createModel
7. `nile/src/core/actions/create.ts` - Use model.getSchema('create')
8. `nile/src/core/actions/update.ts` - Use model.getSchema('update')
9. `nile/src/core/actions/delete.ts` - Use custom payload schemas
10. `nile/src/utils/validation-utils.test.ts` - Comprehensive tests
11. `nile/src/core/__tests__/create-models.test.ts` - Schema retrieval tests

## Next Steps

1. ✅ All tests passing (460/460)
2. ✅ Build successful
3. ✅ No linter errors
4. ⏳ User publishes new nile version
5. ⏳ Install new version in backend
6. ⏳ Run `pnpm generate:api` to regenerate types
7. ⏳ Verify frontend types are correct

## Notes

- The implementation maintains backward compatibility
- Existing direct `createModel` usage works without changes
- Sub-service validation configs now properly propagate
- No breaking changes to existing APIs

