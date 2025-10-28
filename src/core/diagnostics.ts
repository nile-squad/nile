/**
 * Diagnostics configuration and logging utilities for unified executor
 */

import { log } from '../internal.config';

export type DiagnosticsConfig = {
  enabled: boolean;
  logLevel?: 'minimal' | 'detailed' | 'verbose';
  includePayloads?: boolean;
  includeTimings?: boolean;
};

export type DiagnosticDetails = {
  duration?: number;
  hookName?: string;
  status?: boolean;
  payload?: any;
  error?: any;
  [key: string]: any;
};

/**
 * Log diagnostic information for action execution lifecycle stages
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: diagnostic logging requires conditional logic
export function logDiagnostic(
  config: DiagnosticsConfig | undefined,
  stage: string,
  serviceName: string,
  actionName: string,
  details?: DiagnosticDetails
): void {
  if (!config?.enabled) {
    return;
  }

  const logLevel = config.logLevel || 'minimal';
  const includePayloads = config.includePayloads ?? false;
  const includeTimings = config.includeTimings ?? true;

  const logMessage: Record<string, any> = {
    timestamp: new Date().toISOString(),
    stage,
    service: serviceName,
    action: actionName,
  };

  if (details) {
    if (logLevel === 'verbose') {
      // Include everything
      logMessage.details = details;
    } else if (logLevel === 'detailed') {
      // Include selective details
      if (details.duration !== undefined && includeTimings) {
        logMessage.duration_ms = details.duration;
      }
      if (details.hookName) {
        logMessage.hookName = details.hookName;
      }
      if (details.status !== undefined) {
        logMessage.status = details.status;
      }
      if (details.error) {
        logMessage.error = details.error;
      }
    } else if (logLevel === 'minimal') {
      // Only timing and status
      if (details.duration !== undefined && includeTimings) {
        logMessage.duration_ms = details.duration;
      }
      if (details.status !== undefined) {
        logMessage.status = details.status;
      }
    }

    // Conditionally include payloads (only if explicitly enabled)
    if (includePayloads && details.payload) {
      logMessage.payload = details.payload;
    }
  }

  log({
    atFunction: 'logDiagnostic',
    message: `[${stage}] ${serviceName}.${actionName}`,
    data: logMessage,
    type: 'info',
  });
}
