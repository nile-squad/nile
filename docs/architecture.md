# Nile Framework: Official Backend Architecture

**Version:** 1.0  
**Date:** August 13, 2025  
**Author:** Hussein Kizz

This document outlines the official, layered architecture for building robust and scalable backend systems using the Nile framework. Adherence to this structure is crucial for maintainability, testability, and team collaboration.

## 1. Core Principles

- **Separation of Concerns**: Each layer has a single, well-defined responsibility. Logic from one layer must not bleed into another.
- **Unidirectional Data Flow**: Data and control flow in a single direction, making the system predictable and easier to debug.
- **Modularity**: Features like validation, services, and models are defined in their own modules and composed together at a higher level.
- **Predictable Runtimes**: All service handlers follow a strict contract for inputs, outputs, and error handling, ensuring API consistency.

## 2. The Unidirectional Data Flow

The flow of a request is always top-down. Each layer can only call the layer directly beneath it.

```
   [Client Request]
          |
          v
+---------------------+
|   1. API Layer      |  (REST-RPC Engine)
+---------------------+
          |
          v
+---------------------+
|   2. Service Layer  |  (Business Logic: Custom Actions & Auto-Generated Subs)
+---------------------+
          |
          v
+---------------------+
|   3. Model Layer    |  (Data Access Layer)
+---------------------+
          |
          v
+---------------------+
|   4. Schema Layer   |  (Database Definition)
+---------------------+
          |
          v
+---------------------+
|   5. Validation Layer |  (Zod Schemas)
+---------------------+
```

---

## 3. The Five Layers Explained

### Layer 5: The Validation Layer

- **Location**: `backend/validations/`
- **Role**: To define all Zod validation schemas. This creates a single source of truth for data shapes, decoupled from the business logic itself.
- **Rules**:
    - **MUST**: Contain only Zod schema definitions.
    - **MUST**: Be organized by domain (e.g., `auth.ts`, `complaints.ts`).
    - **MUST NOT**: Contain any business logic.

### Layer 4: The Schema Layer

- **Location**: `backend/db/schemas/`
- **Role**: To define the database table structures using Drizzle ORM.
- **Rules**:
    - **MUST**: Contain only Drizzle table definitions (`pgTable`).
    - **MUST NOT**: Contain any functions or business logic.

### Layer 3: The Model Layer

- **Location**: `backend/db/models/`
- **Role**: The **Data Access Layer (DAL)**. Its sole responsibility is to provide a programmatic interface for performing atomic, business-logic-free CRUD operations.
- **Rules**:
    - **MUST**: Contain only functions that directly interact with the database.
    - **MUST NOT**: Contain any business rules, validation logic, or state orchestration.
- **Example (`backend/db/models/users.ts`):**
  ```typescript
  import { db } from '../client';
  import { users } from '../schemas';
  import { createModel } from '@nile-squad/nile';

  export const usersModel = createModel({ table: users, dbInstance: db });

  export const findUserByEmail = (email: string) => {
    return usersModel.getOne({ basedOnProperty: 'email', withValue: email });
  };
  ```

### Layer 2: The Service Layer (Business Logic)

This is where all business processes are defined. It has two components:

#### A. Auto-Generated CRUD Services (`subs`)

- **Location**: `backend/services/db/subs/`
- **Purpose**: Define configuration objects that tell Nile to automatically generate CRUD actions for your database tables. This eliminates boilerplate while maintaining full control over validation and behavior.
- **Why Use This**: Instead of writing repetitive CRUD handlers, you configure once and get a complete, validated API for each table.
- **Rules**:
    - **MUST**: Only contain configuration objects conforming to the `SubService` type.
    - **SHOULD**: Only provide a `validation` property if you need to override or customize the default validation behavior. By default, Nile infers the schema from the Drizzle table definition.
    - **SEPARATION OF CONCERNS**: Focus on configuration, let Nile handle the implementation details
- **Example (`backend/services/db/subs/wifi.ts`):**
  ```typescript
  import { createComplaintSchema } from '@/validations/complaints';

  export const wifiSubs: SubService[] = [{
    name: 'complaints',
    tableName: 'complaints',
    idName: 'id',
    // The 'validation' property is optional. If omitted, Nile would
    // automatically generate a Zod schema from the 'complaints' table schema.
    validation: { zodSchema: createComplaintSchema },
  }];
  ```

