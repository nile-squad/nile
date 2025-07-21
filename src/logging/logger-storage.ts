import type { Database } from 'better-sqlite3';
import DatabaseConstructor from 'better-sqlite3';
import { nanoid } from 'nanoid';

export type Log = {
  atFunction: string;
  appName: string;
  data?: any;
  message: string;
  type?: 'info' | 'warn' | 'error' | 'data';
  log_id?: string;
};

export function createDB(dbName = 'logs'): Database {
  const _dbName = `${dbName}.logs.db`;
  const db = new DatabaseConstructor(_dbName);

  db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_id TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      log TEXT NOT NULL
    );
  `);

  return db;
}

export function addLog(log: Log, db: Database): string {
  const finalLog: Log = {
    ...log,
    type: log.type || 'info',
    log_id: nanoid(6),
  };

  if (!finalLog.log_id) {
    throw new Error('Missing log_id');
  }

  const stmt = db.prepare('INSERT INTO logs (log_id, log) VALUES (?, ?)');
  stmt.run(finalLog.log_id, JSON.stringify(finalLog));
  return finalLog.log_id;
}

export function getLogs(
  db: Database
): Array<{ id: number; log_id: string; created_at: string; log: Log }> {
  const stmt = db.prepare('SELECT * FROM logs');
  return stmt.all().map((row: any) => ({
    ...row,
    log: JSON.parse(row.log),
  }));
}

export function updateLog(id: number, newLog: Log, db: Database): void {
  const stmt = db.prepare('UPDATE logs SET log = ? WHERE id = ?');
  stmt.run(JSON.stringify(newLog), id);
}

export function deleteLog(id: number, db: Database): void {
  const stmt = db.prepare('DELETE FROM logs WHERE id = ?');
  stmt.run(id);
}

export function clearLogs(db: Database): void {
  db.exec('DELETE FROM logs');
}
