import { describe, expect, it } from 'vitest';
import { 
  validateAgenticAction 
} from './agent-auth';

describe('Agent Authentication', () => {
  describe('validateAgenticAction', () => {
    it('should allow all actions for non-agents', () => {
      const action = { agentic: false };
      const result = validateAgenticAction(action, false);
      
      expect(result).toBe(true);
    });

    it('should allow agentic actions for agents', () => {
      const action = { agentic: true };
      const result = validateAgenticAction(action, true);
      
      expect(result).toBe(true);
    });

    it('should allow actions without agentic flag for agents (default true)', () => {
      const action = {};
      const result = validateAgenticAction(action, true);
      
      expect(result).toBe(true);
    });

    it('should block non-agentic actions for agents', () => {
      const action = { agentic: false };
      const result = validateAgenticAction(action, true);
      
      expect(result).toBe(false);
    });
  });
});