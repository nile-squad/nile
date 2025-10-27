# Create Models Utility - Developer Guide

**Version:** 1.0  
**Date:** October 25, 2024  
**Author:** Hussein Kizz

This guide provides comprehensive instructions for developers on how to use the Create Model Interface (`create-models.ts`) for database operations.

## 1. Overview

The Create Model Interface is a powerful, type-safe database abstraction layer built on top of Drizzle ORM. It provides intuitive methods for database operations with automatic JSON handling, advanced filtering, bulk operations, and soft delete support.

### 1.1 Key Features

- **Type Safety**: Full TypeScript support with inferred types from your schema
- **Advanced Filtering**: Support for complex nested conditions with OR/AND logic
- **Smart JSON Handling**: Automatic parsing/stringifying of JSON columns
- **Bulk Operations**: Efficient batch processing methods
- **Soft Delete Support**: Built-in soft delete functionality
- **Aggregation Operations**: Built-in aggregation and grouping methods
- **Atomic Operations**: Increment/decrement operations

## 2. Installation and Setup

### 2.1 Dependencies

```bash
pnpm add drizzle-orm drizzle-zod zod
# For PostgreSQL
pnpm add postgres
```

### 2.2 Basic Setup

```typescript
import { createModel } from './core/create-models';
import { users } from './schema/users';
import { db } from './server/db';

// Basic model
const userModel = createModel({
  table: users,
  dbInstance: db
});
```

### 2.3 Model with Configuration

```typescript
const postModel = createModel({
  table: posts,
  dbInstance: db,
  config: {
    dialect: "sqlite", // Use SQLite-specific features
    jsonMode: "stringify", // Explicitly stringify/parse JSON (for SQLite compatibility)
    softDelete: {
      field: 'deleted_at',
      autoFilter: true
    },
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    },
    bulkOperationLimit: 1000
  }
});
```

**Dialect and JSON Mode:**

The ORM supports multiple database dialects (PostgreSQL, SQLite) and provides configuration options for JSON handling:

- **`dialect`**: Specifies the database dialect (`"postgresql"` or `"sqlite"`). Used internally to normalize SQL differences between databases.

- **`jsonMode`**: Controls how JSON columns are handled:
  - `"auto"` (default): Let Drizzle handle JSON automatically - works best with Drizzle's native JSON support
  - `"stringify"`: Explicitly stringify/parse JSON in the ORM layer - better for cross-dialect compatibility

Example with SQLite:
```typescript
const userModel = createModel({
  table: users,
  dbInstance: sqliteDb,
  config: {
    dialect: "sqlite",
    jsonMode: "stringify" // Ensure JSON is properly handled across dialects
  }
});
```

## 3. Basic CRUD Operations

### 3.1 Finding Records

**Find by ID:**

This method retrieves a single record by its unique identifier. It returns null in the data field if the record doesn't exist, with no error. Useful for fetching specific users, posts, or any entity when you have their ID.

```typescript
const { data: user, error } = await userModel.findById('user-123');
if (error) {
  console.error('Database error:', error.message);
  return;
}
if (!user) {
  console.log('User not found');
  return;
}
```

**Find multiple records:**

Retrieves multiple records based on filters, with support for pagination and sorting. Use this when you need to list records with specific criteria. The filters parameter accepts an array of filter conditions that can be combined with AND/OR logic.

```typescript
const { data: users, error } = await userModel.findMany({
  filters: [
    { where: 'status', equals: 'active' }
  ],
  limit: 10
});

if (error) {
  console.error('Error fetching users:', error.message);
  return;
}

console.log(`Found ${users?.length} active users`);
```

**Find records with field selection:**

You can select only specific fields to reduce data transfer and improve performance. This is especially useful for large tables with many columns.

```typescript
// Select only specific fields
const { data: users, error } = await userModel.findMany({
  select: ['id', 'username', 'email'],
  filters: [{ where: 'status', equals: 'active' }]
});

// Returns only: { id: '...', username: '...', email: '...' }
```

