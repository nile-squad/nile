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
export function createRPC<TMode extends 'data' | 'json' = 'data'>(
  config: RPCConfig & { resultsMode?: TMode } = {}
): RPCUtils<TMode> {
  const {
    resultsMode = 'data' as TMode,
    agentMode = false,
    serverConfig,
  } = config;

  return {
    getServices(): Promise<RPCResult<TMode>> {
      return Promise.resolve(
        getServices(resultsMode, serverConfig) as RPCResult<TMode>
      );
    },

    getServiceDetails(serviceName: string): Promise<RPCResult<TMode>> {
      return Promise.resolve(
        getServiceDetails(
          serviceName,
          resultsMode,
          serverConfig
        ) as RPCResult<TMode>
      );
    },

    getActionDetails(
      serviceName: string,
      actionName: string
    ): Promise<RPCResult<TMode>> {
      return Promise.resolve(
        getActionDetails(
          serviceName,
          actionName,
          resultsMode,
          serverConfig
        ) as RPCResult<TMode>
      );
    },

    getSchema(): Promise<RPCResult<TMode>> {
      return Promise.resolve(
        getSchema(resultsMode, serverConfig) as RPCResult<TMode>
      );
    },

    executeServiceAction(
      serviceName: string,
      payload: ActionPayload
    ): Promise<RPCResult<TMode>> {
      return executeServiceAction({
        serviceName,
        payload,
        resultsMode,
        agentMode,
        serverConfig,
      });
    },
  };
}

export type { ActionPayload, RPCConfig, RPCResult, RPCUtils } from './types';
