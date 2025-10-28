import { describe, it, expect } from 'vitest';
import { cleanResponse } from './response-cleaner';
import { Ok, safeError } from '../../utils/safe-try';

describe('cleanResponse', () => {
	it('should strip internal fields from Ok result', () => {
		const result = Ok({ userId: '123', name: 'Test' }, 'User fetched successfully');
		const cleaned = cleanResponse(result);

		expect(cleaned).toEqual({
			status: true,
			message: 'User fetched successfully',
			data: { userId: '123', name: 'Test' },
		});
		expect(cleaned).not.toHaveProperty('isOk');
		expect(cleaned).not.toHaveProperty('isError');
	});

	it('should strip internal fields from safeError result', () => {
		const result = safeError('Failed to fetch user', 'error-123', { retryable: true });
		const cleaned = cleanResponse(result);

		expect(cleaned).toEqual({
			status: false,
			message: 'Failed to fetch user',
			data: expect.objectContaining({
				error_id: expect.any(String),
				retryable: true,
			}),
		});
		expect(cleaned).not.toHaveProperty('isOk');
		expect(cleaned).not.toHaveProperty('isError');
	});

	it('should preserve all public fields from Ok result', () => {
		const result = Ok({ items: [1, 2, 3], count: 3 }, 'Items retrieved');
		const cleaned = cleanResponse(result);

		expect(cleaned.status).toBe(true);
		expect(cleaned.message).toBe('Items retrieved');
		expect(cleaned.data).toEqual({ items: [1, 2, 3], count: 3 });
	});

	it('should preserve all public fields from error result', () => {
		const result = safeError('Validation failed', 'val-error', { 
			field: 'email',
			reason: 'Invalid format' 
		});
		const cleaned = cleanResponse(result);

		expect(cleaned.status).toBe(false);
		expect(cleaned.message).toBe('Validation failed');
		expect(cleaned.data).toMatchObject({
			field: 'email',
			reason: 'Invalid format',
		});
	});

	it('should handle result with null data', () => {
		const result = Ok(null, 'No data');
		const cleaned = cleanResponse(result);

		expect(cleaned).toEqual({
			status: true,
			message: 'No data',
			data: null,
		});
	});

	it('should handle result with undefined data', () => {
		const result = Ok(undefined, 'No data');
		const cleaned = cleanResponse(result);

		expect(cleaned).toEqual({
			status: true,
			message: 'No data',
			data: undefined,
		});
	});

	it('should handle result with empty object data', () => {
		const result = Ok({}, 'Empty object');
		const cleaned = cleanResponse(result);

		expect(cleaned).toEqual({
			status: true,
			message: 'Empty object',
			data: {},
		});
	});

	it('should handle result with nested object data', () => {
		const result = Ok(
			{ 
				user: { id: '123', profile: { name: 'Test', age: 30 } },
				metadata: { timestamp: '2024-01-01' }
			}, 
			'Complex data'
		);
		const cleaned = cleanResponse(result);

		expect(cleaned.data).toEqual({
			user: { id: '123', profile: { name: 'Test', age: 30 } },
			metadata: { timestamp: '2024-01-01' }
		});
	});

	it('should not mutate the original result object', () => {
		const result = Ok({ value: 42 }, 'Test');
		const originalIsOk = (result as any).isOk;
		const originalIsError = (result as any).isError;

		cleanResponse(result);

		expect((result as any).isOk).toBe(originalIsOk);
		expect((result as any).isError).toBe(originalIsError);
	});

	it('should return a new object, not a reference', () => {
		const result = Ok({ value: 42 }, 'Test');
		const cleaned = cleanResponse(result);

		expect(cleaned).not.toBe(result);
	});
});
