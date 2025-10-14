# Implementation Guide: Actions Factory Pattern

**Version:** 1.0  
**Date:** August 13, 2025  
**Author:** Hussein Kizz

**⚠️ Internal Development Guide**  
This document is for developers working on the Nile framework itself, not for developers using Nile as a backend framework.

This explains the internal implementation details and patterns for the separation of concerns between the actions factory and the model layer in the Nile framework.

## Overview

The Nile framework follows a clear separation of concerns where:
- **Actions Factory**: Handles high-level orchestration and action definition
- **Model Layer**: Handles all validation, data processing, and database operations

## Architecture

```
┌─────────────────────────────────────┐
│           Actions Factory            │
│  • High-level action definitions    │
│  • Action handlers (orchestration)  │
│  • Minimal validation config        │
└─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────┐
│            Model Layer               │
│  • All validation processing        │
│  • Database operations              │
│  • Error handling                   │
│  • Data transformation              │
└─────────────────────────────────────┘
```

## Actions Factory Responsibilities

### 1. Action Definition
The actions factory defines the high-level structure of actions:

```typescript
const newAction: Action = {
  name: "create",
  type: "auto",
  description: `Create a new record in ${sub.tableName}`,
  isProtected: !sub.publicActions?.includes("create"),
  handler: createActionHandler,
  validation: sub.validation || {}, // Minimal config
};
```

### 2. Action Handlers
Action handlers are simple orchestrators that call model methods:

```typescript
const createActionHandler: ActionHandler = async (data) => {
  // Pass validation config to model
  const _options = sub.validation
    ? { validation: { ...sub.validation } }
    : { validation: { context: { operation: "create" } } };

  // Delegate to model - model handles all validation
  const { data: result, errors } = await model.createItem(data, _options);
  
  if (errors.length) {
    return safeError(`Error creating new record in ${tableName}`, error_id);
  }
  
  return Ok(result);
};
```

### 3. Validation Configuration
The actions factory only provides minimal validation configuration:

- **For CRUD operations**: Pass `sub.validation || {}` and let the model handle table inference
- **For custom operations**: Define only the minimal Zod schema needed for specific parameters
- **For no-validation operations**: Use empty validation object `{}`

## Model Layer Responsibilities

### 1. Validation Processing
The model layer (`create-models.ts`) handles all validation processing:

```typescript
const create = async (dataInput: InsertType, options: ModelOptions = {}) => {
  // Model handles validation schema generation
  let validator = getValidationSchema({
    inferTable: table,
    validationMode: 'auto',
  });

  if (options.validation) {
    validator = getValidationSchema({
      ...options.validation,
      inferTable: table,
    });
  }

  // Model handles validation execution
  const parsed = validator.safeParse(dataInput);
  if (!parsed.success) {
    return { data: null, errors: [formatError(parsed.error)], validation: validator };
  }

  // Model handles database operations
  // ...
};
```

### 2. Database Operations
All database operations are handled by the model layer:

- **CRUD Operations**: `createItem`, `updateItem`, `deleteOne`, etc.
- **Query Operations**: `getOne`, `getMany`, `getAll`, etc.
- **Transaction Management**: Database transactions and rollbacks
- **Data Transformation**: Parsing/stringifying JSON columns, data formatting

### 3. Error Handling
The model layer provides consistent error handling:

```typescript
// Consistent error format across all model methods
return { 
  data: null, 
  errors: [`Error in create: ${error}`], 
  validation: validator 
};
```

## Benefits of This Separation

### 1. **Cleaner Code**
- Actions factory focuses on orchestration
- Model layer focuses on data operations
- Clear boundaries between concerns

### 2. **Better Maintainability**
- All validation logic centralized in `create-models.ts`
- Changes to validation don't affect action definitions
- Easier to test and debug

### 3. **Consistent Behavior**
- All model operations use the same validation system
- Uniform error handling across all operations
- Predictable API behavior

### 4. **Proper Abstraction**
- Factory focuses on action orchestration
- Model focuses on data operations
- Clear separation of responsibilities

## Examples

### Flexible getAll Action
The `getAll` action demonstrates the separation:

```typescript
// Actions Factory - Simple handler
const getAllActionHandler: ActionHandler = async (data) => {
  const { property, value } = data;
  
  // Delegate to model with flexible parameters
  const { data: result, errors } = await model.getMany({
    basedOnProperty: property,
    withValue: value,
  });
  
  if (errors.length) {
    return safeError(`Error getting records from ${tableName}`, error_id);
  }
  
  return Ok(result);
};

// Actions Factory - Custom validation for parameters
const newAction: Action = {
  name: "getAll",
  handler: getAllActionHandler,
  validation: {
    zodSchema: z.object({
      property: z.string().min(1, "Property name is required"),
      value: z.any(),
    }),
  },
};
```

### CRUD Operations
CRUD operations demonstrate minimal configuration:

```typescript
// Actions Factory - Minimal config, model handles everything
const newAction: Action = {
  name: "create",
  handler: createActionHandler,
  validation: sub.validation || {}, // Model handles table inference
};
```

## Best Practices

### 1. **Keep Actions Factory Simple**
- Don't add complex validation logic
- Don't duplicate model functionality
- Focus on orchestration only

### 2. **Let Models Handle Validation**
- Use `getValidationSchema()` in models
- Pass validation config from factory to model
- Let models handle table inference

### 3. **Consistent Error Handling**
- Use `SafeResult` pattern throughout
- Let models handle error formatting
- Propagate errors from models to actions

### 4. **Clear Boundaries**
- Factory: Action definition and orchestration
- Model: Validation, database operations, error handling
- Don't mix concerns between layers

This separation ensures that the Nile framework remains maintainable, testable, and follows proper software architecture principles.

**Author:** [Hussein Kizz](https://github.com/Hussseinkizz) at Nile Squad Labz

*This specification reflects the current implementation and is subject to evolution. Contributions and feedback are welcome.*
