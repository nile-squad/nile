import { describe, expect, it } from 'vitest';
import { pgTable, text, uuid, timestamp, integer } from 'drizzle-orm/pg-core';
import { getValidationSchema } from './validation-utils';
import { z } from 'zod';

// Test table schema
const testUsers = pgTable('test_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  age: integer('age'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

describe('getValidationSchema', () => {
  describe('operation: create', () => {
    it('should generate strict schema for create operation', () => {
      const schema = getValidationSchema({
        inferTable: testUsers,
        context: { operation: 'create' },
      });

      // Should be strict - no extra fields allowed
      const validData = { name: 'John', email: 'john@example.com', age: 30 };
      const result = schema.safeParse(validData);
      expect(result.success).toBe(true);

      // Should reject extra fields
      const dataWithExtra = { ...validData, extraField: 'test' };
      const resultWithExtra = schema.safeParse(dataWithExtra);
      expect(resultWithExtra.success).toBe(false);
    });

    it('should handle DB-generated fields as optional', () => {
      const schema = getValidationSchema({
        inferTable: testUsers,
        context: { operation: 'create' },
      });

      // id, created_at, updated_at have defaults - should be optional
      const minimalData = { name: 'John', email: 'john@example.com' };
      const result = schema.safeParse(minimalData);
      expect(result.success).toBe(true);
    });

    it('should respect omitFields', () => {
      const schema = getValidationSchema({
        inferTable: testUsers,
        omitFields: ['id', 'created_at', 'updated_at'],
        context: { operation: 'create' },
      });

      const data = { name: 'John', email: 'john@example.com' };
      const result = schema.safeParse(data);
      expect(result.success).toBe(true);

      // Should not have omitted fields in schema
      const shape = schema.shape;
      expect(shape.id).toBeUndefined();
      expect(shape.created_at).toBeUndefined();
      expect(shape.updated_at).toBeUndefined();
    });

    it('should apply custom validations', () => {
      const schema = getValidationSchema({
        inferTable: testUsers,
        customValidations: {
          name: z.string().min(3, 'Name must be at least 3 characters'),
        },
        context: { operation: 'create' },
      });

      const shortName = { name: 'Jo', email: 'john@example.com' };
      const result = schema.safeParse(shortName);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 3 characters');
      }

      const validName = { name: 'John', email: 'john@example.com' };
      const validResult = schema.safeParse(validName);
      expect(validResult.success).toBe(true);
    });

    it('should use strict mode by default', () => {
      const schema = getValidationSchema({
        inferTable: testUsers,
        validationMode: 'auto',
        context: { operation: 'create' },
      });

      const dataWithExtra = { 
        name: 'John', 
        email: 'john@example.com',
        unknownField: 'value'
      };
      const result = schema.safeParse(dataWithExtra);
      expect(result.success).toBe(false);
    });
  });

  describe('operation: update', () => {
    it('should generate partial schema for update operation', () => {
      const schema = getValidationSchema({
        inferTable: testUsers,
        context: { operation: 'update' },
      });

      // All fields should be optional
      const partialData = { name: 'John' };
      const result = schema.safeParse(partialData);
      expect(result.success).toBe(true);

      const anotherPartial = { email: 'new@example.com', age: 25 };
      const result2 = schema.safeParse(anotherPartial);
      expect(result2.success).toBe(true);

      // Empty update should be valid
      const emptyUpdate = {};
      const result3 = schema.safeParse(emptyUpdate);
      expect(result3.success).toBe(true);
    });

    it('should use insertSchema for update (not selectSchema)', () => {
      const schema = getValidationSchema({
        inferTable: testUsers,
        context: { operation: 'update' },
      });

      // Should accept insert-compatible fields
      const updateData = { name: 'Updated Name', age: 35 };
      const result = schema.safeParse(updateData);
      expect(result.success).toBe(true);
    });

    it('should apply custom validations to updates', () => {
      const schema = getValidationSchema({
        inferTable: testUsers,
        customValidations: {
          email: z.string().email('Invalid email format'),
        },
        context: { operation: 'update' },
      });

      const invalidEmail = { email: 'not-an-email' };
      const result = schema.safeParse(invalidEmail);
      expect(result.success).toBe(false);

      const validEmail = { email: 'valid@example.com' };
      const result2 = schema.safeParse(validEmail);
      expect(result2.success).toBe(true);
    });
  });

  describe('operation: read', () => {
    it('should generate partial.strict schema for read operation', () => {
      const schema = getValidationSchema({
        inferTable: testUsers,
        context: { operation: 'read' },
      });

      // All fields should be optional
      const singleField = { name: 'John' };
      const result = schema.safeParse(singleField);
      expect(result.success).toBe(true);

      // Multiple fields should be valid
      const multipleFields = { name: 'John', email: 'john@example.com' };
      const result2 = schema.safeParse(multipleFields);
      expect(result2.success).toBe(true);

      // Empty should be valid
      const empty = {};
      const result3 = schema.safeParse(empty);
      expect(result3.success).toBe(true);
    });

    it('should reject unknown fields in read operation', () => {
      const schema = getValidationSchema({
        inferTable: testUsers,
        context: { operation: 'read' },
      });

      // Should reject fields not in table schema
      const unknownField = { unknownColumn: 'value' };
      const result = schema.safeParse(unknownField);
      expect(result.success).toBe(false);

      const mixedFields = { name: 'John', invalidField: 'test' };
      const result2 = schema.safeParse(mixedFields);
      expect(result2.success).toBe(false);
    });

    it('should use selectSchema for read operation', () => {
      const schema = getValidationSchema({
        inferTable: testUsers,
        context: { operation: 'read' },
      });

      // Should accept all table columns
      const allFields = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John',
        email: 'john@example.com',
        age: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };
      const result = schema.safeParse(allFields);
      expect(result.success).toBe(true);
    });
  });

  describe('operation: other', () => {
    it('should use default selectSchema for other operations', () => {
      const schema = getValidationSchema({
        inferTable: testUsers,
        context: { operation: 'other' },
      });

      // 'other' operations with selectSchema expect complete data
      const data = { 
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John',
        email: 'john@example.com',
        age: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };
      const result = schema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('validationMode', () => {
    it('should enforce strict mode when explicitly set', () => {
      const schema = getValidationSchema({
        inferTable: testUsers,
        validationMode: 'strict',
        context: { operation: 'update' }, // Even on update
      });

      const dataWithExtra = { name: 'John', extraField: 'test' };
      const result = schema.safeParse(dataWithExtra);
      expect(result.success).toBe(false);
    });

    it('should enforce partial mode when explicitly set', () => {
      const schema = getValidationSchema({
        inferTable: testUsers,
        validationMode: 'partial',
        context: { operation: 'create' }, // Even on create
      });

      // Partial should allow incomplete data even for create
      const partialData = { name: 'John' }; // Missing required email
      const result = schema.safeParse(partialData);
      expect(result.success).toBe(true);
    });
  });

  describe('validationModifierHandler', () => {
    it('should apply custom modifier to schema', () => {
      const schema = getValidationSchema({
        inferTable: testUsers,
        validationModifierHandler: (baseSchema) => {
          return baseSchema.extend({
            customField: z.string().optional(),
          });
        },
        context: { operation: 'create' },
      });

      const dataWithCustom = {
        name: 'John',
        email: 'john@example.com',
        customField: 'custom value',
      };
      const result = schema.safeParse(dataWithCustom);
      expect(result.success).toBe(true);
    });
  });

  describe('custom zodSchema', () => {
    it('should use custom zodSchema when provided', () => {
      const customSchema = z.object({
        username: z.string().min(3),
        password: z.string().min(8),
      });

      const schema = getValidationSchema({
        zodSchema: customSchema,
        context: { operation: 'create' },
      });

      const validData = { username: 'john', password: 'password123' };
      const result = schema.safeParse(validData);
      expect(result.success).toBe(true);

      const invalidData = { username: 'jo', password: 'short' };
      const result2 = schema.safeParse(invalidData);
      expect(result2.success).toBe(false);
    });

    it('should ignore inferTable when zodSchema is provided', () => {
      const customSchema = z.object({
        customField: z.string(),
      });

      const schema = getValidationSchema({
        inferTable: testUsers, // Should be ignored
        zodSchema: customSchema,
        context: { operation: 'create' },
      });

      // Should only accept custom schema fields
      const data = { customField: 'value' };
      const result = schema.safeParse(data);
      expect(result.success).toBe(true);

      // Should reject table fields
      const tableData = { name: 'John', email: 'john@example.com' };
      const result2 = schema.safeParse(tableData);
      expect(result2.success).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle no inferTable and no zodSchema', () => {
      const schema = getValidationSchema({
        context: { operation: 'create' },
      });

      // Should return empty object schema
      const result = schema.safeParse({});
      expect(result.success).toBe(true);

      const result2 = schema.safeParse({ anyField: 'value' });
      expect(result2.success).toBe(true);
    });

    it('should default to "other" operation when not specified', () => {
      const schema = getValidationSchema({
        inferTable: testUsers,
      });

      // For 'other' operation with selectSchema, use complete data
      const data = { 
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John',
        email: 'john@example.com',
        age: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };
      const result = schema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});

