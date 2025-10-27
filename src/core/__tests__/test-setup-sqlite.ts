import Database from 'better-sqlite3';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Test schema - SQLite version
export const testUsers = sqliteTable('test_users', {
  id: text('id')
    .primaryKey()
    .notNull()
    .$default(() => crypto.randomUUID()),
  username: text('username', { length: 50 }).notNull().unique(),
  email: text('email', { length: 255 }).notNull().unique(),
  status: text('status', { length: 20 }).notNull().default('active'),
  role: text('role', { length: 20 }).notNull().default('user'),
  profile: text('profile', { mode: 'json' }).$type<any>(), // JSON stored as text
  preferences: text('preferences', { mode: 'json' }).$type<any>(), // JSON stored as text
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export const testPosts = sqliteTable('test_posts', {
  id: text('id')
    .primaryKey()
    .notNull()
    .$default(() => crypto.randomUUID()),
  title: text('title', { length: 255 }).notNull(),
  content: text('content'),
  status: text('status', { length: 20 }).notNull().default('draft'),
  authorId: text('author_id').notNull(),
  viewCount: integer('view_count').default(0),
  rating: integer('rating'),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export type TestUser = InferSelectModel<typeof testUsers>;
export type NewTestUser = InferInsertModel<typeof testUsers>;
export type TestPost = InferSelectModel<typeof testPosts>;
export type NewTestPost = InferInsertModel<typeof testPosts>;

// Test database setup
let dbInstance: ReturnType<typeof Database>;
let db: ReturnType<typeof drizzle>;

export function setupTestDb() {
  // Create in-memory SQLite database
  dbInstance = new Database(':memory:');
  db = drizzle(dbInstance);

  // Enable foreign keys
  dbInstance.pragma('foreign_keys = ON');

  // Create tables
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS test_users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      role TEXT NOT NULL DEFAULT 'user',
      profile TEXT,
      preferences TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    );
  `);

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS test_posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      author_id TEXT NOT NULL,
      view_count INTEGER DEFAULT 0,
      rating INTEGER,
      published_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    );
  `);

  return { dbInstance, db } as any;
}

export function cleanupTestDb() {
  if (dbInstance) {
    // Clear all data from tables
    try {
      dbInstance.exec('DELETE FROM test_posts');
      dbInstance.exec('DELETE FROM test_users');
    } catch (_error) {
      // Ignore cleanup errors
    }
    dbInstance.close();
  }
}

// Test data factories
export function createTestUser(
  overrides: Partial<NewTestUser> = {}
): NewTestUser {
  const baseProfile = {
    firstName: 'John',
    lastName: 'Doe',
    preferences: {
      theme: 'light',
      notifications: true,
    },
  };

  const basePreferences = {
    language: 'en',
    timezone: 'UTC',
  };

  return {
    id: crypto.randomUUID(),
    username: `user_${Date.now()}`,
    email: `user_${Date.now()}@example.com`,
    status: 'active',
    role: 'user',
    profile: overrides.profile || baseProfile,
    preferences: overrides.preferences || basePreferences,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createTestPost(
  overrides: Partial<NewTestPost> = {}
): NewTestPost {
  return {
    id: crypto.randomUUID(),
    title: `Test Post ${Date.now()}`,
    content: 'This is a test post content',
    status: 'draft',
    authorId: '', // Will be set in tests
    viewCount: 0,
    rating: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Helper function to create records with result pattern handling
export async function createRecord(model: any, data: any) {
  const { data: result, error } = await model.create(data);
  if (error) {
    throw new Error(`Failed to create record: ${error.message}`);
  }
  return result;
}

// Helper function for transaction testing
export async function withTestTransaction<T>(
  callback: (tx: any, models: { userModel: any; postModel: any }) => Promise<T>
): Promise<T> {
  const { db: testDb } = setupTestDb();

  // Note: better-sqlite3 doesn't have async transactions like Drizzle expects
  // We'll use the raw transaction approach
  testDb.run('BEGIN TRANSACTION');
  try {
    const result: T = await callback(testDb, {
      userModel: null, // Will be created in tests
      postModel: null, // Will be created in tests
    });
    testDb.run('COMMIT');
    return result;
  } catch (err) {
    testDb.run('ROLLBACK');
    throw err;
  }
}
