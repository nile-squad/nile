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

			const mockOnActionHandler = vi.fn((ctx: any, action: any, payload: any, stage: string) => {
				executionOrder.push(`2-global-${stage}-hook`);
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
					onActionHandler: mockOnActionHandler,
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
					error_id: 'service-not-found',
				}),
			});
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
					error_id: 'action-not-found',
				}),
			});
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
					error_id: 'handler-signature-invalid',
				}),
			});
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
		it('should call onActionHandler with before stage', async () => {
			const mockOnActionHandler = vi.fn(() => Promise.resolve(Ok(true)));

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
					onActionHandler: mockOnActionHandler,
				} as any,
				authInput: mockAuthInput,
			});

			expect(mockOnActionHandler).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ name: 'test' }),
				{ test: 'data' },
				'before',
			);
		});

		it('should call onActionHandler with after stage', async () => {
			const mockOnActionHandler = vi.fn(() => Promise.resolve(Ok(true)));

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
					onActionHandler: mockOnActionHandler,
				} as any,
				authInput: mockAuthInput,
			});

			expect(mockOnActionHandler).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				expect.anything(),
				'after',
			);
		});
	});
});