**Find by ID with field selection:**

```typescript
const { data: user, error } = await userModel.findById('user-123', {
  select: ['id', 'username', 'profile']
});
```

**Find first record with field selection:**

```typescript
const { data: admin, error } = await userModel.findFirst(
  [{ where: 'role', equals: 'admin' }],
  { select: ['id', 'username'] }
);
```

**Field selection with pagination:**

```typescript
const { data: paginatedUsers, error } = await userModel.findMany({
  select: ['id', 'username', 'email'],
  filters: [{ where: 'status', equals: 'active' }],
  page: 1,
  perPage: 20
});
```

**Find first record:**

Finds the first record matching the given filters. Returns null if no matching record is found. Ideal for fetching a single record that meets specific criteria without pagination.

```typescript
const { data: adminUser, error } = await userModel.findFirst([
  { where: 'role', equals: 'admin' }
]);

if (error) {
  console.error('Error finding admin user:', error.message);
  return;
}

if (!adminUser) {
  console.log('No admin user found');
  return;
}
```

**Find with relations:**

Loads a single record along with its related data using Drizzle's relational query API. This avoids N+1 query problems by loading all related data in a single query. Use this when you need related data along with the primary record.

```typescript
const { data: userWithPosts, error } = await userModel.findWithRelations(
  'user-123',
  { posts: true, comments: true }
);

if (error) {
  console.error('Error loading user with relations:', error.message);
  return;
}
```

### 3.2 Creating Records

**Create single record:**

Creates a new record in the database. All required fields must be provided. JSON columns are automatically stringified when saving. Returns the created record with all generated fields (like timestamps).

```typescript
const { data: newUser, error } = await userModel.create({
  username: 'john_doe',
  email: 'john@example.com',
  profile: {
    firstName: 'John',
    lastName: 'Doe',
    preferences: {
      theme: 'dark',
      notifications: true
    }
  }
});

if (error) {
  if (error.type === 'validation') {
    console.error('Invalid data:', error.details);
  } else {
    console.error('Database error:', error.message);
  }
  return;
}

console.log('User created:', newUser?.id);
```

### 3.3 Updating Records

**Update by ID:**

Updates an existing record by its ID. Automatically updates the `updatedAt` timestamp if configured. All provided fields will be updated, with JSON columns being automatically merged for nested objects.

```typescript
const { data: updatedUser, error } = await userModel.update('user-123', {
  status: 'inactive',
  lastLoginAt: new Date()
});

if (error) {
  console.error('Update failed:', error.message);
  return;
}

if (!updatedUser) {
  console.log('User not found');
  return;
}

console.log('User updated:', updatedUser.id);
```

**Update with deep JSON merging:**

Updates a record with automatic deep merging of JSON columns. When you provide partial JSON updates, the system automatically merges only the changed fields while preserving all other fields. This is essential for nested object updates where you don't want to lose existing data.

```typescript
// User has a profile with multiple fields
const user = {
  id: 'user-123',
  profile: {
    firstName: 'John',
    lastName: 'Doe',
    preferences: {
      theme: 'dark',
      language: 'en',
      notifications: true
    },
    metadata: {
      lastLogin: '2024-01-01',
      loginCount: 5
    }
  }
};

// Update only the theme in preferences
const { data: updatedProfile, error } = await userModel.update('user-123', {
  profile: {
    preferences: {
      theme: 'light' // Only updates theme, preserves language and notifications
    }
  }
});

if (error) {
  console.error('Update failed:', error.message);
  return;
}

// All fields are preserved
console.log(updatedProfile?.profile.firstName); // 'John' (preserved)
console.log(updatedProfile?.profile.lastName); // 'Doe' (preserved)
console.log(updatedProfile?.profile.preferences.theme); // 'light' (updated)
console.log(updatedProfile?.profile.preferences.language); // 'en' (preserved)
console.log(updatedProfile?.profile.preferences.notifications); // true (preserved)
console.log(updatedProfile?.profile.metadata.lastLogin); // '2024-01-01' (preserved)
```

