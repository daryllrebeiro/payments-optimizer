/**
 * Fix F3 conformance check — the documented resilience layer must actually
 * be wired into the shipped extension.
 *
 * Root cause being fixed: TransactionCoordinator, CircuitBreaker,
 * DomainSerializer, message-schemas, and SavingsRepository existed as
 * library code while the extension used hand-rolled equivalents. The
 * architecture review and roadmap claimed these guarantees as shipped.
 * This check fails the build if the wiring diverges again.
 *
 * This test PASSED only after Option A (wire it in) was implemented; on
 * the pre-fix tree it fails by design — that is its purpose.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');
const SW_PATH = join(ROOT, 'apps', 'extension', 'src', 'background', 'service-worker.ts');
const POPUP_DIR = join(ROOT, 'apps', 'extension', 'src', 'popup');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const serviceWorker = readFileSync(SW_PATH, 'utf8');
const popupSources = walk(POPUP_DIR)
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

describe('F3 — documented modules are wired into the extension', () => {
  it('service worker validates inbound messages with the library schema', () => {
    expect(serviceWorker).toMatch(/import\s*\{[^}]*validateMessage[^}]*\}\s*from\s*'@payments-optimizer\/domain'/);
    expect(serviceWorker).toContain('validateMessage(message)');
  });

  it('service worker persists savings through SavingsRepository (no hand-rolled DB open)', () => {
    expect(serviceWorker).toMatch(/import\s*\{[^}]*SavingsRepository[^}]*\}\s*from\s*'@payments-optimizer\/storage'/);
    expect(serviceWorker).toContain('new SavingsRepository()');
    // The hand-rolled path must be gone
    expect(serviceWorker).not.toContain("indexedDB.open('payments-optimizer-savings'");
  });

  it('service worker uses the DurableTaskQueue write-ahead path (F1)', () => {
    expect(serviceWorker).toMatch(/import\s*\{[^}]*DurableTaskQueue[^}]*\}\s*from\s*'@payments-optimizer\/storage'/);
    expect(serviceWorker).toContain("durableQueue.enqueue('SAVE_SAVINGS_ENTRY'");
    expect(serviceWorker).toContain('drainDurableQueue');
    expect(serviceWorker).toContain("chrome.alarms.create('drain-durable-queue'");
  });

  it('message codec delegates to the library DomainSerializer (F3/F16)', () => {
    const messages = readFileSync(
      join(ROOT, 'apps', 'extension', 'src', 'types', 'messages.ts'),
      'utf8'
    );
    expect(messages).toContain('DomainSerializer.serializeSimple');
    expect(messages).toContain('DomainSerializer.deserializeSimple');
  });

  it('popup reads savings through the repository, not its own DB open', () => {
    expect(popupSources).toContain('SavingsRepository');
    expect(popupSources).not.toContain("indexedDB.open('payments-optimizer-savings'");
  });

  it('profile reads/writes go through parseUserProfile (F7 wiring)', () => {
    expect(serviceWorker).toContain('parseUserProfile');
    expect(popupSources).toContain('parseUserProfile');
    expect(popupSources).not.toMatch(/localData\['user-profile'\]\s+as\s+UserProfile/);
  });

  it('no production extension source imports test fixtures (F8 reinforcement)', () => {
    const importPattern = /(?:from\s+|import\(\s*['"])@payments-optimizer\/test-fixture/;
    const offenders = [
      ...walk(join(ROOT, 'apps', 'extension', 'src')).filter(
        (f) => !/\.spec\.(ts|tsx)$/.test(f)
      ),
    ].filter((f) => importPattern.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
