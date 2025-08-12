import type { SafeResult } from '../../utils/safe-try';

export interface RPCUtils {
  getServices(): Promise<RPCResult>;
  getServiceDetails(serviceName: string): Promise<RPCResult>;
  getActionDetails(serviceName: string, actionName: string): Promise<RPCResult>;
  getSchema(): Promise<RPCResult>;
  executeServiceAction(
    serviceName: string,
    payload: ActionPayload
  ): Promise<RPCResult>;
}

export interface RPCConfig {
  resultsMode?: 'data' | 'json'; // defaults to 'data'
  agentMode?: boolean; // defaults to false
}

export interface ActionPayload {
  action: string;
  payload: Record<string, any>;
  auth?: { token: string };
}

export type RPCResult = SafeResult<any> | string; // SafeResult for 'data', JSON string for 'json'

export type ResultsMode = 'data' | 'json';
