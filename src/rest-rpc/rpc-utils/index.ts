import { executeServiceAction } from './action-utils';
import {
  getActionDetails,
  getSchema,
  getServiceDetails,
  getServices,
} from './service-utils';
import type { ActionPayload, RPCConfig, RPCResult, RPCUtils } from './types';

/**
 * Create an RPC interface for direct service interaction
 *
 * @param config - Configuration options for the RPC interface
 * @returns RPC utilities object with service interaction methods
 */
export function useRPC(config: RPCConfig = {}): RPCUtils {
  const { resultsMode = 'data', agentMode = false } = config;

  return {
    getServices(): Promise<RPCResult> {
      return Promise.resolve(getServices(resultsMode));
    },

    getServiceDetails(serviceName: string): Promise<RPCResult> {
      return Promise.resolve(getServiceDetails(serviceName, resultsMode));
    },

    getActionDetails(
      serviceName: string,
      actionName: string
    ): Promise<RPCResult> {
      return Promise.resolve(
        getActionDetails(serviceName, actionName, resultsMode)
      );
    },

    getSchema(): Promise<RPCResult> {
      return Promise.resolve(getSchema(resultsMode));
    },

    executeServiceAction(
      serviceName: string,
      payload: ActionPayload
    ): Promise<RPCResult> {
      return executeServiceAction({
        serviceName,
        payload,
        resultsMode,
        agentMode,
      });
    },
  };
}

export type { ActionPayload, RPCConfig, RPCResult, RPCUtils } from './types';
