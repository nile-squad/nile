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
});