### 3.4 Deleting Records

**Soft delete (if configured):**

Soft deletes mark records as deleted by setting a `deletedAt` timestamp without actually removing them from the database. This allows for data recovery and audit trails.

```typescript
const { data, error } = await postModel.delete('post-123');
if (error) {
  console.error('Delete failed:', error.message);
  return;
}
// Record is now marked as deleted
```

**Hard delete:**

Permanently removes a record from the database. This operation cannot be undone. Use with caution.

```typescript
const { error } = await userModel.delete('user-123');
if (error) {
  console.error('Delete failed:', error.message);
  return;
}
// Record is permanently removed
```

## 4. Advanced Filtering

The filter system provides a flexible and type-safe way to query your database. You can use simple filters for basic queries or combine them with AND/OR logic for complex searches.

### 4.1 Simple Filters

Simple filters allow you to query records based on field values using various operators. Each filter specifies a field (`where`) and an operator with its value.

**Equality:**

Find records where a field equals a specific value. This is the most common filtering operation.

```typescript
const { data: publishedPosts, error } = await postModel.findMany({
  filters: [
    { where: 'status', equals: 'published' }
  ]
});

if (error) {
  console.error('Error fetching posts:', error.message);
  return;
}

console.log(`Found ${publishedPosts?.length} published posts`);
```

**Comparison operators:**

Filter records using comparison operators like `greaterThan`, `lessThan`, etc. Useful for date or numeric range queries.

```typescript
const { data: recentPosts, error } = await postModel.findMany({
  filters: [
    { where: 'createdAt', greaterThan: new Date('2024-01-01') }
  ]
});

if (error) {
  console.error('Error fetching recent posts:', error.message);
  return;
}

console.log(`Found ${recentPosts?.length} recent posts`);
```

**String operations:**

Search for records using pattern matching with `like` (case-sensitive) or `ilike` (case-insensitive). Supports SQL wildcard patterns.

```typescript
const { data: searchResults, error } = await postModel.findMany({
  filters: [
    { where: 'title', like: '%javascript%' }
  ]
});

if (error) {
  console.error('Search failed:', error.message);
  return;
}

console.log(`Found ${searchResults?.length} matching posts`);
```

**Array operations:**

Filter records where a field's value is in a list of values. Efficient for checking multiple possibilities at once.

```typescript
const { data: specificPosts, error } = await postModel.findMany({
  filters: [
    { where: 'id', in: ['post-1', 'post-2', 'post-3'] }
  ]
});

if (error) {
  console.error('Error fetching posts:', error.message);
  return;
}

console.log(`Found ${specificPosts?.length} posts`);
```

### 4.2 Complex Nested Filters

**OR conditions:**

```typescript
const activeOrPremiumUsers = await userModel.findMany({
  filters: [
    {
      or: [
        { where: 'status', equals: 'active' },
        { where: 'subscription', equals: 'premium' }
      ]
    }
  ]
});
```

**AND conditions:**

```typescript
const activePremiumUsers = await userModel.findMany({
  filters: [
    {
      and: [
        { where: 'status', equals: 'active' },
        { where: 'subscription', equals: 'premium' }
      ]
    }
  ]
});
```

**Nested OR and AND:**

```typescript
const complexFilter = await postModel.findMany({
  filters: [
    {
      and: [
        { where: 'status', equals: 'published' },
        {
          or: [
            { where: 'authorId', equals: 'author-1' },
            { where: 'authorId', equals: 'author-2' }
          ]
        }
      ]
    }
  ]
});
```

**Raw SQL filters:**

```typescript
const customFilter = await userModel.findMany({
  filters: [
    { sql: sql`age > 18 AND created_at > ${new Date('2024-01-01')}` }
  ]
});
```

## 5. Bulk Operations

### 5.1 Creating Multiple Records

Efficiently creates multiple records in a single operation. Use this when you need to insert many records at once, as it's significantly faster than individual creates.

