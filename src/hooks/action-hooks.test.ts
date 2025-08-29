import { expect, test, describe } from 'vitest';
import { executeActionHook } from './action-hooks.js';
import type { ActionHookHandler, ActionHookResult, Context } from '../types/action-hook.js';
import type { Action } from '../types/actions.js';

describe('executeActionHook function tests', () => {
  const mockContext: Context = {
    user: { id: 'user123', role: 'user' },
    session: { id: 'session456' },
    request: { method: 'POST', path: '/api/test' },
  };

  const mockAction: Action = {
    name: 'testAction',
    description: 'Test action for unit tests',
    type: 'custom',
    handler: async () => ({ status: true, message: 'Success', data: {} }),
    validation: {},
    meta: {
      access: ['admin', 'user']
    }
  };

  test('should return true when no handler provided', async () => {
    const result = await executeActionHook(undefined, mockContext, mockAction, { data: 'test' });
    expect(result).toBe(true);
  });

  test('should return true when handler returns true', async () => {
    const handler: ActionHookHandler = () => true;
    const result = await executeActionHook(handler, mockContext, mockAction, { data: 'test' });
    expect(result).toBe(true);
  });

  test('should return error when handler returns error object', async () => {
    const handler: ActionHookHandler = () => ({ error: 'Access denied' });
    const result = await executeActionHook(handler, mockContext, mockAction, { data: 'test' });
    
    expect(result).toEqual({
      status: false,
      message: 'Access denied',
      data: expect.objectContaining({
        error_id: expect.any(String),
      }),
    });
  });

  test('should handle async handler returning true', async () => {
    const handler: ActionHookHandler = async (): Promise<ActionHookResult> => true;
    const result = await executeActionHook(handler, mockContext, mockAction, { data: 'test' });
    expect(result).toBe(true);
  });

  test('should handle async handler returning error', async () => {
    const handler: ActionHookHandler = async (): Promise<ActionHookResult> => ({ error: 'Async access denied' });
    const result = await executeActionHook(handler, mockContext, mockAction, { data: 'test' });
    
    expect(result).toEqual({
      status: false,
      message: 'Async access denied',
      data: expect.objectContaining({
        error_id: expect.any(String),
      }),
    });
  });

  test('should throw error for invalid return value', async () => {
    const handler: ActionHookHandler = () => 'invalid' as any;
    
    await expect(
      executeActionHook(handler, mockContext, mockAction, { data: 'test' })
    ).rejects.toEqual(
      expect.objectContaining({
        status: false,
        message: expect.stringContaining('Invalid action hook result'),
        data: expect.objectContaining({
          error_id: expect.any(String),
        }),
      })
    );
  });

  test('should throw error for invalid object return value', async () => {
    const handler: ActionHookHandler = () => ({ invalidProperty: 'test' }) as any;
    
    await expect(
      executeActionHook(handler, mockContext, mockAction, { data: 'test' })
    ).rejects.toEqual(
      expect.objectContaining({
        status: false,
        message: expect.stringContaining('Invalid action hook result'),
        data: expect.objectContaining({
          error_id: expect.any(String),
        }),
      })
    );
  });

  test('should handle handler throwing regular error', async () => {
    const handler: ActionHookHandler = () => {
      throw new Error('Handler error');
    };
    
    await expect(
      executeActionHook(handler, mockContext, mockAction, { data: 'test' })
    ).rejects.toEqual(
      expect.objectContaining({
        status: false,
        message: 'Action hook execution failed',
        data: expect.objectContaining({
          error_id: expect.any(String),
        }),
      })
    );
  });

  test('should re-throw safeError from handler', async () => {
    const safeErrorResult = {
      status: false,
      message: 'Custom safe error',
      data: { error_id: 'custom123' },
    };
    
    const handler: ActionHookHandler = () => {
      throw safeErrorResult;
    };
    
    await expect(
      executeActionHook(handler, mockContext, mockAction, { data: 'test' })
    ).rejects.toEqual(safeErrorResult);
  });
});