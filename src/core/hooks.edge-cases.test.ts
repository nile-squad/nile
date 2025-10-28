import { describe, it, expect, vi } from 'vitest';
import { createHookExecutor } from '../core/hooks';
import { Ok, safeError } from '../utils/safe-try';
import type { Action } from '../types/actions';

/**
 * Edge case tests for hook system
 * Focus: Deep nesting, circular references, concurrent execution,
 * missing actions, empty arrays, complex transformations
 */

describe('Hook System - Edge Cases', () => {
	describe('Deep Hook Nesting', () => {
		it('should handle 10+ hooks in before chain', async () => {
			const hooks: Action[] = [];

			// Create 15 sequential hooks
			for (let i = 1; i <= 15; i++) {
				hooks.push({
					name: `hook${i}`,
					handler: async (data) => Ok({ ...data, [`step${i}`]: true }),
					type: 'custom',
					description: `Hook ${i}`,
					validation: {},
					meta: {},
				});
			}

			const mainAction: Action = {
				name: 'mainAction',
				handler: async (data) => Ok(data),
				type: 'custom',
				description: 'Main action',
				validation: {},
				meta: {},
				hooks: {
					before: hooks.map((h) => ({ name: h.name, canFail: false })),
				},
			};

			const executor = createHookExecutor([...hooks, mainAction]);
			const result = await executor.executeActionWithHooks(mainAction, {
				initial: 'data',
			});

			expect(result.status).toBe(true);
			expect(result.data.initial).toBe('data');

			// Verify all 15 hooks executed
			for (let i = 1; i <= 15; i++) {
				expect(result.data[`step${i}`]).toBe(true);
			}
		});

		it('should handle 10+ hooks in after chain', async () => {
			const hooks: Action[] = [];

			// Create 15 sequential after hooks
			for (let i = 1; i <= 15; i++) {
				hooks.push({
					name: `afterHook${i}`,
					handler: async (data) => Ok({ ...data, [`enrichment${i}`]: i }),
					type: 'custom',
					description: `After hook ${i}`,
					validation: {},
					meta: {},
				});
			}

			const mainAction: Action = {
				name: 'mainAction',
				handler: async () => Ok({ result: 'success' }),
				type: 'custom',
				description: 'Main action',
				validation: {},
				meta: {},
				hooks: {
					after: hooks.map((h) => ({ name: h.name, canFail: false })),
				},
			};

			const executor = createHookExecutor([...hooks, mainAction]);
			const result = await executor.executeActionWithHooks(mainAction, {});

			expect(result.status).toBe(true);

			// Verify all 15 after hooks executed
			for (let i = 1; i <= 15; i++) {
				expect(result.data[`enrichment${i}`]).toBe(i);
			}
		});

		it('should maintain data integrity through deep hook chain', async () => {
			const hooks: Action[] = [];

			// Create hooks that incrementally build an object
			for (let i = 1; i <= 10; i++) {
				hooks.push({
					name: `builder${i}`,
					handler: async (data) => {
						const count = data.count || 0;
						return Ok({
							...data,
							count: count + 1,
							[`prop${i}`]: `value${i}`,
						});
					},
					type: 'custom',
					description: `Builder ${i}`,
					validation: {},
					meta: {},
				});
			}

			const mainAction: Action = {
				name: 'mainAction',
				handler: async (data) => Ok(data),
				type: 'custom',
				description: 'Main action',
				validation: {},
				meta: {},
				hooks: {
					before: hooks.map((h) => ({ name: h.name, canFail: false })),
				},
			};

			const executor = createHookExecutor([...hooks, mainAction]);
			const result = await executor.executeActionWithHooks(mainAction, {
				count: 0,
			});

			expect(result.status).toBe(true);
			expect(result.data.count).toBe(10);

			// Verify all properties exist
			for (let i = 1; i <= 10; i++) {
				expect(result.data[`prop${i}`]).toBe(`value${i}`);
			}
		});
	});

	describe('Complex Data Structures', () => {
		it('should handle deeply nested objects', async () => {
			const hook: Action = {
				name: 'nestedHook',
				handler: async (data) =>
					Ok({
						...data,
						processed: true,
					}),
				type: 'custom',
				description: 'Nested hook',
				validation: {},
				meta: {},
			};

			const mainAction: Action = {
				name: 'mainAction',
				handler: async (data) => Ok(data),
				type: 'custom',
				description: 'Main action',
				validation: {},
				meta: {},
				hooks: {
					before: [{ name: 'nestedHook', canFail: false }],
				},
			};

			const deeplyNestedData = {
				level1: {
					level2: {
						level3: {
							level4: {
								level5: {
									value: 'deep-value',
									array: [1, 2, { nested: true }],
								},
							},
						},
					},
				},
			};

			const executor = createHookExecutor([hook, mainAction]);
			const result = await executor.executeActionWithHooks(
				mainAction,
				deeplyNestedData
			);

			expect(result.status).toBe(true);
			expect(result.data.level1.level2.level3.level4.level5.value).toBe(
				'deep-value'
			);
			expect(result.data.processed).toBe(true);
		});

		it('should handle arrays with nested objects', async () => {
			const hook: Action = {
				name: 'arrayHook',
				handler: async (data) =>
					Ok({
						...data,
						items: data.items.map((item: any) => ({ ...item, processed: true })),
					}),
				type: 'custom',
				description: 'Array hook',
				validation: {},
				meta: {},
			};

			const mainAction: Action = {
				name: 'mainAction',
				handler: async (data) => Ok(data),
				type: 'custom',
				description: 'Main action',
				validation: {},
				meta: {},
				hooks: {
					before: [{ name: 'arrayHook', canFail: false }],
				},
			};

			const complexArrayData = {
				items: [
					{ id: 1, nested: { value: 'a' } },
					{ id: 2, nested: { value: 'b' } },
					{ id: 3, nested: { value: 'c' } },
				],
			};

			const executor = createHookExecutor([hook, mainAction]);
			const result = await executor.executeActionWithHooks(
				mainAction,
				complexArrayData
			);

			expect(result.status).toBe(true);
			expect(result.data.items).toHaveLength(3);
			for (const item of result.data.items) {
				expect(item.processed).toBe(true);
			}
		});

		it('should handle null and undefined values', async () => {
			const hook: Action = {
				name: 'nullableHook',
				handler: async (data) =>
					Ok({
						...data,
						checkedNull: data.nullValue === null,
						checkedUndefined: data.undefinedValue === undefined,
					}),
				type: 'custom',
				description: 'Nullable hook',
				validation: {},
				meta: {},
			};

			const mainAction: Action = {
				name: 'mainAction',
				handler: async (data) => Ok(data),
				type: 'custom',
				description: 'Main action',
				validation: {},
				meta: {},
				hooks: {
					before: [{ name: 'nullableHook', canFail: false }],
				},
			};

			const executor = createHookExecutor([hook, mainAction]);
			const result = await executor.executeActionWithHooks(mainAction, {
				nullValue: null,
				undefinedValue: undefined,
				normalValue: 'test',
			});

			expect(result.status).toBe(true);
			expect(result.data.checkedNull).toBe(true);
			expect(result.data.checkedUndefined).toBe(true);
		});
	});

	describe('Hook Action Not Found', () => {
		it('should return error when before hook action does not exist', async () => {
			const mainAction: Action = {
				name: 'mainAction',
				handler: vi.fn(async (data) => Ok(data)),
				type: 'custom',
				description: 'Main action',
				validation: {},
				meta: {},
				hooks: {
					before: [{ name: 'nonExistentHook', canFail: false }],
				},
			};

			const executor = createHookExecutor([mainAction]);
			const result = await executor.executeActionWithHooks(mainAction, {
				test: 'data',
			});

			expect(result.status).toBe(false);
			expect(result.message).toContain("Action 'mainAction' pipeline failed");
			expect(mainAction.handler).not.toHaveBeenCalled();
		});

		it('should return error when after hook action does not exist', async () => {
			const mainAction: Action = {
				name: 'mainAction',
				handler: async () => Ok({ result: 'data' }),
				type: 'custom',
				description: 'Main action',
				validation: {},
				meta: {},
				hooks: {
					after: [{ name: 'missingAfterHook', canFail: false }],
				},
			};

			const executor = createHookExecutor([mainAction]);
			const result = await executor.executeActionWithHooks(mainAction, {});

			expect(result.status).toBe(false);
			expect(result.message).toContain("Action 'mainAction' pipeline failed");
		});

		it('should handle missing hook in middle of chain', async () => {
			const hook1: Action = {
				name: 'existingHook1',
				handler: async (data) => Ok(data),
				type: 'custom',
				description: 'Existing hook 1',
				validation: {},
				meta: {},
			};

			const hook3: Action = {
				name: 'existingHook3',
				handler: vi.fn(async (data) => Ok(data)),
				type: 'custom',
				description: 'Existing hook 3',
				validation: {},
				meta: {},
			};

			const mainAction: Action = {
				name: 'mainAction',
				handler: vi.fn(async (data) => Ok(data)),
				type: 'custom',
				description: 'Main action',
				validation: {},
				meta: {},
				hooks: {
					before: [
						{ name: 'existingHook1', canFail: false },
						{ name: 'missingHook2', canFail: false },
						{ name: 'existingHook3', canFail: false },
					],
				},
			};

			const executor = createHookExecutor([hook1, hook3, mainAction]);
			const result = await executor.executeActionWithHooks(mainAction, {});

			expect(result.status).toBe(false);
			expect(hook3.handler).not.toHaveBeenCalled();
			expect(mainAction.handler).not.toHaveBeenCalled();
		});
	});

	describe('Empty Hook Arrays', () => {
		it('should handle action with empty before hooks array', async () => {
			const mainAction: Action = {
				name: 'mainAction',
				handler: async (data) => Ok({ ...data, processed: true }),
				type: 'custom',
				description: 'Main action',
				validation: {},
				meta: {},
				hooks: {
					before: [],
				},
			};

			const executor = createHookExecutor([mainAction]);
			const result = await executor.executeActionWithHooks(mainAction, {
				input: 'test',
			});

			expect(result.status).toBe(true);
			expect(result.data).toEqual({ input: 'test', processed: true });
		});

		it('should handle action with empty after hooks array', async () => {
			const mainAction: Action = {
				name: 'mainAction',
				handler: async () => Ok({ result: 'success' }),
				type: 'custom',
				description: 'Main action',
				validation: {},
				meta: {},
				hooks: {
					after: [],
				},
			};

			const executor = createHookExecutor([mainAction]);
			const result = await executor.executeActionWithHooks(mainAction, {});

			expect(result.status).toBe(true);
			expect(result.data).toEqual({ result: 'success' });
		});

		it('should handle action with no hooks property', async () => {
			const mainAction: Action = {
				name: 'mainAction',
				handler: async (data) => Ok({ ...data, completed: true }),
				type: 'custom',
				description: 'Main action',
				validation: {},
				meta: {},
			};

			const executor = createHookExecutor([mainAction]);
			const result = await executor.executeActionWithHooks(mainAction, {
				value: 42,
			});

			expect(result.status).toBe(true);
			expect(result.data).toEqual({ value: 42, completed: true });
		});
	});

	describe('Complex Hook Transformations', () => {
		it('should handle data type transformation across hooks', async () => {
			const stringToNumber: Action = {
				name: 'stringToNumber',
				handler: async (data) =>
					Ok({
						value: Number.parseInt(data.value),
					}),
				type: 'custom',
				description: 'String to number',
				validation: {},
				meta: {},
			};

			const doubleNumber: Action = {
				name: 'doubleNumber',
				handler: async (data) =>
					Ok({
						value: data.value * 2,
					}),
				type: 'custom',
				description: 'Double number',
				validation: {},
				meta: {},
			};

			const numberToString: Action = {
				name: 'numberToString',
				handler: async (data) =>
					Ok({
						result: `Result: ${data.value}`,
					}),
				type: 'custom',
				description: 'Number to string',
				validation: {},
				meta: {},
			};

			const mainAction: Action = {
				name: 'mainAction',
				handler: async (data) => Ok(data),
				type: 'custom',
				description: 'Main action',
				validation: {},
				meta: {},
				hooks: {
					before: [
						{ name: 'stringToNumber', canFail: false },
						{ name: 'doubleNumber', canFail: false },
					],
					after: [{ name: 'numberToString', canFail: false }],
				},
			};

			const executor = createHookExecutor([
				stringToNumber,
				doubleNumber,
				numberToString,
				mainAction,
			]);
			const result = await executor.executeActionWithHooks(mainAction, {
				value: '10',
			});

			expect(result.status).toBe(true);
			expect(result.data.result).toBe('Result: 20');
		});

		it('should handle complete data replacement in hooks', async () => {
			const replaceData: Action = {
				name: 'replaceData',
				handler: async () =>
					Ok({
						completely: 'new',
						data: 'structure',
					}),
				type: 'custom',
				description: 'Replace data',
				validation: {},
				meta: {},
			};

			const mainAction: Action = {
				name: 'mainAction',
				handler: async (data) => Ok(data),
				type: 'custom',
				description: 'Main action',
				validation: {},
				meta: {},
				hooks: {
					before: [{ name: 'replaceData', canFail: false }],
				},
			};

			const executor = createHookExecutor([replaceData, mainAction]);
			const result = await executor.executeActionWithHooks(mainAction, {
				original: 'data',
				should: 'be',
				replaced: true,
			});

			expect(result.status).toBe(true);
			expect(result.data).toEqual({
				completely: 'new',
				data: 'structure',
			});
			expect(result.data.original).toBeUndefined();
		});
	});

	describe('Mixed canFail Scenarios', () => {
		it('should continue through multiple canFail hooks that fail', async () => {
			const optionalHook1: Action = {
				name: 'optional1',
				handler: async () => safeError('Optional 1 failed', 'error1'),
				type: 'custom',
				description: 'Optional 1',
				validation: {},
				meta: {},
			};

			const optionalHook2: Action = {
				name: 'optional2',
				handler: async () => safeError('Optional 2 failed', 'error2'),
				type: 'custom',
				description: 'Optional 2',
				validation: {},
				meta: {},
			};

			const requiredHook: Action = {
				name: 'required',
				handler: async (data) => Ok({ ...data, required: true }),
				type: 'custom',
				description: 'Required',
				validation: {},
				meta: {},
			};

			const mainAction: Action = {
				name: 'mainAction',
				handler: async (data) => Ok(data),
				type: 'custom',
				description: 'Main action',
				validation: {},
				meta: {},
				hooks: {
					before: [
						{ name: 'optional1', canFail: true },
						{ name: 'optional2', canFail: true },
						{ name: 'required', canFail: false },
					],
				},
			};

			const executor = createHookExecutor([
				optionalHook1,
				optionalHook2,
				requiredHook,
				mainAction,
			]);
			const result = await executor.executeActionWithHooks(mainAction, {
				input: 'data',
			});

			expect(result.status).toBe(true);
			expect(result.data.required).toBe(true);
		});

		it('should fail if required hook fails after optional hooks', async () => {
			const optionalHook: Action = {
				name: 'optional',
				handler: async () => safeError('Optional failed', 'error'),
				type: 'custom',
				description: 'Optional',
				validation: {},
				meta: {},
			};

			const requiredHook: Action = {
				name: 'required',
				handler: async () => safeError('Required failed', 'critical'),
				type: 'custom',
				description: 'Required',
				validation: {},
				meta: {},
			};

			const mainAction: Action = {
				name: 'mainAction',
				handler: vi.fn(async (data) => Ok(data)),
				type: 'custom',
				description: 'Main action',
				validation: {},
				meta: {},
				hooks: {
					before: [
						{ name: 'optional', canFail: true },
						{ name: 'required', canFail: false },
					],
				},
			};

			const executor = createHookExecutor([
				optionalHook,
				requiredHook,
				mainAction,
			]);
			const result = await executor.executeActionWithHooks(mainAction, {});

			expect(result.status).toBe(false);
			expect(result.message).toBe('Required failed');
			expect(mainAction.handler).not.toHaveBeenCalled();
		});
	});

	describe('Performance and Timing', () => {
		it('should execute hooks sequentially not concurrently', async () => {
			const executionOrder: number[] = [];

			const hook1: Action = {
				name: 'hook1',
				handler: async (data) => {
					await new Promise((resolve) => setTimeout(resolve, 50));
					executionOrder.push(1);
					return Ok(data);
				},
				type: 'custom',
				description: 'Hook 1',
				validation: {},
				meta: {},
			};

			const hook2: Action = {
				name: 'hook2',
				handler: async (data) => {
					await new Promise((resolve) => setTimeout(resolve, 30));
					executionOrder.push(2);
					return Ok(data);
				},
				type: 'custom',
				description: 'Hook 2',
				validation: {},
				meta: {},
			};

			const hook3: Action = {
				name: 'hook3',
				handler: async (data) => {
					await new Promise((resolve) => setTimeout(resolve, 20));
					executionOrder.push(3);
					return Ok(data);
				},
				type: 'custom',
				description: 'Hook 3',
				validation: {},
				meta: {},
			};

			const mainAction: Action = {
				name: 'mainAction',
				handler: async (data) => Ok(data),
				type: 'custom',
				description: 'Main action',
				validation: {},
				meta: {},
				hooks: {
					before: [
						{ name: 'hook1', canFail: false },
						{ name: 'hook2', canFail: false },
						{ name: 'hook3', canFail: false },
					],
				},
			};

			const executor = createHookExecutor([hook1, hook2, hook3, mainAction]);
			const result = await executor.executeActionWithHooks(mainAction, {});

			expect(result.status).toBe(true);
			// Should execute in order 1, 2, 3 not by timing
			expect(executionOrder).toEqual([1, 2, 3]);
		});
	});
});