```typescript
const { data: newUsers, error } = await userModel.createMany([
  {
    username: 'user1',
    email: 'user1@example.com'
  },
  {
    username: 'user2',
    email: 'user2@example.com'
  }
]);

if (error) {
  console.error('Bulk create failed:', error.message);
  return;
}

console.log(`Created ${newUsers?.length} users`);
```

### 5.2 Updating Multiple Records

Updates multiple records matching the given filters. This method includes validation and automatic deep JSON merging for nested objects, just like the single `update` method. Returns all updated records.

**Key features:**
- Automatic timestamp updates (if configured)
- Deep JSON merging for partial updates
- Validation support
- Bulk operation limit protection

```typescript
const { data: updatedUsers, error } = await userModel.updateMany(
  [{ where: 'status', equals: 'inactive' }],
  { lastLoginAt: new Date() }
);

if (error) {
  console.error('Bulk update failed:', error.message);
  return;
}

console.log(`Updated ${updatedUsers?.length} users`);
```

**With deep JSON merging:**

When updating JSON columns, partial updates are automatically merged with existing data:

```typescript
// Update users' preferences without losing other preference fields
const { data, error } = await userModel.updateMany(
  [{ where: 'role', equals: 'user' }],
  { 
    preferences: { 
      theme: 'dark' // Only updates theme, preserves other preferences
    } 
  }
);
```

### 5.3 Deleting Multiple Records

Deletes multiple records matching the given filters. Returns the count of deleted records. Use this for batch deletions.

```typescript
const { data: deleteResult, error } = await postModel.deleteMany([
  { where: 'status', equals: 'draft' }
]);

if (error) {
  console.error('Bulk delete failed:', error.message);
  return;
}

console.log(`Deleted ${deleteResult?.count} posts`);
```

### 5.4 Upsert Operations

**Single upsert:**

Inserts a record if it doesn't exist, or updates it if it does. Uses the ID field to determine whether to insert or update.

```typescript
const { data: upsertedUser, error } = await userModel.upsert({
  id: 'user-123',
  username: 'john_doe',
  email: 'john@example.com',
  updatedAt: new Date()
});

if (error) {
  console.error('Upsert failed:', error.message);
  return;
}

console.log('User upserted:', upsertedUser?.id);
```

**Bulk upsert:**

Performs upsert operations on multiple records at once. More efficient than multiple individual upserts.

```typescript
const { data: upsertedUsers, error } = await userModel.upsertMany([
  {
    id: 'user-1',
    username: 'user1',
    email: 'user1@example.com'
  },
  {
    id: 'user-2',
    username: 'user2',
    email: 'user2@example.com'
  }
]);

if (error) {
  console.error('Bulk upsert failed:', error.message);
  return;
}

console.log(`Upserted ${upsertedUsers?.length} users`);
```

## 6. Atomic Operations

### 6.1 Increment/Decrement

**Increment a numeric field:**

```typescript
const updatedPost = await postModel.increment('post-123', 'viewCount', 1);
```

**Decrement a numeric field:**

```typescript
const updatedUser = await userModel.decrement('user-123', 'credits', 5);
```

**Increment with custom amount:**

```typescript
const updatedScore = await userModel.increment('user-123', 'score', 100);
```

## 7. Aggregation Operations

### 7.1 Basic Aggregations

**Count records:**

```typescript
const totalUsers = await userModel.count();

const activeUsers = await userModel.count([
  { where: 'status', equals: 'active' }
]);
```

**Sum aggregation:**

```typescript
const totalViews = await postModel.aggregate('viewCount', 'sum');
```

**Average aggregation:**

```typescript
const avgRating = await postModel.aggregate('rating', 'avg');
```

**Min/Max aggregations:**

```typescript
const oldestPost = await postModel.aggregate('createdAt', 'min');
const newestPost = await postModel.aggregate('createdAt', 'max');
```

### 7.2 Group By Operations

**Group by single field:**

```typescript
const postsByCategory = await postModel.groupBy('category', {
  count: 'id',
  sum: 'viewCount'
});
```

**Group by with filters:**

