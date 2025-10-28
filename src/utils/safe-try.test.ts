import { describe, it, expect } from 'vitest';
import { Ok, safeError } from './safe-try';

describe('Ok', () => {
  it('should return an object with isOk: true', () => {
    const result = Ok({ foo: 'bar' }, 'All good');
    expect(result).toMatchObject({
      status: true,
      message: 'All good',
      data: { foo: 'bar' },
      isOk: true,
      isError: false,
    });
  });
});

describe('safeError', () => {
  it('should return an object with isError: true', () => {
    const result = safeError('Something went wrong', 'err-123', { extra: 42 });
    expect(result).toMatchObject({
      status: false,
      message: 'Something went wrong',
      data: expect.objectContaining({ error_id: 'err-123', extra: 42 }),
      isError: true,
      isOk: false,
    });
  });

  it('should default error_category to "execution" when not provided', () => {
    const result = safeError('Error message', 'err-001');
    expect(result.data.error_category).toBe('execution');
  });

  it('should accept "validation" error category', () => {
    const result = safeError('Validation failed', 'val-001', {
      error_category: 'validation',
    });
    expect(result.data.error_category).toBe('validation');
  });

  it('should accept "auth" error category', () => {
    const result = safeError('Authentication failed', 'auth-001', {
      error_category: 'auth',
    });
    expect(result.data.error_category).toBe('auth');
  });

  it('should accept "authorization" error category', () => {
    const result = safeError('Access denied', 'authz-001', {
      error_category: 'authorization',
    });
    expect(result.data.error_category).toBe('authorization');
  });

  it('should accept "not-found" error category', () => {
    const result = safeError('Resource not found', 'nf-001', {
      error_category: 'not-found',
    });
    expect(result.data.error_category).toBe('not-found');
  });

  it('should accept "database" error category', () => {
    const result = safeError('Database error', 'db-001', {
      error_category: 'database',
    });
    expect(result.data.error_category).toBe('database');
  });

  it('should accept "business" error category', () => {
    const result = safeError('Business logic error', 'biz-001', {
      error_category: 'business',
    });
    expect(result.data.error_category).toBe('business');
  });

  it('should preserve metadata while adding error_category', () => {
    const result = safeError('Error with metadata', 'err-002', {
      error_category: 'validation',
      field: 'email',
      reason: 'Invalid format',
    });
    expect(result.data).toMatchObject({
      error_id: 'err-002',
      error_category: 'validation',
      field: 'email',
      reason: 'Invalid format',
    });
  });

  it('should not duplicate error_category in metadata', () => {
    const result = safeError('Test error', 'err-003', {
      error_category: 'auth',
    });
    const keys = Object.keys(result.data);
    const categoryCount = keys.filter((k) => k === 'error_category').length;
    expect(categoryCount).toBe(1);
  });
});
