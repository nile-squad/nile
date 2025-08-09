import { describe, expect, it } from 'vitest';
import {
  validateTimezone,
  parseAtWithTimezone,
} from './time-utils';

describe('TimeUtils - Timezone Support', () => {
  describe('validateTimezone', () => {
    it('should validate IANA timezone names correctly', () => {
      expect(validateTimezone('America/New_York')).toBe(true);
      expect(validateTimezone('Europe/London')).toBe(true);
      expect(validateTimezone('UTC')).toBe(true);
      expect(validateTimezone('Asia/Tokyo')).toBe(true);
      expect(validateTimezone('Invalid/Timezone')).toBe(false);
      expect(validateTimezone('NotATimezone')).toBe(false);
      expect(validateTimezone('America/NonExistent')).toBe(false);
    });
  });

  describe('parseAtWithTimezone', () => {
    it('should parse datetime string with timezone', () => {
      const result = parseAtWithTimezone('2024-12-25T09:00:00', 'America/New_York');
      
      expect(result.timezone).toBe('America/New_York');
      expect(result.utcTimestamp).toBeDefined();
      // The timestamp should be valid ISO string
      expect(new Date(result.utcTimestamp).toISOString()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should use UTC when no timezone provided', () => {
      const result = parseAtWithTimezone('2024-12-25T09:00:00');
      
      expect(result.timezone).toBe('UTC');
      // For UTC timezone, should parse as-is
      expect(result.utcTimestamp).toBe('2024-12-25T09:00:00.000Z');
    });

    it('should throw error for invalid timezone', () => {
      expect(() => {
        parseAtWithTimezone('2024-12-25T09:00:00', 'Invalid/Timezone');
      }).toThrow('Invalid timezone: Invalid/Timezone');
    });

    it('should throw error for invalid date format', () => {
      expect(() => {
        parseAtWithTimezone('invalid-date', 'America/New_York');
      }).toThrow('Invalid date format: invalid-date');
    });
  });
});