```typescript
const publishedPostsByCategory = await postModel.groupBy('category', {
  count: 'id',
  sum: 'viewCount',
  filters: [
    { where: 'status', equals: 'published' }
  ]
});
```

## 8. Soft Delete Operations

### 8.1 Restoring Records

**Restore single record:**

```typescript
const restoredPost = await postModel.restore('post-123');
```

**Restore multiple records:**

```typescript
const restoreResult = await postModel.restoreMany([
  { where: 'deletedAt', greaterThan: new Date('2024-01-01') }
]);

console.log(`Restored ${restoreResult.data.count} posts`);
```

### 8.2 Force Delete

**Force delete (permanent removal):**

```typescript
await postModel.forceDelete('post-123');
```

**Force delete many:**

```typescript
const forceDeleteResult = await postModel.forceDeleteMany([
  { where: 'deletedAt', lessThan: new Date('2023-01-01') }
]);

console.log(`Permanently deleted ${forceDeleteResult.data.count} posts`);
```

### 8.3 Including Deleted Records

```typescript
const allPosts = await postModel.findMany({
  filters: [
    { where: 'authorId', equals: 'author-123' }
  ],
  includeDeleted: true
});
```

## 9. Utility Operations

### 9.1 Existence Checks

**Check if record exists:**

```typescript
const userExists = await userModel.exists('user-123');

const activeUserExists = await userModel.exists([
  { where: 'username', equals: 'john_doe' }
]);
```

### 9.2 Distinct Values

**Get distinct values:**

```typescript
const distinctCategories = await postModel.distinct('category');

const distinctStatuses = await postModel.distinct('status', [
  { where: 'authorId', equals: 'author-123' }
]);
```

### 9.3 Raw Queries

**Execute raw SQL:**

```typescript
const customResults = await userModel.raw(sql`
  SELECT u.*, COUNT(p.id) as post_count
  FROM users u
  LEFT JOIN posts p ON u.id = p.author_id
  WHERE u.status = 'active'
  GROUP BY u.id
  HAVING COUNT(p.id) > 5
`);
```

## 10. JSON Column Handling

### 10.1 Automatic JSON Processing

JSON columns are automatically parsed when retrieved, stringified when saved, and deeply merged when updated. You never need to manually stringify or parse JSON data - the system handles it automatically.

**Creating records with JSON:**
```typescript
const user = await userModel.create({
  username: 'john_doe',
  profile: {
    firstName: 'John',
    lastName: 'Doe',
    preferences: {
      theme: 'dark',
      notifications: true
    }
  }
});

// When retrieved, JSON columns are automatically parsed
console.log(user.profile.firstName); // "John"
console.log(user.profile.preferences.theme); // "dark"
```

**Updating with deep merge:**
```typescript
// Simply provide the partial update - deep merge is automatic
const { data: updatedUser } = await userModel.update('user-123', {
  profile: {
    preferences: {
      theme: 'light' // Deeply merges, preserving all other fields
    }
  }
});

// No need to spread existing data - it's preserved automatically
console.log(updatedUser?.profile.firstName); // "John" (preserved)
console.log(updatedUser?.profile.preferences.theme); // "light" (updated)
console.log(updatedUser?.profile.preferences.notifications); // true (preserved)
```

### 10.2 JSON Filtering

**Filter by JSON properties:**

```typescript
const usersWithDarkTheme = await userModel.findMany({
  filters: [
    { sql: sql`profile->>'theme' = 'dark'` }
  ]
});

const usersWithNotifications = await userModel.findMany({
  filters: [
    { sql: sql`profile->'preferences'->>'notifications' = 'true'` }
  ]
});
```

## 11. Error Handling

### 11.1 Validation Errors

Validation errors occur when data doesn't match the schema requirements. Check `error.type === 'validation'` to handle these specifically.

```typescript
const { data, error } = await userModel.create({
  username: 'test',
  email: 'invalid-email'
});

if (error) {
  if (error.type === 'validation') {
    console.error('Validation failed:', error.details);
    // Handle validation errors
  } else {
    console.error('Database error:', error.message);
  }
  return;
}

console.log('User created:', data?.id);
```

