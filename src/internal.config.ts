import { createLog } from './logging';

/**
 * Internal logging function for nile package
 * Uses createLog with appName set to 'nile'
 */
export const log = (logData: {
  atFunction: string;
  message: string;
  data?: any;
  type?: 'info' | 'warn' | 'error';
}) => {
  return createLog({
    ...logData,
    appName: 'nile',
  });
};
