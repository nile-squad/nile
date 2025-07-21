import { type Log, createLog as newLog } from './logger-new';

type LogInput = Omit<Log, 'type' | 'appName'>;

export function createLogger(appName: string) {
  return {
    info: (input: LogInput) => newLog({ ...input, appName, type: 'info' }),
    warn: (input: LogInput) => newLog({ ...input, appName, type: 'warn' }),
    error: (input: LogInput) => newLog({ ...input, appName, type: 'error' }),
  };
}
