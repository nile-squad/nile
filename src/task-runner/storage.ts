import Database from 'better-sqlite3';
import type { TaskExecution, TaskRecord } from './types';

export interface TaskStorage {
  tasks: {
    insert: (task: TaskRecord) => any;
    update: (id: string, updates: Partial<TaskRecord>) => any;
    getById: (id: string) => TaskRecord | undefined;
    getAll: () => TaskRecord[];
    getByStatus: (status: string) => TaskRecord[];
    getByType: (type: string) => TaskRecord[];
    getPending: () => TaskRecord[];
    delete: (id: string) => any;
  };
  executions: {
    insert: (execution: TaskExecution) => any;
    update: (id: string, updates: Partial<TaskExecution>) => any;
    getByTaskId: (taskId: string) => TaskExecution[];
  };
  close: () => void;
}

/**
 * Creates a SQLite-based storage system for task management.
 * Provides CRUD operations for tasks and task executions with proper indexing.
 *
 * @param dbPath - Path to the SQLite database file (defaults to in-memory database)
 * @returns Storage interface with methods for managing tasks and executions
 *
 * @example
 * ```typescript
 * const storage = createTaskStorage('./tasks.db');
 *
 * // Insert a new task
 * storage.tasks.insert({
 *   id: 'task-1',
 *   type: 'schedule',
 *   status: 'pending',
 *   // ... other task properties
 * });
 *
 * // Get all pending tasks
 * const pendingTasks = storage.tasks.getPending();
 *
 * // Clean up when done
 * storage.close();
 * ```
 */
export function createTaskStorage(dbPath = ':memory:'): TaskStorage {
  const db = new Database(dbPath);

  // Create tables first
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT,
      type TEXT NOT NULL CHECK (type IN ('event', 'schedule')),
      preset TEXT,
      cron TEXT,
      at TEXT,
      timezone TEXT,
      nextRunAt TEXT,
      lastRunAt TEXT,
      attempts INTEGER DEFAULT 0,
      maxAttempts INTEGER DEFAULT 1,
      rateCount INTEGER DEFAULT 0,
      rateWindow TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused')),
      isPaused INTEGER DEFAULT 0,
      metadata TEXT,
      createdAt TEXT NOT NULL,
      onEvent TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS task_executions (
      id TEXT PRIMARY KEY,
      taskId TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'running')),
      startedAt TEXT NOT NULL,
      completedAt TEXT,
      error TEXT,
      attempt INTEGER NOT NULL,
      FOREIGN KEY (taskId) REFERENCES tasks (id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
    CREATE INDEX IF NOT EXISTS idx_tasks_nextRunAt ON tasks (nextRunAt);
    CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks (type);
    CREATE INDEX IF NOT EXISTS idx_task_executions_taskId ON task_executions (taskId);
  `);

  // Then prepare statements
  const insertTask = db.prepare(`
    INSERT INTO tasks (
      id, name, type, preset, cron, at, timezone, nextRunAt, lastRunAt, attempts, maxAttempts,
      rateCount, rateWindow, status, isPaused, metadata, createdAt, onEvent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateTask = db.prepare(`
    UPDATE tasks SET
      nextRunAt = ?, lastRunAt = ?, attempts = ?, rateCount = ?, 
      rateWindow = ?, status = ?, isPaused = ?
    WHERE id = ?
  `);

  const getTask = db.prepare('SELECT * FROM tasks WHERE id = ?');
  const getAllTasks = db.prepare('SELECT * FROM tasks');
  const getTasksByStatus = db.prepare('SELECT * FROM tasks WHERE status = ?');
  const getTasksByType = db.prepare('SELECT * FROM tasks WHERE type = ?');
  const getPendingTasks = db.prepare(
    'SELECT * FROM tasks WHERE status = ? AND isPaused = ?'
  );
  const deleteTask = db.prepare('DELETE FROM tasks WHERE id = ?');

  const insertExecution = db.prepare(`
    INSERT INTO task_executions (id, taskId, status, startedAt, completedAt, error, attempt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const updateExecution = db.prepare(`
    UPDATE task_executions SET status = ?, completedAt = ?, error = ? WHERE id = ?
  `);

  const getExecutions = db.prepare(
    'SELECT * FROM task_executions WHERE taskId = ? ORDER BY startedAt DESC'
  );

  return {
    tasks: {
      insert: (task: TaskRecord) =>
        insertTask.run(
          task.id,
          task.name,
          task.type,
          task.preset,
          task.cron,
          task.at,
          task.timezone,
          task.nextRunAt,
          task.lastRunAt,
          task.attempts,
          task.maxAttempts,
          task.rateCount,
          task.rateWindow,
          task.status,
          task.isPaused ? 1 : 0,
          task.metadata,
          task.createdAt,
          task.onEvent
        ),
      update: (id: string, updates: Partial<TaskRecord>) =>
        updateTask.run(
          updates.nextRunAt,
          updates.lastRunAt,
          updates.attempts,
          updates.rateCount,
          updates.rateWindow,
          updates.status,
          updates.isPaused ? 1 : 0,
          id
        ),
      getById: (id: string): TaskRecord | undefined => {
        const result = getTask.get(id) as any;
        if (!result) {
          return;
        }
        // Convert SQLite integers to booleans
        return {
          ...result,
          isPaused: Boolean(result.isPaused),
        };
      },
      getAll: (): TaskRecord[] => {
        const results = getAllTasks.all() as any[];
        return results.map((result) => ({
          ...result,
          isPaused: Boolean(result.isPaused),
        }));
      },
      getByStatus: (status: string): TaskRecord[] => {
        const results = getTasksByStatus.all(status) as any[];
        return results.map((result) => ({
          ...result,
          isPaused: Boolean(result.isPaused),
        }));
      },
      getByType: (type: string): TaskRecord[] => {
        const results = getTasksByType.all(type) as any[];
        return results.map((result) => ({
          ...result,
          isPaused: Boolean(result.isPaused),
        }));
      },
      getPending: (): TaskRecord[] => {
        const results = getPendingTasks.all('pending', 0) as any[];
        return results.map((result) => ({
          ...result,
          isPaused: Boolean(result.isPaused),
        }));
      },
      delete: (id: string) => deleteTask.run(id),
    },
    executions: {
      insert: (execution: TaskExecution) =>
        insertExecution.run(
          execution.id,
          execution.taskId,
          execution.status,
          execution.startedAt,
          execution.completedAt,
          execution.error,
          execution.attempt
        ),
      update: (id: string, updates: Partial<TaskExecution>) =>
        updateExecution.run(
          updates.status,
          updates.completedAt,
          updates.error,
          id
        ),
      getByTaskId: (taskId: string): TaskExecution[] =>
        getExecutions.all(taskId) as TaskExecution[],
    },
    close: () => db.close(),
  };
}
