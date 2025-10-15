import type { SafeResult } from '../../utils/safe-try';
import type { ServerConfig } from '../rest/rest-server';

export interface RPCConfig {
  resultsMode?: 'data' | 'json'; // defaults to 'data'
  agentMode?: boolean; // defaults to false - enables agent user context from auth claims
  organizationId?: string; // for system mode - explicit org override (optional, will use auth claims if not provided)
  serverConfig?: ServerConfig; // optional server config for direct injection
}

export interface ActionPayload {
  action: string;
  payload: Record<string, any>;
  auth?: { token: string };
}

// Utility type to get result type based on resultsMode
export type RPCResult<TMode extends 'data' | 'json' = 'data'> =
  TMode extends 'data' ? SafeResult<any> : string;

export interface RPCUtils<TMode extends 'data' | 'json' = 'data'> {
  getServices(): Promise<RPCResult<TMode>>;
  getServiceDetails(serviceName: string): Promise<RPCResult<TMode>>;
  getActionDetails(
    serviceName: string,
    actionName: string
  ): Promise<RPCResult<TMode>>;
  getSchemas(): Promise<RPCResult<TMode>>;
  executeServiceAction(
    serviceName: string,
    payload: ActionPayload
  ): Promise<RPCResult<TMode>>;
}

export type ResultsMode = 'data' | 'json';
