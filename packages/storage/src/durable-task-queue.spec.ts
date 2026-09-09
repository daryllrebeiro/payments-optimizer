/**
 * Fix F1 regression tests — durable savings persistence.
 *
 * Exploit scenario from the audit: the service worker is killed between
 * saveOptimizationResult() being invoked and its IndexedDB transaction
 * committing — the entry is silently lost forever. With the durable queue,
 * the task is persisted BEFORE the write, and on next wake the queued
 * entry is retried and eventually persisted.
 */
import { describe, it, expect } from 'vitest';
import { DurableTaskQueue } from './durable-task-queue.js';

const uniqueDbName = (): string =>
  `durable-queue-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

describe('DurableTaskQueue — write-ahead and retry semantics', () => {
  it('persists the task before any work happens (write-ahead)', async () => {
    // Simulate: enqueue, then the process "dies" before attempting the work
    const dbName = uniqueDbName();
    const queue = new DurableTaskQueue({ dbName, backoffBaseMs: 10 });
    const task = await queue.enqueue('SAVE_SAVINGS_ENTRY', { id: 'entry-1' });

    // New queue instance = new service-worker wake with no memory
    const wokeQueue = new DurableTaskQueue({ dbName, backoffBaseMs: 10 });
    const pending = await wokeQueue.pendingTasks();

    expect(pending.length).toBe(1);
    expect(pending[0]!.id).toBe(task.id);
    expect(pending[0]!.status).toBe('pending');
    expect(pending[0]!.payload).toEqual({ id: 'entry-1' });
  });

  it('a due task is claimable after a simulated worker kill', async () => {
    const dbName = uniqueDbName();
    const queue = new DurableTaskQueue({ dbName, backoffBaseMs: 10 });
    const task = await queue.enqueue('SAVE_SAVINGS_ENTRY', { id: 'entry-1' });

    const freshQueue = new DurableTaskQueue({ dbName, backoffBaseMs: 10 });
    const due = await freshQueue.claimDueTasks();
    expect(due.map((t) => t.id)).toContain(task.id);
  });

  it('completed tasks are not re-claimed (no duplicate writes)', async () => {
    const dbName = uniqueDbName();
    const queue = new DurableTaskQueue({ dbName, backoffBaseMs: 10 });
    const task = await queue.enqueue('SAVE_SAVINGS_ENTRY', { id: 'entry-1' });
    await queue.markCompleted(task.id);

    const due = await queue.claimDueTasks();
    expect(due.map((t) => t.id)).not.toContain(task.id);
    expect((await queue.pendingTasks()).length).toBe(0);
  });

  it('failed attempts back off and eventually dead-letter', async () => {
    const dbName = uniqueDbName();
    const queue = new DurableTaskQueue({ dbName, backoffBaseMs: 60_000 });
    const task = await queue.enqueue('SAVE_SAVINGS_ENTRY', { id: 'entry-1' });

    // Not due immediately after a failure (backoff)
    await queue.markFailed(task.id, 'simulated write failure');
    const immediate = await queue.claimDueTasks();
    expect(immediate.map((t) => t.id)).not.toContain(task.id);

    // Becomes due after the backoff window elapses
    const future = await queue.claimDueTasks(Date.now() + 60_000);
    expect(future.map((t) => t.id)).toContain(task.id);

    // Exhaust max attempts (default 5) -> dead-lettered, never re-claimed
    for (let i = 0; i < 4; i++) {
      await queue.markFailed(task.id, 'failure');
    }
    const afterExhaustion = await queue.claimDueTasks(Date.now() + 10_000_000);
    expect(afterExhaustion.map((t) => t.id)).not.toContain(task.id);

    const stored = await queue.getTask(task.id);
    expect(stored?.status).toBe('failed');
    expect(stored?.lastError).toContain('failure');
  });

  it('retry-after-kill round-trip: enqueue → drain on wake → complete', async () => {
    // The exact audit scenario: task enqueued, worker killed, restarted,
    // task drained and completed — no silent loss.
    const dbName = uniqueDbName();
    const queue = new DurableTaskQueue({ dbName, backoffBaseMs: 10 });
    await queue.enqueue('SAVE_SAVINGS_ENTRY', { id: 'entry-survivor' });

    const wokeQueue = new DurableTaskQueue({ dbName, backoffBaseMs: 10 });
    const due = await wokeQueue.claimDueTasks();
    expect(due.length).toBe(1);

    // Simulate performing the actual write, then completing
    await wokeQueue.markCompleted(due[0]!.id);

    const finalPending = await wokeQueue.pendingTasks();
    expect(finalPending.length).toBe(0);
  });
});