### 11.2 Database Errors

Database errors occur due to connection issues, constraint violations, or query failures. The error details field contains additional information about the underlying error.

```typescript
const { data: user, error } = await userModel.findById('non-existent-id');

if (error) {
  console.error('Database error:', error.message);
  console.error('Error details:', error.details);
  return;
}

if (!user) {
  console.log('User not found');
  return;
}

console.log('User found:', user.id);
```

### 11.3 Error Pattern Handling

All operations return a consistent `{ data, error }` pattern. When `error` is null`, the operation succeeded. When `error` is present, check the `type` field to determine how to handle it.

```typescript
const { data, error } = await userModel.create({
  username: 'test_user',
  email: 'test@example.com'
});

if (error) {
  switch (error.type) {
    case 'validation':
      console.error('Invalid data:', error.details);
      break;
    case 'database':
      console.error('Database error:', error.message);
      break;
  }
  return;
}

console.log('User created:', data?.id);
```

## 12. Performance Best Practices

### 12.1 Pagination

**Use pagination for large datasets:**

```typescript
const page1 = await userModel.findMany({
  filters: [
    { where: 'status', equals: 'active' }
  ],
  limit: 20,
  offset: 0
});

const page2 = await userModel.findMany({
  filters: [
    { where: 'status', equals: 'active' }
  ],
  limit: 20,
  offset: 20
});
```

### 12.2 Bulk Operations

**Use bulk operations for multiple records:**

```typescript
const users = Array.from({ length: 1000 }, (_, i) => ({
  username: `user${i}`,
  email: `user${i}@example.com`
}));

// This is more efficient than individual creates
const result = await userModel.createMany(users);
```

### 12.3 Indexing Considerations

**Ensure proper indexes for frequently queried fields:**

```typescript
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  usernameIdx: index('username_idx').on(table.username),
  emailIdx: index('email_idx').on(table.email),
  statusIdx: index('status_idx').on(table.status),
  createdAtIdx: index('created_at_idx').on(table.createdAt)
}));
```

## 13. Configuration Options

### 13.1 Model Configuration

```typescript
interface ModelConfig {
  // Database dialect for query optimization and compatibility
  dialect?: "postgresql" | "sqlite"; // Default: "postgresql"

  // JSON handling mode for JSON columns
  jsonMode?: "auto" | "stringify"; // Default: "auto"

  // Maximum number of records allowed per bulk operation
  bulkOperationLimit?: number; // Default: 1000

  // Soft delete configuration for reversible deletions
  softDelete?: {
    field: string; // Column name for soft delete timestamp (e.g., 'deleted_at', 'deletedAt')
    autoFilter?: boolean; // Auto-exclude deleted records from queries (default: false)
  };

  // Timestamp configuration for automatic timestamp management
  timestamps?: {
    createdAt?: string; // Column name for creation timestamp (e.g., 'created_at', 'createdAt')
    updatedAt?: string; // Column name for update timestamp (auto-updated on update operations)
  };

