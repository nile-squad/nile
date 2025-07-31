import type { Log } from './logger-storage';
import * as logger from './logger-storage';

const mode = process.env.MODE || 'dev';

export const createLog = (log: Log) => {
  const dbName = log.appName;
  let db: ReturnType<typeof logger.createDB> | null = null;
  if (dbName) {
    db = logger.createDB(dbName);
  }

  if (mode !== 'dev' && db) {
    return logger.addLog(log, db);
  }
  if (mode === 'agentic') {
    return JSON.stringify(log);
  }
  console.log(log);
  return 'dev-mode, see your dev console!';
};

export const getAllLogs = (appName: string) => {
  const db = logger.createDB(appName);
  return logger.getLogs(db);
};

// createLog({
//   type: 'info',
//   message: 'Logger initialized',
//   atFunction: 'createLog',
//   appName: 'shared/logging',
// });

// console.log('logs::', getAllLogs());
