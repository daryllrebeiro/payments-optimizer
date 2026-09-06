/**
 * Transaction Coordinator for Atomic Multi-Step Operations
 * Epic 1.2: Ensures atomic voucher burn + savings write + profile update
 * 
 * Provides ACID-like guarantees for multi-step operations with compensating rollback.
 */

/**
 * Result of an operation execution
 */
export interface OperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: Error;
  rollbackData?: unknown;
}

/**
 * Generic operation that can be executed and rolled back
 */
export interface Operation<T = void> {
  /**
   * Unique identifier for this operation (for logging/debugging)
   */
  readonly id: string;

  /**
   * Human-readable description of what this operation does
   */
  readonly description: string;

  /**
   * Execute the operation
   * @returns Result with success status and optional rollback data
   */
  execute(): Promise<OperationResult<T>>;

  /**
   * Roll back the operation using data from the execute result
   * @param executeResult - The result from execute() containing rollback data
   */
  rollback(executeResult: OperationResult<T>): Promise<void>;
}

/**
 * Error thrown when a transaction fails
 */
export class TransactionError extends Error {
  constructor(
    message: string,
    public readonly failedOperation: string,
    public readonly underlyingError?: Error,
    public readonly partialResults?: OperationResult<unknown>[]
  ) {
    super(message);
    this.name = 'TransactionError';
  }
}

/**
 * Options for transaction execution
 */
export interface TransactionOptions {
  /**
   * Maximum time in ms to wait for all operations to complete
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Whether to log execution steps (for debugging)
   * @default false
   */
  verbose?: boolean;
}

/**
 * Result of a transaction execution
 */
export interface TransactionResult<T = void> {
  success: boolean;
  results?: T[];
  error?: TransactionError;
}

/**
 * Coordinates atomic execution of multiple operations with rollback support
 */
export class TransactionCoordinator {
  /**
   * Executes a sequence of operations atomically.
   * If any operation fails, all previously completed operations are rolled back.
   * 
   * @param operations - Ordered list of operations to execute
   * @param options - Transaction execution options
   * @returns Transaction result with all operation results or error
   */
  async executeAtomically<T = void>(
    operations: Operation<T>[],
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T>> {
    const { timeout = 30000, verbose = false } = options;

    if (operations.length === 0) {
      return { success: true, results: [] };
    }

    const completedResults: OperationResult<T>[] = [];
    const startTime = Date.now();

    try {
      // Execute operations in sequence
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i]!;

        // Check timeout
        if (Date.now() - startTime > timeout) {
          throw new TransactionError(
            `Transaction timeout after ${timeout}ms`,
            operation.id,
            undefined,
            completedResults
          );
        }

        if (verbose) {
          console.log(`[TransactionCoordinator] Executing: ${operation.description}`);
        }

        // Execute operation
        const result = await operation.execute();

        if (!result.success) {
          // Operation failed - initiate rollback
          throw new TransactionError(
            `Operation failed: ${operation.description}`,
            operation.id,
            result.error,
            completedResults
          );
        }

        completedResults.push(result);

        if (verbose) {
          console.log(`[TransactionCoordinator] Completed: ${operation.description}`);
        }
      }

      // All operations succeeded
      return {
        success: true,
        results: completedResults.map(r => r.data as T),
      };

    } catch (error) {
      // Transaction failed - roll back all completed operations in reverse order
      if (verbose) {
        console.warn('[TransactionCoordinator] Transaction failed, initiating rollback...');
      }

      await this.rollbackOperations(operations, completedResults, verbose);

      const transactionError = error instanceof TransactionError
        ? error
        : new TransactionError(
            'Unexpected error during transaction execution',
            'unknown',
            error instanceof Error ? error : new Error(String(error)),
            completedResults
          );

      return {
        success: false,
        error: transactionError,
      };
    }
  }

  /**
   * Rolls back completed operations in reverse order
   * @param operations - All operations in the transaction
   * @param completedResults - Results from completed operations
   * @param verbose - Whether to log rollback steps
   */
  private async rollbackOperations<T>(
    operations: Operation<T>[],
    completedResults: OperationResult<T>[],
    verbose: boolean
  ): Promise<void> {
    // Roll back in reverse order (LIFO)
    for (let i = completedResults.length - 1; i >= 0; i--) {
      const operation = operations[i]!;
      const result = completedResults[i]!;

      try {
        if (verbose) {
          console.log(`[TransactionCoordinator] Rolling back: ${operation.description}`);
        }

        await operation.rollback(result);

        if (verbose) {
          console.log(`[TransactionCoordinator] Rolled back: ${operation.description}`);
        }
      } catch (rollbackError) {
        // Log rollback failure but continue with other rollbacks
        console.error(
          `[TransactionCoordinator] CRITICAL: Rollback failed for ${operation.description}:`,
          rollbackError
        );
        // In production, this should trigger alerts/monitoring
      }
    }
  }
}