##### Flexible Filtering with getAll Action

The auto-generated `getAll` action supports flexible filtering by accepting any property/value pair, making your APIs more adaptable:

```typescript
// Example: Filter by any column in your table
const result = await model.getMany({
  basedOnProperty: 'organization_id',  // Any database column
  withValue: '550e8400-e29b-41d4-a716-446655440000'
});
```

**Why This Matters for Your Application:**
- **Dynamic Filtering**: Filter by any database column, not just hardcoded fields
- **Reusable Actions**: Same action works for different filtering needs across your app
- **Type-Safe**: Nile ensures the property exists in your schema
- **Consistent Patterns**: Same approach works across all your auto-generated actions
- **Future-Proof**: Add new columns to your schema and immediately filter by them

##### Advanced Validation Customization
The `validation` object provides powerful customization options beyond a simple schema override. These are especially useful for tailoring the auto-generated `create` and `update` actions.

-   **`omitFields`**: An array of field names (as strings) to exclude from the auto-generated schema. Useful for hiding internal or sensitive fields (e.g., `passwordHash`) from the API.
-   **`customValidations`**: An object containing Zod types to extend the base schema. You can add new, API-only fields (like `sendWelcomeEmail`) or override the types of existing fields.
-   **`validationModifierHandler`**: For complex logic, this function receives the generated Zod schema as an argument and can return a new, modified version. This is the most flexible option for advanced scenarios.
-   **`validationMode`**: Controls schema strictness. Defaults to `'auto'`, which enforces that all fields are present for `create` operations (`strict`) but makes all fields optional for `update` operations (`partial`). You can explicitly set it to `'strict'` or `'partial'` to override this behavior for both operations.

**Example of advanced validation:**

```typescript
// backend/services/db/subs/users.ts
import { users } from '@/backend/db/schemas';
import { z } from 'zod';

export const usersSubs: SubService[] = [{
  name: 'users',
  tableName: 'users',
  idName: 'id',
  // Example of customizing the auto-generated validation
  validation: {
    // 1. Omit internal fields from the API
    omitFields: ['passwordHash', 'internalNotes'],
    // 2. Add a new, required field just for the 'create' action
    customValidations: {
      sendWelcomeEmail: z.boolean().default(true),
    },
  },
}];
```

#### B. Custom Business Actions & Handlers

- **Location**: Handlers in `backend/services/db/[domain]/`, composed in `backend/services/db/actions.ts`.
- **Role**: To define all complex, multi-step business workflows. An `action` orchestrates calls to one or more `models`.

#### Handler Implementation Rules
All custom action handlers **must** adhere to the following contract to ensure predictability and robustness.

1.  **Trust the Engine for Validation**: The handler's `payload` is already validated against the Zod schema defined in the action. Do not re-validate.
2.  **Perform Defensive Runtime Checks**: The handler is responsible for runtime checks that a schema cannot enforce. For example, verifying that a record fetched from the database has the correct status before proceeding.
3.  **Consistent Signature**: All handlers must match the `ActionHandler` type: `(payload: T, context: C) => Promise<SafeResult<U>>`.
4.  **Always Return a `SafeResult`**: Every possible exit path of a handler must return either `Ok(data)` on success or `safeError(message)` on failure. This creates a predictable API contract.
5.  **Prefer `safeTry` Over `try/catch`**: To maintain consistency and ensure all errors are handled gracefully as `SafeResult` objects, traditional `try/catch` blocks are discouraged. Any code that could throw an unexpected exception (e.g., a third-party API call) **MUST** be wrapped in a `safeTry` block. This guarantees that any exception is caught and converted into a `safeError`, preserving the predictable API contract.

