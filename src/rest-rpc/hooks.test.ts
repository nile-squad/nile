import { describe, it, expect, beforeEach } from 'vitest';
import { createHookExecutor } from './hooks';
import type { Action } from '../types/actions';
import { Ok, safeError, isOk, isError } from '../utils';

describe('Hook System', () => {
  let actions: Action[];
  let hookExecutor: ReturnType<typeof createHookExecutor>;

  beforeEach(() => {
    actions = [
      {
        name: 'validateInput',
        description: 'Validate input data',
        handler: async (data) => {
          if (!data.email) {
            return safeError('Email is required', 'VALIDATION_ERROR');
          }
          return Ok({ ...data, validated: true });
        },
        validation: {},
      },
      {
        name: 'enrichData',
        description: 'Enrich data with additional info',
        handler: async (data) => {
          return Ok({ ...data, timestamp: Date.now() });
        },
        validation: {},
      },
      {
        name: 'createUser',
        description: 'Create a new user',
        handler: async (data) => {
          return Ok({ id: 123, ...data });
        },
        validation: {},
        hooks: {
          before: [
            { name: 'validateInput', canFail: false },
            { name: 'enrichData', canFail: true },
          ],
        },
        result: {
          pipeline: true,
        },
      },
      {
        name: 'logAction',
        description: 'Log action execution',
        handler: async (data) => {
          console.log('Action logged:', data);
          return Ok(data); // Preserve the original data
        },
        validation: {},
      },
      {
        name: 'sendEmail',
        description: 'Send welcome email',
        handler: async (data) => {
          if (!data.email) {
            return safeError('No email to send to', 'EMAIL_ERROR');
          }
          return Ok({ ...data, emailSent: true }); // Preserve data and add emailSent flag
        },
        validation: {},
      },
      {
        name: 'createUserWithAfterHooks',
        description: 'Create user with after hooks',
        handler: async (data) => {
          return Ok({ id: 456, ...data });
        },
        validation: {},
        hooks: {
          after: [
            { name: 'logAction', canFail: true },
            { name: 'sendEmail', canFail: false },
          ],
        },
        result: {
          pipeline: false,
        },
      },
    ];

    hookExecutor = createHookExecutor(actions);
  });

  it('should execute before hooks and main action successfully', async () => {
    const createUserAction = actions.find(a => a.name === 'createUser')!;
    const result = await hookExecutor.executeActionWithHooks(
      createUserAction,
      { email: 'test@example.com', name: 'Test User' }
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.result.id).toBe(123);
      expect(result.data.result.validated).toBe(true);
      expect(result.data.result.timestamp).toBeDefined();
      expect(result.data.pipeline.log.before).toHaveLength(2);
      expect(result.data.pipeline.log.before[0].name).toBe('validateInput');
      expect(result.data.pipeline.log.before[0].passed).toBe(true);
      expect(result.data.pipeline.log.before[1].name).toBe('enrichData');
      expect(result.data.pipeline.log.before[1].passed).toBe(true);
    }
  });

  it('should stop pipeline when critical before hook fails', async () => {
    const createUserAction = actions.find(a => a.name === 'createUser')!;
    const result = await hookExecutor.executeActionWithHooks(
      createUserAction,
      { name: 'Test User' } // Missing email
    );

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toContain('Email is required');
    }
  });

  it('should execute after hooks successfully', async () => {
    const createUserAction = actions.find(a => a.name === 'createUserWithAfterHooks')!;
    const result = await hookExecutor.executeActionWithHooks(
      createUserAction,
      { email: 'test@example.com', name: 'Test User' }
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.id).toBe(456);
    }
  });

  it('should stop pipeline when critical after hook fails', async () => {
    const createUserAction = actions.find(a => a.name === 'createUserWithAfterHooks')!;
    const result = await hookExecutor.executeActionWithHooks(
      createUserAction,
      { name: 'Test User' } // Missing email for sendEmail hook
    );

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toContain('No email to send to');
    }
  });

  it('should return error for missing hook action', async () => {
    const invalidAction: Action = {
      name: 'invalidAction',
      description: 'Action with missing hook',
      handler: async (data) => Ok(data),
      validation: {},
      hooks: {
        before: [{ name: 'nonExistentHook', canFail: false }],
      },
    };

    const result = await hookExecutor.executeActionWithHooks(invalidAction, {});
    
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toContain("Action 'invalidAction' pipeline failed");
    }
  });

  it('should return simple result when pipeline is disabled', async () => {
    const simpleAction: Action = {
      name: 'simpleAction',
      description: 'Simple action without pipeline result',
      handler: async (data) => Ok({ processed: true, ...data }),
      validation: {},
      hooks: {
        before: [{ name: 'enrichData', canFail: true }],
      },
    };

    const result = await hookExecutor.executeActionWithHooks(
      simpleAction,
      { test: 'data' }
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.processed).toBe(true);
      expect(result.data.timestamp).toBeDefined();
      expect((result.data as any).pipeline).toBeUndefined(); // No pipeline data
    }
  });
});