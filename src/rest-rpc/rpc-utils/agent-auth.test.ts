import { describe, expect, it } from 'vitest';
import type { AuthResult } from '../auth-utils';
import { 
  validateAgenticAction 
} from './agent-auth';

describe('Agent Authentication', () => {
  describe('validateAgenticAction', () => {
    it('should allow all actions for non-agents', () => {
      const action = { agentic: false };
      const authResult: AuthResult = { isAuthenticated: true, method: 'jwt' };
      const result = validateAgenticAction(action, authResult);
      
      expect(result).toBe(true);
    });

    it('should allow agentic actions for agents', () => {
      const action = { agentic: true };
      const authResult: AuthResult = { isAuthenticated: true, method: 'agent' };
      const result = validateAgenticAction(action, authResult);
      
      expect(result).toBe(true);
    });

    it('should allow actions without agentic flag for agents (default true)', () => {
      const action = {};
      const authResult: AuthResult = { isAuthenticated: true, method: 'agent' };
      const result = validateAgenticAction(action, authResult);
      
      expect(result).toBe(true);
    });

    it('should block non-agentic actions for agents', () => {
      const action = { agentic: false };
      const authResult: AuthResult = { isAuthenticated: true, method: 'agent' };
      const result = validateAgenticAction(action, authResult);
      
      expect(result).toBe(false);
    });
  });
});