  // Validation configuration for schema validation
  validation?: {
    defaultMode?: "auto" | "strict" | "loose"; // Default: "auto"
  };
}
```

**Complete Example:**
```typescript
const userModel = createModel({
  table: users,
  dbInstance: db,
  config: {
    dialect: "postgresql", // Use PostgreSQL-specific features
    jsonMode: "auto", // Let Drizzle handle JSON automatically
    bulkOperationLimit: 1000, // Max 1000 records per bulk operation
    softDelete: {
      field: "deletedAt",
      autoFilter: true // Automatically exclude deleted records
    },
    timestamps: {
      createdAt: "createdAt", // Auto-set on create
      updatedAt: "updatedAt" // Auto-updated on every update
    },
    validation: {
      defaultMode: "auto" // Auto-infer validation from schema
    }
  }
});
```

**Dialect Configuration:**

The ORM automatically handles dialect-specific differences:

- **SQLite**: Uses SQLite-specific operators, converts `ilike` to `LIKE` with `lower()`, handles raw SQL queries via `.all()` method
- **PostgreSQL**: Uses native JSON operators (`->>`, `->`), supports `ilike` directly, uses `.execute()` for raw queries

The dialect is determined from the config or defaults to `"postgresql"`. All return types are normalized so consumers receive consistent data regardless of dialect.

**JSON Mode Configuration:**

- **`"auto"`** (default): Drizzle handles JSON serialization/deserialization automatically
  - Best for PostgreSQL with native JSON types
  - Drizzle's `mode: 'json'` in SQLite is handled transparently
  
- **`"stringify"`**: ORM explicitly stringifies and parses JSON
  - Better for cross-dialect compatibility
  - Ensures JSON works consistently across SQLite and PostgreSQL
  - Recommended when using SQLite with JSON columns

```typescript
// PostgreSQL with auto mode (default)
const pgModel = createModel({
  table: users,
  dbInstance: pgDb,
  config: {
    dialect: "postgresql", // Optional, default
    jsonMode: "auto" // Let Drizzle handle it
  }
});

// SQLite with stringify mode (recommended)
const sqliteModel = createModel({
  table: users,
  dbInstance: sqliteDb,
  config: {
    dialect: "sqlite",
    jsonMode: "stringify" // Explicit JSON handling
  }
});
```

**Timestamp Auto-Update:**

When `timestamps.updatedAt` is configured, the ORM automatically sets this field to the current timestamp on the following operations:

- `update()` - Updates single record by ID
- `updateMany()` - Updates multiple records matching filters
- `upsert()` - Inserts or updates single record
- `upsertMany()` - Inserts or updates multiple records

**Note:** The `createdAt` field is only set during record creation via `create()` or `createMany()`. It is not modified during update operations, even when using upsert.

**Example:**
```typescript
const userModel = createModel({
  table: users,
  dbInstance: db,
  config: {
    timestamps: {
      createdAt: 'created_at', // Only set on creation
      updatedAt: 'updated_at'   // Auto-updated on every change
    }
  }
});

// Create user - sets both createdAt and updatedAt
await userModel.create({ username: 'john' });

// Update user - only updates updatedAt, createdAt stays unchanged
await userModel.update('user-123', { status: 'active' });

// Bulk update - updates updatedAt for all matching records
await userModel.updateMany(
  [{ where: 'status', equals: 'inactive' }],
  { role: 'user' }
);

// Upsert - updates updatedAt if record exists, sets both if new
await userModel.upsert({ id: 'user-123', username: 'john_updated' });
```

```typescript
const userModel = createModel({
  table: users,
  dbInstance: db,
  config: {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at' // Automatically set on every update
    }
  }
});

// updated_at is automatically set to current timestamp
await userModel.update('user-123', { status: 'inactive' });

// Applies to bulk updates too
await userModel.updateMany(
  [{ where: 'role', equals: 'user' }],
  { status: 'inactive' }
);
```

### 13.2 Options Interfaces

```typescript
interface ModelOptions {
  transactionPointer?: any;
  validation?: Validation;
  includeDeleted?: boolean; // For soft delete - include deleted records
  select?: (keyof TSelect)[]; // Field selection for projection
}

interface FindManyOptions<TSelect> {
  filters?: Filter<TSelect>[];
  limit?: number;
  offset?: number;
  page?: number;
  perPage?: number;
  orderBy?: OrderByOption<TSelect>[];
  select?: (keyof TSelect)[]; // Custom column selection
  distinct?: keyof TSelect; // Distinct values for a field
  with?: WithRelations;
  transactionPointer?: any;
  validation?: Validation;
  includeDeleted?: boolean;
}
```

## 14. Best Practices

### 14.1 General Guidelines

1. **Always use indexes** for frequently queried fields
2. **Use bulk operations** instead of loops
3. **Implement pagination** for large datasets
4. **Use specific field selection** when possible
5. **Optimize JSON queries** with proper indexing
6. **Monitor query performance** regularly
7. **Use connection pooling** appropriately
8. **Implement caching** for frequently accessed data
9. **Avoid N+1 queries** by using relations
10. **Handle errors gracefully** with proper error handling

### 14.2 Common Patterns

**Functional Service Pattern:**

Create service functions that encapsulate business logic and database operations. Each function is pure and focused on a single responsibility.

```typescript
// Services are just functions that use the model
export async function getActiveUsers() {
  const { data, error } = await userModel.findMany({
    filters: [{ where: 'status', equals: 'active' }]
  });

  if (error) {
    throw new Error(`Failed to fetch active users: ${error.message}`);
  }

  return data || [];
}

