import { describe, expect, it } from 'vitest';
import { useRPC } from './index';

describe('RPC Utils Core Functionality', () => {
  describe('useRPC function creation', () => {
    it('should create RPC utils with default config', () => {
      const rpc = useRPC();
      
      expect(rpc).toBeDefined();
      expect(typeof rpc.getServices).toBe('function');
      expect(typeof rpc.getServiceDetails).toBe('function');
      expect(typeof rpc.getActionDetails).toBe('function');
      expect(typeof rpc.getSchema).toBe('function');
      expect(typeof rpc.executeServiceAction).toBe('function');
    });

    it('should create RPC utils with custom config', () => {
      const rpc = useRPC({
        resultsMode: 'json',
        agentMode: true
      });
      
      expect(rpc).toBeDefined();
      expect(typeof rpc.getServices).toBe('function');
    });
  });

  describe('Configuration handling', () => {
    it('should accept different result modes', () => {
      const dataRpc = useRPC({ resultsMode: 'data' });
      const jsonRpc = useRPC({ resultsMode: 'json' });
      
      expect(dataRpc).toBeDefined();
      expect(jsonRpc).toBeDefined();
    });

    it('should accept agent mode configuration', () => {
      const userRpc = useRPC({ agentMode: false });
      const agentRpc = useRPC({ agentMode: true });
      
      expect(userRpc).toBeDefined();
      expect(agentRpc).toBeDefined();
    });
  });
});