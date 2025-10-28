import { describe, it, expect, vi } from 'vitest';
import { executeUnified } from './unified-executor';
import { Ok, safeError } from '../utils/safe-try';

describe('executeUnified - Action Lifecycle', () => {
	const mockAuthInput = {
		headers: new Headers(),
		cookies: {},
	};

	describe('Complete Lifecycle Flow', () => {
		it('should execute all lifecycle stages in correct order', async () => {
			const executionOrder: string[] = [];

			const mockAuthHandler = vi.fn(() => {
				executionOrder.push('1-auth');
				return Promise.resolve(Ok({ userId: 'user123' }));
			});

		const mockBeforeActionHandler = vi.fn(() => {
			executionOrder.push('2-global-before-hook');
			return Promise.resolve(Ok(true));
		});

		const mockAfterActionHandler = vi.fn(() => {
			executionOrder.push('2-global-after-hook');
			return Promise.resolve(Ok(true));
		});

			const mockHandler = vi.fn((data: any) => {
				executionOrder.push('3-handler');
				return Ok({ processed: true, ...data });
			});

			const result = await executeUnified({
				serviceName: 'test',
				actionName: 'testAction',
				payload: { value: 42 },
				serverConfig: {
					services: [
						{
							name: 'test',
							description: 'Test service',
							actions: [
								{
									name: 'testAction',
									handler: mockHandler,
									type: 'custom',
									description: 'Test action',
									validation: {},
									meta: {},
									isProtected: true,
								},
							],
						},
					],
				auth: { authHandler: mockAuthHandler },
				onBeforeActionHandler: mockBeforeActionHandler,
				onAfterActionHandler: mockAfterActionHandler,
				} as any,
				authInput: mockAuthInput,
			});

			expect(result.status).toBe(true);
			expect(result.data).toEqual({ processed: true, value: 42 });
			
			// Verify lifecycle order
			expect(executionOrder).toEqual([
				'1-auth',
				'2-global-before-hook',
				'3-handler',
				'2-global-after-hook',
			]);
		});
	});

	describe('Error Categories', () => {
		it('should return not-found error for missing service', async () => {
			const result = await executeUnified({
				serviceName: 'nonExistent',
				actionName: 'test',
				serverConfig: {
					services: [
						{
							name: 'other',
							description: 'Other service',
							actions: [
								{
									name: 'test',
									handler: (d: any) => Ok(d),
									type: 'custom',
									description: 'Test',
									validation: {},
									meta: {},
								},
							],
						},
					],
				} as any,
				authInput: mockAuthInput,
			});

		expect(result).toMatchObject({
			status: false,
			data: expect.objectContaining({
				error_category: 'not-found',
			}),
		});
		expect(result.data?.error_id).toBeDefined();
		});

		it('should return not-found error for missing action', async () => {
			const result = await executeUnified({
				serviceName: 'test',
				actionName: 'nonExistent',
				serverConfig: {
					services: [
						{
							name: 'test',
							description: 'Test service',
							actions: [
								{
									name: 'other',
									handler: (d: any) => Ok(d),
									type: 'custom',
									description: 'Test',
									validation: {},
									meta: {},
								},
							],
						},
					],
				} as any,
				authInput: mockAuthInput,
			});

		expect(result).toMatchObject({
			status: false,
			data: expect.objectContaining({
				error_category: 'not-found',
			}),
		});
		expect(result.data?.error_id).toBeDefined();
		});

		it('should return auth error category on auth failure', async () => {
			const mockAuthHandler = vi.fn(() =>
				Promise.resolve(safeError('Invalid token', 'auth-failed')),
			);

			const result = await executeUnified({
				serviceName: 'test',
				actionName: 'test',
				serverConfig: {
					services: [
						{
							name: 'test',
							description: 'Test service',
							actions: [
								{
									name: 'test',
									handler: (d: any) => Ok(d),
									type: 'custom',
									description: 'Test',
									validation: {},
									meta: {},
									isProtected: true,
								},
							],
						},
					],
					auth: { authHandler: mockAuthHandler },
				} as any,
				authInput: mockAuthInput,
			});

			expect(result).toMatchObject({
				status: false,
				data: expect.objectContaining({
					error_category: 'auth',
				}),
			});
		});

		it('should return execution error category for handler signature validation failure', async () => {
			const result = await executeUnified({
				serviceName: 'test',
				actionName: 'test',
				payload: {}, // Provide valid payload to pass validation
				serverConfig: {
					services: [
						{
							name: 'test',
							description: 'Test service',
							actions: [
								{
									name: 'test',
									handler: () => Ok({}), // Invalid: 0 parameters (should be 1-2)
									type: 'custom',
									description: 'Test',
									validation: {},
									meta: {},
									isProtected: false,
								},
							],
						},
					],
				} as any,
				authInput: mockAuthInput,
			});

		expect(result).toMatchObject({
			status: false,
			data: expect.objectContaining({
				error_category: 'execution',
			}),
		});
		expect(result.data?.error_id).toBeDefined();
		});
	});

	describe('Handler Signature Validation', () => {
		it('should pass for handler with 1 parameter', async () => {
			const result = await executeUnified({
				serviceName: 'test',
				actionName: 'test',
				payload: { value: 42 },
				serverConfig: {
					services: [
						{
							name: 'test',
							description: 'Test service',
							actions: [
								{
									name: 'test',
									handler: (data: any) => Ok(data),
									type: 'custom',
									description: 'Test',
									validation: {},
									meta: {},
									isProtected: false,
								},
							],
						},
					],
				} as any,
				authInput: mockAuthInput,
			});

			expect(result.status).toBe(true);
			expect(result.data).toEqual({ value: 42 });
		});

		it('should pass for handler with 2 parameters', async () => {
			const result = await executeUnified({
				serviceName: 'test',
				actionName: 'test',
				payload: { value: 42 },
				serverConfig: {
					services: [
						{
							name: 'test',
							description: 'Test service',
							actions: [
								{
									name: 'test',
									handler: (data: any, _ctx: any) => Ok(data),
									type: 'custom',
									description: 'Test',
									validation: {},
									meta: {},
									isProtected: false,
								},
							],
						},
					],
				} as any,
				authInput: mockAuthInput,
			});

			expect(result.status).toBe(true);
			expect(result.data).toEqual({ value: 42 });
		});
	});

	describe('Hook Integration', () => {
		it('should call onBeforeActionHandler', async () => {
			const mockBeforeActionHandler = vi.fn(() => Promise.resolve(Ok(true)));

			await executeUnified({
				serviceName: 'test',
				actionName: 'test',
				payload: { test: 'data' },
				serverConfig: {
					services: [
						{
							name: 'test',
							description: 'Test service',
							actions: [
								{
									name: 'test',
									handler: (d: any) => Ok(d),
									type: 'custom',
									description: 'Test',
									validation: {},
									meta: {},
									isProtected: false,
								},
							],
						},
					],
					onBeforeActionHandler: mockBeforeActionHandler,
				} as any,
				authInput: mockAuthInput,
			});

			expect(mockBeforeActionHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					nileContext: expect.anything(),
					action: expect.objectContaining({ name: 'test' }),
					payload: { test: 'data' },
				}),
			);
		});

		it('should call onAfterActionHandler', async () => {
			const mockAfterActionHandler = vi.fn(() => Promise.resolve(Ok(true)));

			await executeUnified({
				serviceName: 'test',
				actionName: 'test',
				payload: { test: 'data' },
				serverConfig: {
					services: [
						{
							name: 'test',
							description: 'Test service',
							actions: [
								{
									name: 'test',
									handler: (d: any) => Ok(d),
									type: 'custom',
									description: 'Test',
									validation: {},
									meta: {},
									isProtected: false,
								},
							],
						},
					],
					onAfterActionHandler: mockAfterActionHandler,
				} as any,
				authInput: mockAuthInput,
			});

			expect(mockAfterActionHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					nileContext: expect.anything(),
					action: expect.objectContaining({ name: 'test' }),
					payload: { test: 'data' },
					result: expect.anything(),
				}),
			);
		});
	});

	describe('Action-Level Hooks Integration', () => {
		describe('Before Hooks', () => {
			it('should transform input via single before hook', async () => {
				const result = await executeUnified({
					serviceName: 'test',
					actionName: 'mainAction',
					payload: { value: 10 },
					serverConfig: {
						services: [
							{
								name: 'test',
								description: 'Test service',
								actions: [
									{
										name: 'enrichData',
										handler: (input: any) => Ok({ ...input, enriched: true }),
										type: 'custom',
										description: 'Enrich hook',
										validation: {},
										meta: {},
									},
									{
										name: 'mainAction',
										handler: (input: any) => Ok({ result: input.value * 2, wasEnriched: input.enriched }),
										type: 'custom',
										description: 'Main action',
										validation: {},
										meta: {},
										isProtected: false,
										hooks: {
											before: [{ name: 'enrichData' }],
										},
									},
								],
							},
						],
					} as any,
					authInput: mockAuthInput,
				});

				expect(result.status).toBe(true);
				expect(result.data).toEqual({
					result: 20,
					wasEnriched: true,
				});
			});

			it('should chain multiple before hooks sequentially', async () => {
				const result = await executeUnified({
					serviceName: 'test',
					actionName: 'mainAction',
					payload: { value: 5 },
					serverConfig: {
						services: [
							{
								name: 'test',
								description: 'Test service',
								actions: [
									{
										name: 'addTen',
										handler: (input: any) => Ok({ ...input, value: input.value + 10 }),
										type: 'custom',
										description: 'Add 10',
										validation: {},
										meta: {},
									},
									{
										name: 'multiplyByTwo',
										handler: (input: any) => Ok({ ...input, value: input.value * 2 }),
										type: 'custom',
										description: 'Multiply by 2',
										validation: {},
										meta: {},
									},
									{
										name: 'mainAction',
										handler: (input: any) => Ok({ finalValue: input.value }),
										type: 'custom',
										description: 'Main action',
										validation: {},
										meta: {},
										isProtected: false,
										hooks: {
											before: [
												{ name: 'addTen' },
												{ name: 'multiplyByTwo' },
											],
										},
									},
								],
							},
						],
					} as any,
					authInput: mockAuthInput,
				});

				expect(result.status).toBe(true);
				expect(result.data.finalValue).toBe(30); // (5 + 10) * 2 = 30
			});

			it('should prevent handler execution when before hook fails', async () => {
				const handlerSpy = vi.fn((input: any) => Ok(input));

				const result = await executeUnified({
					serviceName: 'test',
					actionName: 'mainAction',
					payload: { value: 10 },
					serverConfig: {
						services: [
							{
								name: 'test',
								description: 'Test service',
								actions: [
								{
									name: 'failingHook',
									handler: (_input: any) => safeError('Hook validation failed', 'test-error-1'),
									type: 'custom',
									description: 'Failing hook',
									validation: {},
									meta: {},
								},
									{
										name: 'mainAction',
										handler: handlerSpy,
										type: 'custom',
										description: 'Main action',
										validation: {},
										meta: {},
										isProtected: false,
										hooks: {
											before: [{ name: 'failingHook' }],
										},
									},
								],
							},
						],
					} as any,
					authInput: mockAuthInput,
				});

				expect(result.status).toBe(false);
				expect(result.message).toContain('Hook validation failed');
				expect(handlerSpy).not.toHaveBeenCalled();
			});
		});

		describe('After Hooks', () => {
			it('should transform output via single after hook', async () => {
				const result = await executeUnified({
					serviceName: 'test',
					actionName: 'mainAction',
					payload: { value: 10 },
					serverConfig: {
						services: [
							{
								name: 'test',
								description: 'Test service',
								actions: [
									{
										name: 'formatOutput',
										handler: (input: any) => Ok({ formatted: true, data: input }),
										type: 'custom',
										description: 'Format hook',
										validation: {},
										meta: {},
									},
									{
										name: 'mainAction',
										handler: (input: any) => Ok({ result: input.value * 2 }),
										type: 'custom',
										description: 'Main action',
										validation: {},
										meta: {},
										isProtected: false,
										hooks: {
											after: [{ name: 'formatOutput' }],
										},
									},
								],
							},
						],
					} as any,
					authInput: mockAuthInput,
				});

				expect(result.status).toBe(true);
				expect(result.data).toEqual({
					formatted: true,
					data: { result: 20 },
				});
			});

			it('should chain multiple after hooks sequentially', async () => {
				const result = await executeUnified({
					serviceName: 'test',
					actionName: 'mainAction',
					payload: { value: 5 },
					serverConfig: {
						services: [
							{
								name: 'test',
								description: 'Test service',
								actions: [
									{
										name: 'addMetadata',
										handler: (input: any) => Ok({ ...input, metadata: { processed: true } }),
										type: 'custom',
										description: 'Add metadata',
										validation: {},
										meta: {},
									},
									{
										name: 'addTimestamp',
										handler: (input: any) => Ok({ ...input, timestamp: Date.now() }),
										type: 'custom',
										description: 'Add timestamp',
										validation: {},
										meta: {},
									},
									{
										name: 'mainAction',
										handler: (input: any) => Ok({ value: input.value * 2 }),
										type: 'custom',
										description: 'Main action',
										validation: {},
										meta: {},
										isProtected: false,
										hooks: {
											after: [
												{ name: 'addMetadata' },
												{ name: 'addTimestamp' },
											],
										},
									},
								],
							},
						],
					} as any,
					authInput: mockAuthInput,
				});

				expect(result.status).toBe(true);
				expect(result.data.value).toBe(10);
				expect(result.data.metadata).toEqual({ processed: true });
				expect(result.data.timestamp).toBeDefined();
			});

			it('should return error when after hook fails', async () => {
				const result = await executeUnified({
					serviceName: 'test',
					actionName: 'mainAction',
					payload: { value: 10 },
					serverConfig: {
						services: [
							{
								name: 'test',
								description: 'Test service',
								actions: [
								{
									name: 'failingHook',
									handler: (_input: any) => safeError('After hook processing failed', 'test-error-2'),
									type: 'custom',
									description: 'Failing hook',
									validation: {},
									meta: {},
								},
									{
										name: 'mainAction',
										handler: (input: any) => Ok({ result: input.value * 2 }),
										type: 'custom',
										description: 'Main action',
										validation: {},
										meta: {},
										isProtected: false,
										hooks: {
											after: [{ name: 'failingHook' }],
										},
									},
								],
							},
						],
					} as any,
					authInput: mockAuthInput,
				});

				expect(result.status).toBe(false);
				expect(result.message).toContain('After hook processing failed');
			});
		});

		describe('Mixed Hook Execution Order', () => {
			it('should execute hooks in correct order: global before -> action before -> handler -> action after -> global after', async () => {
				const executionOrder: string[] = [];

				const mockGlobalBefore = vi.fn(() => {
					executionOrder.push('1-global-before');
					return Promise.resolve(Ok(true));
				});

				const mockGlobalAfter = vi.fn(() => {
					executionOrder.push('5-global-after');
					return Promise.resolve(Ok(true));
				});

				const result = await executeUnified({
					serviceName: 'test',
					actionName: 'mainAction',
					payload: { value: 10 },
					serverConfig: {
						services: [
							{
								name: 'test',
								description: 'Test service',
								actions: [
									{
										name: 'actionBefore',
										handler: (input: any) => {
											executionOrder.push('2-action-before');
											return Ok(input);
										},
										type: 'custom',
										description: 'Action before hook',
										validation: {},
										meta: {},
									},
									{
										name: 'actionAfter',
										handler: (input: any) => {
											executionOrder.push('4-action-after');
											return Ok(input);
										},
										type: 'custom',
										description: 'Action after hook',
										validation: {},
										meta: {},
									},
									{
										name: 'mainAction',
										handler: (input: any) => {
											executionOrder.push('3-handler');
											return Ok(input);
										},
										type: 'custom',
										description: 'Main action',
										validation: {},
										meta: {},
										isProtected: false,
										hooks: {
											before: [{ name: 'actionBefore' }],
											after: [{ name: 'actionAfter' }],
										},
									},
								],
							},
						],
						onBeforeActionHandler: mockGlobalBefore,
						onAfterActionHandler: mockGlobalAfter,
					} as any,
					authInput: mockAuthInput,
				});

				expect(result.status).toBe(true);
				expect(executionOrder).toEqual([
					'1-global-before',
					'2-action-before',
					'3-handler',
					'4-action-after',
					'5-global-after',
				]);
			});

			it('should stop execution when action before hook fails and not call handler or after hooks', async () => {
				const handlerSpy = vi.fn((input: any) => Ok(input));
				const actionAfterSpy = vi.fn((input: any) => Ok(input));
				const globalAfterSpy = vi.fn(() => Promise.resolve(Ok(true)));

				const result = await executeUnified({
					serviceName: 'test',
					actionName: 'mainAction',
					payload: { value: 10 },
					serverConfig: {
						services: [
							{
								name: 'test',
								description: 'Test service',
								actions: [
								{
									name: 'failingBefore',
									handler: (_input: any) => safeError('Before hook failed', 'test-error-3'),
									type: 'custom',
									description: 'Failing before hook',
									validation: {},
									meta: {},
								},
									{
										name: 'actionAfter',
										handler: actionAfterSpy,
										type: 'custom',
										description: 'Action after hook',
										validation: {},
										meta: {},
									},
									{
										name: 'mainAction',
										handler: handlerSpy,
										type: 'custom',
										description: 'Main action',
										validation: {},
										meta: {},
										isProtected: false,
										hooks: {
											before: [{ name: 'failingBefore' }],
											after: [{ name: 'actionAfter' }],
										},
									},
								],
							},
						],
						onAfterActionHandler: globalAfterSpy,
					} as any,
					authInput: mockAuthInput,
				});

				expect(result.status).toBe(false);
				expect(handlerSpy).not.toHaveBeenCalled();
				expect(actionAfterSpy).not.toHaveBeenCalled();
				expect(globalAfterSpy).not.toHaveBeenCalled();
			});
		});

		describe('Combined Before and After Hooks', () => {
			it('should transform input via before hooks and output via after hooks', async () => {
				const result = await executeUnified({
					serviceName: 'test',
					actionName: 'mainAction',
					payload: { value: 10 },
					serverConfig: {
						services: [
							{
								name: 'test',
								description: 'Test service',
								actions: [
									{
										name: 'enrichInput',
										handler: (input: any) => Ok({ ...input, enriched: true }),
										type: 'custom',
										description: 'Enrich input',
										validation: {},
										meta: {},
									},
									{
										name: 'formatOutput',
										handler: (input: any) => Ok({ formatted: true, data: input }),
										type: 'custom',
										description: 'Format output',
										validation: {},
										meta: {},
									},
									{
										name: 'mainAction',
										handler: (input: any) => {
											expect(input.enriched).toBe(true);
											return Ok({ result: input.value * 2 });
										},
										type: 'custom',
										description: 'Main action',
										validation: {},
										meta: {},
										isProtected: false,
										hooks: {
											before: [{ name: 'enrichInput' }],
											after: [{ name: 'formatOutput' }],
										},
									},
								],
							},
						],
					} as any,
					authInput: mockAuthInput,
				});

				expect(result.status).toBe(true);
				expect(result.data).toEqual({
					formatted: true,
					data: { result: 20 },
				});
			});
		});
	});
});