export async function getUserById(id: string) {
  const { data, error } = await userModel.findById(id);

  if (error) {
    throw new Error(`Failed to fetch user: ${error.message}`);
  }

  if (!data) {
    throw new Error('User not found');
  }

  return data;
}

export async function createUser(data: NewUser) {
  const { data: user, error } = await userModel.create(data);

  if (error) {
    if (error.type === 'validation') {
      throw new Error(`Validation failed: ${JSON.stringify(error.details)}`);
    }
    throw new Error(`Failed to create user: ${error.message}`);
  }

  return user!;
}

export async function updateUser(id: string, data: Partial<User>) {
  const { data: user, error } = await userModel.update(id, data);

  if (error) {
    throw new Error(`Failed to update user: ${error.message}`);
  }

  if (!user) {
    throw new Error('User not found');
  }

  return user;
}

export async function deleteUser(id: string) {
  const { error } = await userModel.delete(id);

  if (error) {
    throw new Error(`Failed to delete user: ${error.message}`);
  }
}
```

**Transaction Pattern:**

```typescript
import { withTransaction, createModel } from 'nile';
import { db } from './server/db';

const { data, error } = await withTransaction(db, async (tx) => {
  const userModel = createModel({ table: users, dbInstance: tx });
  const postModel = createModel({ table: posts, dbInstance: tx });
  
  const userResult = await userModel.create(userData);
  if (userResult.error) return userResult;
  
  const postResult = await postModel.create({
    ...postData,
    authorId: userResult.data!.id
  });
  
  return postResult;
});

if (error) {
  console.error('Transaction failed:', error.message);
  return;
}

console.log('Transaction completed:', data);
```

**Multiple Model Operations in Transaction:**

```typescript
const { data, error } = await withTransaction(db, async (tx) => {
  const userModel = createModel({ table: users, dbInstance: tx });
  const postModel = createModel({ table: posts, dbInstance: tx });
  
  // Create user
  const { data: user } = await userModel.create(userData);
  
  // Create multiple posts
  await postModel.create({ ...postData1, authorId: user.id });
  await postModel.create({ ...postData2, authorId: user.id });
  
  // Update user
  await userModel.update(user.id, { lastPostCount: 2 });
  
  return { user, posts: 2 };
});
```

**Transaction Rollback on Error:**

```typescript
try {
  const { data, error } = await withTransaction(db, async (tx) => {
    const userModel = createModel({ table: users, dbInstance: tx });
    
    const { data: user } = await userModel.create(userData);
    
    if (!user.email.includes('@')) {
      throw new Error('Invalid email'); // This will rollback transaction
    }
    
    return user;
  });
} catch (err) {
  // Transaction was rolled back, user was not created
  console.error('Transaction failed and rolled back');
}
```

**Transaction with Field Selection:**

```typescript
const { data, error } = await withTransaction(db, async (tx) => {
  const userModel = createModel({ table: users, dbInstance: tx });
  
  // Create user
  const { data: user } = await userModel.create(userData);
  
  // Find with field selection within transaction
  const { data: foundUser } = await userModel.findById(user.id, {
    select: ['id', 'username', 'email']
  });
  
  return foundUser;
});
```

**Author:** Hussein Kizz

*This specification reflects the current implementation and is subject to evolution. Contributions and feedback are welcome.*
