/**
 * Domain Serializer with Schema Versioning and Validation
 * Epic 1.3: Handles BigInt, Date, nested objects with Zod validation
 */

import { z, type ZodSchema } from 'zod';

/**
 * Current serialization format version
 */
export const SERIALIZATION_VERSION = 1;

/**
 * Serialized envelope with schema version
 */
export interface SerializedEnvelope<T = unknown> {
  schemaVersion: number;
  data: T;
  timestamp?: number;
}

/**
 * Serialization options
 */
export interface SerializationOptions {
  /**
   * Include timestamp in envelope
   * @default false
   */
  includeTimestamp?: boolean;

  /**
   * Pretty-print JSON output
   * @default false
   */
  pretty?: boolean;

  /**
   * Override schema version (for testing/migration)
   * @default SERIALIZATION_VERSION
   */
  schemaVersion?: number;
}

/**
 * Deserialization options
 */
export interface DeserializationOptions {
  /**
   * Allow deserialization of older schema versions
   * @default true
   */
  allowOlderVersions?: boolean;

  /**
   * Maximum age in ms for timestamp validation (0 = no limit)
   * @default 0
   */
  maxAge?: number;
}

/**
 * Serialization/Deserialization errors
 */
export class SerializationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'SERIALIZATION_FAILED'
      | 'DESERIALIZATION_FAILED'
      | 'VALIDATION_FAILED'
      | 'VERSION_MISMATCH'
      | 'EXPIRED',
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'SerializationError';
  }
}

/**
 * Custom replacer that handles BigInt and Date
 */
function serializationReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return { __type: 'bigint', value: value.toString() };
  }
  if (value instanceof Date) {
    return { __type: 'date', value: value.toISOString() };
  }
  return value;
}

/**
 * Custom reviver that reconstructs BigInt and Date
 */
function deserializationReviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && '__type' in value && 'value' in value) {
    const typed = value as { __type: string; value: string };

    if (typed.__type === 'bigint') {
      return BigInt(typed.value);
    }
    if (typed.__type === 'date') {
      return new Date(typed.value);
    }
  }
  return value;
}

/**
 * Domain serializer with schema versioning and type-safe validation
 */
export class DomainSerializer {
  /**
   * Serializes an object to JSON string with schema versioning
   *
   * @param data - Object to serialize
   * @param schema - Optional Zod schema for validation before serialization
   * @param options - Serialization options
   * @returns JSON string with schema version envelope
   */
  static serialize<T>(data: T, schema?: ZodSchema<T>, options: SerializationOptions = {}): string {
    const {
      includeTimestamp = false,
      pretty = false,
      schemaVersion = SERIALIZATION_VERSION,
    } = options;

    try {
      // Validate before serialization if schema provided
      if (schema) {
        const result = schema.safeParse(data);
        if (!result.success) {
          throw new SerializationError(
            'Validation failed before serialization',
            'VALIDATION_FAILED',
            result.error.errors
          );
        }
      }

      const envelope: SerializedEnvelope<T> = {
        schemaVersion,
        data,
        ...(includeTimestamp ? { timestamp: Date.now() } : {}),
      };

      const jsonString = JSON.stringify(envelope, serializationReplacer, pretty ? 2 : undefined);
      return jsonString;
    } catch (error) {
      if (error instanceof SerializationError) {
        throw error;
      }
      throw new SerializationError(
        `Serialization failed: ${error instanceof Error ? error.message : String(error)}`,
        'SERIALIZATION_FAILED',
        error
      );
    }
  }

  /**
   * Deserializes JSON string to typed object with validation
   *
   * @param json - JSON string to deserialize
   * @param schema - Zod schema for validation after deserialization
   * @param options - Deserialization options
   * @returns Deserialized and validated object
   */
  static deserialize<T>(
    json: string,
    schema: ZodSchema<T>,
    options: DeserializationOptions = {}
  ): T {
    const { allowOlderVersions = true, maxAge = 0 } = options;

    try {
      // Parse JSON with custom reviver
      const envelope = JSON.parse(json, deserializationReviver) as SerializedEnvelope<T>;

      // Validate envelope structure
      if (!envelope || typeof envelope !== 'object') {
        throw new SerializationError('Invalid envelope structure', 'DESERIALIZATION_FAILED');
      }

      if (typeof envelope.schemaVersion !== 'number') {
        throw new SerializationError('Missing or invalid schemaVersion', 'DESERIALIZATION_FAILED');
      }

      // Check schema version
      if (envelope.schemaVersion > SERIALIZATION_VERSION) {
        throw new SerializationError(
          `Unsupported schema version ${envelope.schemaVersion} (current: ${SERIALIZATION_VERSION})`,
          'VERSION_MISMATCH'
        );
      }

      if (!allowOlderVersions && envelope.schemaVersion < SERIALIZATION_VERSION) {
        throw new SerializationError(
          `Schema version ${envelope.schemaVersion} is too old (current: ${SERIALIZATION_VERSION})`,
          'VERSION_MISMATCH'
        );
      }

      // Check timestamp if maxAge specified
      if (maxAge > 0 && envelope.timestamp) {
        const age = Date.now() - envelope.timestamp;
        if (age > maxAge) {
          throw new SerializationError(
            `Data is too old (age: ${age}ms, max: ${maxAge}ms)`,
            'EXPIRED'
          );
        }
      }

      // Validate data with schema
      const result = schema.safeParse(envelope.data);
      if (!result.success) {
        throw new SerializationError(
          'Validation failed after deserialization',
          'VALIDATION_FAILED',
          result.error.errors
        );
      }

      return result.data;
    } catch (error) {
      if (error instanceof SerializationError) {
        throw error;
      }
      throw new SerializationError(
        `Deserialization failed: ${error instanceof Error ? error.message : String(error)}`,
        'DESERIALIZATION_FAILED',
        error
      );
    }
  }

  /**
   * Serializes data without schema validation or envelope (legacy compatibility)
   * Use this for backward compatibility with existing code
   */
  static serializeSimple<T>(data: T): string {
    try {
      return JSON.stringify(data, serializationReplacer);
    } catch (error) {
      throw new SerializationError(
        `Simple serialization failed: ${error instanceof Error ? error.message : String(error)}`,
        'SERIALIZATION_FAILED',
        error
      );
    }
  }

  /**
   * Deserializes data without validation or envelope (legacy compatibility)
   * Use this for backward compatibility with existing code
   */
  static deserializeSimple<T>(json: string): T {
    try {
      return JSON.parse(json, deserializationReviver) as T;
    } catch (error) {
      throw new SerializationError(
        `Simple deserialization failed: ${error instanceof Error ? error.message : String(error)}`,
        'DESERIALIZATION_FAILED',
        error
      );
    }
  }
}
