import { expect, test, describe } from 'vitest';
import { hasExpired } from '../utils';

describe('hasExpired function tests', () => {
  test('1 hour bundle - not expired', () => {
    const createdAt = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 minutes ago

    expect(hasExpired(1, 'hour', createdAt)).toBe(false);
  });

  test('1 hour bundle - expired', () => {
    const createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago

    expect(hasExpired(1, 'hour', createdAt)).toBe(true);
  });

  test('1 day bundle - not expired', () => {
    const createdAt = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(); // 12 hours ago

    expect(hasExpired(1, 'day', createdAt)).toBe(false);
  });

  test('1 day bundle - expired', () => {
    const createdAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago

    expect(hasExpired(1, 'day', createdAt)).toBe(true);
  });

  test('1 week bundle - not expired', () => {
    const createdAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days ago

    expect(hasExpired(1, 'week', createdAt)).toBe(false);
  });

  test('1 week bundle - expired', () => {
    const createdAt = new Date(Date.now() - 2 * 7 * 24 * 60 * 60 * 1000).toISOString(); // 2 weeks ago

    expect(hasExpired(1, 'week', createdAt)).toBe(true);
  });
});

// console.log('test', hasExpired(1, 'week', '2024-12-30 15:02:03.070583+00'));
