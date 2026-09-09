/**
 * F1: Durable background task queue (ADR-003).
 *
 * Root cause being fixed: MV3 service workers are killed at any moment, so
 * an in-flight IndexedDB write is silently lost — a savings entry written
 * on confirmation could vanish with no retry. This queue provides a
 * write-ahead record: the task is persisted BEFORE the work is attempted,
 * and drained (with backoff) on every service-worker wake.
 */

export type DurableTaskType = 'SAVE_SAVINGS_ENTRY';

export interface DurableTask<T = unknown> {
  id: string;
  type: DurableTaskType;
  payload: T;
  createdAt: number;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: number;
  status: 'pending' | 'completed' | 'failed';
  lastError?: string;
}

export interface DurableQueueConfig {
  dbName?: string;
  storeName?: string;
  dbVersion?: number;
  maxAttempts?: number;
  backoffBaseMs?: number;
}

const DEFAULTS = {
  dbName: 'payments-optimizer-tasks',
  storeName: 'tasks',
  dbVersion: 1,
  maxAttempts: 5,
  backoffBaseMs: 1000,
};

function generateTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export class DurableTaskQueue {
  private dbName: string;
  private storeName: string;
  private dbVersion: number;
  private maxAttempts: number;
  private backoffBaseMs: number;

  constructor(config: DurableQueueConfig = {}) {
    this.dbName = config.dbName ?? DEFAULTS.dbName;
    this.storeName = config.storeName ?? DEFAULTS.storeName;
    this.dbVersion = config.dbVersion ?? DEFAULTS.dbVersion;
    this.maxAttempts = config.maxAttempts ?? DEFAULTS.maxAttempts;
    this.backoffBaseMs = config.backoffBaseMs ?? DEFAULTS.backoffBaseMs;
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof globalThis === 'undefined' || !globalThis.indexedDB) {
        reject(new Error('IndexedDB is not supported in this environment.'));
        return;
      }
      const request = globalThis.indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Durable queue DB open blocked'));
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Persist a task BEFORE the work is attempted (write-ahead). Returns the
   * stored task. Never throws silently — rejections propagate to the caller
   * so the confirm flow can surface a structured SaveError.
   */
  async enqueue<T>(type: DurableTaskType, payload: T, taskId?: string): Promise<DurableTask<T>> {
    const task: DurableTask<T> = {
      id: taskId ?? generateTaskId(),
      type,
      payload,
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: this.maxAttempts,
      nextAttemptAt: Date.now(),
      status: 'pending',
    };

    const db = await this.openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).put(task);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('enqueue transaction aborted'));
      });
    } finally {
      db.close();
    }
    return task;
  }

  /**
   * Claim all due pending tasks (nextAttemptAt <= now, attempts left).
   * Returned tasks are NOT locked — the caller must report completion or
   * failure promptly (single-writer assumption per service worker).
   */
  async claimDueTasks(now = Date.now()): Promise<DurableTask[]> {
    const db = await this.openDb();
    try {
      const all = await new Promise<DurableTask[]>((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const request = tx.objectStore(this.storeName).getAll();
        request.onsuccess = () => resolve((request.result ?? []) as DurableTask[]);
        request.onerror = () => reject(request.error);
      });
      return all.filter(
        (t) => t.status === 'pending' && t.nextAttemptAt <= now && t.attempts < t.maxAttempts
      );
    } finally {
      db.close();
    }
  }

  async markCompleted(taskId: string): Promise<void> {
    await this.updateTask(taskId, (t) => {
      t.status = 'completed';
    });
  }

  /**
   * Record a failed attempt with exponential backoff. A task that has
   * exhausted its attempts is marked 'failed' (dead-letter) and stays
   * inspectable for diagnostics.
   */
  async markFailed(taskId: string, error: string): Promise<void> {
    await this.updateTask(taskId, (t) => {
      t.attempts += 1;
      t.lastError = error;
      if (t.attempts >= t.maxAttempts) {
        t.status = 'failed';
      } else {
        t.nextAttemptAt = Date.now() + this.backoffBaseMs * 2 ** (t.attempts - 1);
      }
    });
  }

  /** All non-completed tasks (diagnostics / tests). */
  async pendingTasks(): Promise<DurableTask[]> {
    const db = await this.openDb();
    try {
      const all = await new Promise<DurableTask[]>((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const request = tx.objectStore(this.storeName).getAll();
        request.onsuccess = () => resolve((request.result ?? []) as DurableTask[]);
        request.onerror = () => reject(request.error);
      });
      return all.filter((t) => t.status !== 'completed');
    } finally {
      db.close();
    }
  }

  async getTask(taskId: string): Promise<DurableTask | undefined> {
    const db = await this.openDb();
    try {
      return await new Promise<DurableTask | undefined>((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const request = tx.objectStore(this.storeName).get(taskId);
        request.onsuccess = () => resolve(request.result as DurableTask | undefined);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }

  private async updateTask(taskId: string, mutate: (t: DurableTask) => void): Promise<void> {
    const db = await this.openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const getReq = store.get(taskId);
        getReq.onsuccess = () => {
          const task = getReq.result as DurableTask | undefined;
          if (!task) {
            reject(new Error(`Task ${taskId} not found`));
            return;
          }
          mutate(task);
          store.put(task);
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }
}
