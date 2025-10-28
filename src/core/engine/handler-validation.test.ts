import { describe, it, expect } from 'vitest';
import { validateHandlerSignature, isSafeResult } from './handler-validation';
import { Ok, safeError } from '../../utils/safe-try';

describe('validateHandlerSignature', () => {
	it('should pass for valid handler with 1 parameter', () => {
		const handler = (data: unknown) => Ok(data);
		expect(() => validateHandlerSignature(handler)).not.toThrow();
	});

	it('should pass for valid handler with 2 parameters', () => {
		const handler = (data: unknown, _context: unknown) => Ok(data);
		expect(() => validateHandlerSignature(handler)).not.toThrow();
	});

	it('should throw error for non-function handler', () => {
		const invalidHandler = 'not a function' as any;
		expect(() => validateHandlerSignature(invalidHandler)).toThrow(
			'Handler must be a function'
		);
	});

	it('should throw error for handler with 0 parameters', () => {
		const handler = () => Ok({});
		expect(() => validateHandlerSignature(handler)).toThrow(
			'Handler must accept 1-2 parameters (data, context?), got 0'
		);
	});

	it('should throw error for handler with more than 2 parameters', () => {
		const handler = (_a: unknown, _b: unknown, _c: unknown) => Ok({});
		expect(() => validateHandlerSignature(handler)).toThrow(
			'Handler must accept 1-2 parameters (data, context?), got 3'
		);
	});

	it('should pass for async handler with 1 parameter', () => {
		const handler = async (data: unknown) => Ok(data);
		expect(() => validateHandlerSignature(handler)).not.toThrow();
	});

	it('should pass for async handler with 2 parameters', () => {
		const handler = async (data: unknown, _context: unknown) => Ok(data);
		expect(() => validateHandlerSignature(handler)).not.toThrow();
	});
});

describe('isSafeResult', () => {
	it('should return true for valid Ok result', () => {
		const result = Ok({ foo: 'bar' }, 'Success');
		expect(isSafeResult(result)).toBe(true);
	});

	it('should return true for valid safeError result', () => {
		const result = safeError('Error message', 'error-id');
		expect(isSafeResult(result)).toBe(true);
	});

	it('should return true for minimal SafeResult structure', () => {
		const result = {
			status: true,
			message: 'Test',
			data: null,
		};
		expect(isSafeResult(result)).toBe(true);
	});

	it('should return false for null', () => {
		expect(isSafeResult(null)).toBe(false);
	});

	it('should return false for undefined', () => {
		expect(isSafeResult(undefined)).toBe(false);
	});

	it('should return false for primitive values', () => {
		expect(isSafeResult('string')).toBe(false);
		expect(isSafeResult(123)).toBe(false);
		expect(isSafeResult(true)).toBe(false);
	});

	it('should return false for object missing status field', () => {
		const result = {
			message: 'Test',
			data: {},
		};
		expect(isSafeResult(result)).toBe(false);
	});

	it('should return false for object with non-boolean status', () => {
		const result = {
			status: 'true' as any,
			message: 'Test',
			data: {},
		};
		expect(isSafeResult(result)).toBe(false);
	});

	it('should return false for object missing message field', () => {
		const result = {
			status: true,
			data: {},
		};
		expect(isSafeResult(result)).toBe(false);
	});

	it('should return false for object missing data field', () => {
		const result = {
			status: true,
			message: 'Test',
		};
		expect(isSafeResult(result)).toBe(false);
	});

	it('should return false for array', () => {
		const result = [1, 2, 3];
		expect(isSafeResult(result)).toBe(false);
	});

	it('should return true for SafeResult with extra fields', () => {
		const result = {
			status: true,
			message: 'Test',
			data: {},
			isOk: true,
			isError: false,
			extraField: 'extra',
		};
		expect(isSafeResult(result)).toBe(true);
	});
});
