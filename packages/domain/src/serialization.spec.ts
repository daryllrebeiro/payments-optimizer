/**
 * Tests for DomainSerializer (Epic 1.3)
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  DomainSerializer,
  SerializationError,
  SERIALIZATION_VERSION,
} from './serialization.js';

describe('DomainSerializer', () => {
  describe('BigInt handling', () => {
    it('should serialize and deserialize BigInt values', () => {
      const data = {
        amount: 123456789n,
        balance: -987654321n,
      };

      const schema = z.object({
        amount: z.bigint(),
        balance: z.bigint(),
      });

      const serialized = DomainSerializer.serialize(data, schema);
      const deserialized = DomainSerializer.deserialize(serialized, schema);

      expect(deserialized.amount).toBe(123456789n);
      expect(deserialized.balance).toBe(-987654321n);
    });

    it('should handle nested BigInt values', () => {
      const data = {
        user: {
          id: 'user-1',
          balance: 50000n,
        },
        transactions: [
          { amount: 1000n },
          { amount: 2000n },
        ],
      };

      const schema = z.object({
        user: z.object({
          id: z.string(),
          balance: z.bigint(),
        }),
        transactions: z.array(
          z.object({
            amount: z.bigint(),
          })
        ),
      });

      const serialized = DomainSerializer.serialize(data, schema);
      const deserialized = DomainSerializer.deserialize(serialized, schema);

      expect(deserialized.user.balance).toBe(50000n);
      expect(deserialized.transactions[0]?.amount).toBe(1000n);
      expect(deserialized.transactions[1]?.amount).toBe(2000n);
    });
  });

  describe('Date handling', () => {
    it('should serialize and deserialize Date values', () => {
      const testDate = new Date('2026-09-07T00:00:00.000Z');
      const data = {
        createdAt: testDate,
        updatedAt: new Date('2026-09-08T12:30:00.000Z'),
      };

      // Use coerce to handle potential Date reconstruction issues
      const schema = z.object({
        createdAt: z.coerce.date(),
        updatedAt: z.coerce.date(),
      });

      const serialized = DomainSerializer.serialize(data, schema);
      const deserialized = DomainSerializer.deserialize(serialized, schema);

      expect(deserialized.createdAt).toEqual(testDate);
      expect(deserialized.updatedAt.toISOString()).toBe('2026-09-08T12:30:00.000Z');
    });
  });

  describe('Schema versioning', () => {
    it('should include schema version in envelope', () => {
      const data = { value: 'test' };
      const schema = z.object({ value: z.string() });

      const serialized = DomainSerializer.serialize(data, schema);
      const parsed = JSON.parse(serialized);

      expect(parsed.schemaVersion).toBe(SERIALIZATION_VERSION);
      expect(parsed.data).toEqual(data);
    });

    it('should include timestamp when requested', () => {
      const data = { value: 'test' };
      const schema = z.object({ value: z.string() });
      const beforeTime = Date.now();

      const serialized = DomainSerializer.serialize(data, schema, { includeTimestamp: true });
      const parsed = JSON.parse(serialized);

      const afterTime = Date.now();

      expect(parsed.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(parsed.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should allow older schema versions by default', () => {
      const data = { value: 'test' };
      const schema = z.object({ value: z.string() });

      // Simulate older version
      const serialized = DomainSerializer.serialize(data, schema, { schemaVersion: SERIALIZATION_VERSION - 1 });
      
      // Should not throw
      const deserialized = DomainSerializer.deserialize(serialized, schema);
      expect(deserialized.value).toBe('test');
    });

    it('should reject older versions when not allowed', () => {
      const data = { value: 'test' };
      const schema = z.object({ value: z.string() });

      const serialized = DomainSerializer.serialize(data, schema, { schemaVersion: SERIALIZATION_VERSION - 1 });
      
      expect(() =>
        DomainSerializer.deserialize(serialized, schema, { allowOlderVersions: false })
      ).toThrow(SerializationError);
    });

    it('should reject future schema versions', () => {
      const data = { value: 'test' };
      const schema = z.object({ value: z.string() });

      const serialized = DomainSerializer.serialize(data, schema, { schemaVersion: SERIALIZATION_VERSION + 1 });
      
      expect(() =>
        DomainSerializer.deserialize(serialized, schema)
      ).toThrow(SerializationError);
    });
  });

  describe('Validation', () => {
    it('should validate before serialization', () => {
      const invalidData = { age: 'not a number' };
      const schema = z.object({ age: z.number() });

      expect(() =>
        DomainSerializer.serialize(invalidData as any, schema)
      ).toThrow(SerializationError);
    });

    it('should validate after deserialization', () => {
      const data = { age: 25 };
      const schema = z.object({ age: z.number() });

      const serialized = DomainSerializer.serialize(data, schema);
      
      // Manually corrupt the data
      const corrupted = serialized.replace('"age":25', '"age":"invalid"');
      
      expect(() =>
        DomainSerializer.deserialize(corrupted, schema)
      ).toThrow(SerializationError);
    });

    it('should provide validation error details', () => {
      const invalidData = { age: -5 };
      const schema = z.object({ age: z.number().min(0) });

      try {
        DomainSerializer.serialize(invalidData, schema);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SerializationError);
        expect((error as SerializationError).code).toBe('VALIDATION_FAILED');
        expect((error as SerializationError).details).toBeDefined();
      }
    });
  });

  describe('Timestamp validation', () => {
    it('should reject expired data when maxAge specified', async () => {
      const data = { value: 'test' };
      const schema = z.object({ value: z.string() });

      const serialized = DomainSerializer.serialize(data, schema, { includeTimestamp: true });
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(() =>
        DomainSerializer.deserialize(serialized, schema, { maxAge: 10 })
      ).toThrow(SerializationError);
    });

    it('should accept recent data within maxAge', () => {
      const data = { value: 'test' };
      const schema = z.object({ value: z.string() });

      const serialized = DomainSerializer.serialize(data, schema, { includeTimestamp: true });
      
      // Should not throw
      const deserialized = DomainSerializer.deserialize(serialized, schema, { maxAge: 1000 });
      expect(deserialized.value).toBe('test');
    });
  });

  describe('Complex objects', () => {
    it('should handle complex nested structures', () => {
      const data = {
        user: {
          id: 'user-123',
          balance: 50000n,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          settings: {
            theme: 'dark',
            notifications: true,
          },
        },
        transactions: [
          {
            id: 'tx-1',
            amount: 1000n,
            timestamp: new Date('2026-09-01T10:00:00.000Z'),
          },
          {
            id: 'tx-2',
            amount: 2000n,
            timestamp: new Date('2026-09-02T15:30:00.000Z'),
          },
        ],
      };

      const schema = z.object({
        user: z.object({
          id: z.string(),
          balance: z.bigint(),
          createdAt: z.coerce.date(),
          settings: z.object({
            theme: z.string(),
            notifications: z.boolean(),
          }),
        }),
        transactions: z.array(
          z.object({
            id: z.string(),
            amount: z.bigint(),
            timestamp: z.coerce.date(),
          })
        ),
      });

      const serialized = DomainSerializer.serialize(data, schema);
      const deserialized = DomainSerializer.deserialize(serialized, schema);

      expect(deserialized.user.balance).toBe(50000n);
      expect(deserialized.user.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
      expect(deserialized.transactions[0]?.amount).toBe(1000n);
      expect(deserialized.transactions[1]?.timestamp).toEqual(new Date('2026-09-02T15:30:00.000Z'));
    });
  });

  describe('Simple serialization (legacy compatibility)', () => {
    it('should serialize without envelope', () => {
      const data = { value: 'test', amount: 1000n };
      
      const serialized = DomainSerializer.serializeSimple(data);
      const parsed = JSON.parse(serialized);
      
      // No envelope, direct data
      expect(parsed.__type).toBeUndefined();
      expect(parsed.amount).toEqual({ __type: 'bigint', value: '1000' });
    });

    it('should deserialize without validation', () => {
      const data = { value: 'test', amount: 1000n };
      
      const serialized = DomainSerializer.serializeSimple(data);
      const deserialized = DomainSerializer.deserializeSimple<typeof data>(serialized);
      
      expect(deserialized.value).toBe('test');
      expect(deserialized.amount).toBe(1000n);
    });
  });

  describe('Error handling', () => {
    it('should throw SerializationError with proper code', () => {
      const data = { value: 'test' };
      const schema = z.object({ value: z.number() }); // Type mismatch

      try {
        DomainSerializer.serialize(data as any, schema);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SerializationError);
        expect((error as SerializationError).code).toBe('VALIDATION_FAILED');
      }
    });

    it('should handle malformed JSON gracefully', () => {
      const schema = z.object({ value: z.string() });

      expect(() =>
        DomainSerializer.deserialize('{ invalid json', schema)
      ).toThrow(SerializationError);
    });

    it('should handle missing envelope fields', () => {
      const schema = z.object({ value: z.string() });
      const malformed = JSON.stringify({ data: { value: 'test' } }); // Missing schemaVersion

      expect(() =>
        DomainSerializer.deserialize(malformed, schema)
      ).toThrow(SerializationError);
    });
  });

  describe('Pretty printing', () => {
    it('should format JSON with indentation when pretty=true', () => {
      const data = { value: 'test' };
      const schema = z.object({ value: z.string() });

      const serialized = DomainSerializer.serialize(data, schema, { pretty: true });
      
      expect(serialized).toContain('\n');
      expect(serialized).toContain('  ');
    });

    it('should format JSON compactly when pretty=false', () => {
      const data = { value: 'test' };
      const schema = z.object({ value: z.string() });

      const serialized = DomainSerializer.serialize(data, schema, { pretty: false });
      
      expect(serialized).not.toContain('\n  ');
    });
  });
});
