import { executeServiceAction } from './action-utils';
import {
  getActionDetails,
  getSchemas,
  getServiceDetails,
  getServices,
} from './service-utils';
import type { ActionPayload, RPCConfig, RPCResult, RPCUtils } from './types';

/**
 * Create an RPC interface for direct service interaction
 *
 * Two usage modes:
 * 1. Agent mode: { agentMode: true } → uses agent user with org from auth claims
 * 2. System mode: { organizationId?: "org-id" } → uses system user with explicit org or org from auth claims
 */
export const createRPC = <TMode extends 'data' | 'json' = 'data'>(
  config: RPCConfig & {
    resultsMode?: TMode;
  } = {}
): RPCUtils<TMode> => {
  const {
    resultsMode = 'data' as TMode,
    agentMode = false,
    organizationId,
    serverConfig,
  } = config;

  return {
    getServices: () =>
      Promise.resolve(
        getServices(resultsMode, serverConfig) as RPCResult<TMode>
      ),

    getServiceDetails: (serviceName: string) =>
      Promise.resolve(
        getServiceDetails(
          serviceName,
          resultsMode,
          serverConfig
        ) as RPCResult<TMode>
      ),

    getActionDetails: (serviceName: string, actionName: string) =>
      Promise.resolve(
        getActionDetails(
          serviceName,
          actionName,
          resultsMode,
          serverConfig
        ) as RPCResult<TMode>
      ),

    getSchemas: () =>
      Promise.resolve(
        getSchemas(resultsMode, serverConfig) as RPCResult<TMode>
      ),

    executeServiceAction: (serviceName: string, payload: ActionPayload) =>
      executeServiceAction({
        serviceName,
        payload,
        resultsMode,
        agentMode,
        organizationId,
        serverConfig,
      }),
  };
};

export type { ActionPayload, RPCConfig, RPCResult, RPCUtils } from './types';
