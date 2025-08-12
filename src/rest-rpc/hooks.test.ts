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
      {
        name: 'stateManipulator',
        description: 'Manipulate shared state',
        handler: async (data, context) => {
          if ((context as any)?.hookState) {
            (context as any).hookState.processed = true;
            (context as any).hookState.processedAt = Date.now();
          }
          return Ok({ ...data, stateModified: true });
        },
        validation: {},
      },
      {
        name: 'stateReader',
        description: 'Read shared state',
        handler: async (data, context) => {
          const stateData = (context as any)?.hookState || {};
          return Ok({ ...data, sharedState: stateData });
        },
        validation: {},
      },
      {
        name: 'testStateSharing',
        description: 'Test action with state sharing hooks',
        handler: async (data) => {
          return Ok({ id: 789, ...data });
        },
        validation: {},
        hooks: {
          before: [
            { name: 'stateManipulator', canFail: false },
            { name: 'stateReader', canFail: false },
          ],
        },
        result: {
          pipeline: true,
        },
      },
      {
        name: 'step1',
        description: 'First step - always succeeds',
        handler: async (data) => {
          return Ok({ ...data, step1: 'completed' });
        },
        validation: {},
      },
      {
        name: 'step2Fail',
        description: 'Second step - always fails',
        handler: async (data) => {
          return safeError('Step 2 failed intentionally', 'STEP2_ERROR');
        },
        validation: {},
      },
      {
        name: 'step3',
        description: 'Third step - always succeeds',
        handler: async (data) => {
          return Ok({ ...data, step3: 'completed' });
        },
        validation: {},
      },
      {
        name: 'testCanFailPipeline',
        description: 'Test pipeline with failing optional hook',
        handler: async (data) => {
          return Ok({ id: 999, ...data });
        },
        validation: {},
        hooks: {
          before: [
            { name: 'step1', canFail: false },        // succeeds: adds step1
            { name: 'step2Fail', canFail: true },     // fails: continues with step1 output
            { name: 'step3', canFail: false },        // succeeds: adds step3 to step1 output
          ],
        },
        result: {
          pipeline: true,
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

  it('should enable state sharing between hooks', async () => {
    const testAction = actions.find(a => a.name === 'testStateSharing')!;
    const result = await hookExecutor.executeActionWithHooks(
      testAction,
      { name: 'Test State' }
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.result.id).toBe(789);
      expect(result.data.result.stateModified).toBe(true);
      expect(result.data.result.sharedState.processed).toBe(true);
      expect(result.data.result.sharedState.processedAt).toBeDefined();
      expect(result.data.pipeline.log.before).toHaveLength(2);
      expect(result.data.pipeline.log.before[0].name).toBe('stateManipulator');
      expect(result.data.pipeline.log.before[1].name).toBe('stateReader');
    }
  });

  it('should continue with most recent output when canFail hook fails', async () => {
    const testAction = actions.find(a => a.name === 'testCanFailPipeline')!;
    const result = await hookExecutor.executeActionWithHooks(
      testAction,
      { name: 'Test Pipeline' }
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      // Should have output from step1 and step3, but not step2 (which failed)
      expect(result.data.result.id).toBe(999);
      expect(result.data.result.name).toBe('Test Pipeline');
      expect(result.data.result.step1).toBe('completed'); // From successful step1
      expect(result.data.result.step3).toBe('completed'); // From successful step3 (received step1 output)
      expect(result.data.result.step2).toBeUndefined(); // step2 failed
      
      // Check pipeline log
      expect(result.data.pipeline.log.before).toHaveLength(3);
      expect(result.data.pipeline.log.before[0].name).toBe('step1');
      expect(result.data.pipeline.log.before[0].passed).toBe(true);
      expect(result.data.pipeline.log.before[1].name).toBe('step2Fail');
      expect(result.data.pipeline.log.before[1].passed).toBe(false);
      expect(result.data.pipeline.log.before[2].name).toBe('step3');
      expect(result.data.pipeline.log.before[2].passed).toBe(true);
      
      // Verify step3 received step1's output (not original input)
      expect(result.data.pipeline.log.before[2].input.step1).toBe('completed');
    }
  });
});