- **Example Workflow:**
  1.  **Define the Handler (`backend/services/db/complaints/assign.ts`):**
      ```typescript
      import { Ok, safeError, isError, type ActionHandler } from '@nile-squad/nile';
      import * as agentModel from '@/backend/db/models/agents';
      import * as complaintModel from '@/backend/db/models/complaints';

      export const assignComplaintHandler: ActionHandler = async (payload) => {
        const { complaintId, agentId } = payload; // Payload is already validated

        // 1. Call the Model Layer to get data
        const agentResult = await agentModel.getById(agentId);
        if (isError(agentResult)) return agentResult; // Propagate error

        // 2. Perform Defensive Runtime Check
        if (!agentResult.data || agentResult.data.status !== 'active') {
          return safeError('Agent is not valid for assignment.');
        }

        // 3. Orchestrate State Change by calling the Model Layer
        const updateData = { status: 'assigned', assignedToAgentId: agentId };
        const updateResult = await complaintModel.update(complaintId, updateData);
        if (isError(updateResult)) return updateResult; // Propagate error

        // 4. Return success with a SafeResult
        return Ok(updateResult.data);
       };
       ```
   2.  **Define and Export the Action (`backend/services/db/actions.ts`):**
       ```typescript
       import { assignComplaintHandler } from './complaints/assign';
       import { assignComplaintSchema } from '@/validations/complaints';
 
       export const dbActions: Action[] = [{
         name: 'complaints.assign',
         description: 'Assigns a complaint to an active agent.',
         handler: assignComplaintHandler,
         validation: { zodSchema: assignComplaintSchema },
       }];
       ```

### Handling Atomic Operations with Transactions

For complex workflows that involve multiple database writes (e.g., creating a user and their company in a single operation), it is crucial to use database transactions to ensure atomicity. This guarantees that all operations succeed or none of them do, preventing partial data states.

The transaction should be managed entirely within the **Service Layer Handler**.

**Rules for Transactions:**

1.  **Initiate in Service Layer**: Wrap the sequence of operations in `db.transaction(async (tx) => { ... })`.
2.  **Pass the Transaction Handle**: The `tx` object provided by the transaction callback **MUST** be passed down to every model layer function that needs to participate in the transaction. The model functions in Nile are built to accept this handle.
3.  **Throw to Rollback**: To abort the transaction and trigger a rollback, you **MUST** `throw` an error from within the transaction block. A simple `return safeError(...)` will not trigger a rollback.
4.  **Catch Errors Outside**: Use a `try/catch` block *around* the `db.transaction` call to catch any thrown errors and return a final, user-friendly `safeError`.

**Example: Creating a User and Company Atomically**

```typescript
// backend/services/db/auth/signup.ts
import { db } from '@/backend/db';
import * as userModel from '@/backend/db/models/users';
import * as companyModel from '@/backend/db/models/companies';
import { Ok, safeError, type ActionHandler } from '@nile-squad/nile';

export const signupHandler: ActionHandler = async (payload) => {
  try {
    // The result of the transaction is returned.
    const result = await db.transaction(async (tx) => {
      // 1. Create the user, passing the transaction handle `tx`.
      const userResult = await userModel.create({ email: payload.email }, { transactionPointer: tx });
      if (isError(userResult)) {
        // 2. Throwing an error here will roll back the entire transaction.
        throw new Error('Failed to create user.');
      }

      // 3. Create the company, also using `tx`.
      const companyData = { name: payload.companyName, ownerId: userResult.data.id };
      const companyResult = await companyModel.create(companyData, { transactionPointer: tx });
      if (isError(companyResult)) {
        // This will also trigger a rollback of the user creation.
        throw new Error('Failed to create company.');
      }

      // 4. If all operations succeed, return the final data.
      // This will be committed to the database.
      return { user: userResult.data, company: companyResult.data };
    });

    // If the transaction was successful, wrap the result in Ok.
    return Ok(result);

  } catch (error: any) {
    // 5. The error thrown inside the transaction is caught here.
    // The transaction has already been rolled back.
    return safeError(error.message || 'An unexpected error occurred during signup.');
  }
};
```


### Layer 1: The API Layer

- **Location**: Handled internally by the Nile REST-RPC engine, configured in `backend/server.config.ts`.
- **Role**: To expose all registered `actions` as API endpoints, handle HTTP requests, perform validation, and call the appropriate action `handler`.
- **Composition**: The `backend/services/db/index.ts` file assembles the `subs` and `actions` into a single service definition, which is then passed to the engine.
  ```typescript
  // backend/services/db/index.ts
  export const dbService: Service = {
    name: 'db',
    actions: dbActions, // Custom actions
    autoService: true,
    subs: subServices, // Auto-generated actions
  };
  ```
This architecture ensures a clean, decoupled, and highly scalable system.

**Author:** [Hussein Kizz](https://github.com/Hussseinkizz) at Nile Squad Labz

*This specification reflects the current implementation and is subject to evolution. Contributions and feedback are welcome.*
