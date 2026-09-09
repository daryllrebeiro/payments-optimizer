/**
 * Task 0.1 / 0.2 / 0.3 — Conformance regression tests for the audit's
 * "Checked and Found Sound" list (extension attack surface).
 *
 * These lock in the *current* clean state so no remediation fix can
 * silently regress it. They are deliberately grep/parse-based so they run
 * in CI on every change, not just once.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');
const EXT_SRC = join(ROOT, 'apps', 'extension', 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.spec\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const manifest = JSON.parse(
  readFileSync(join(ROOT, 'apps', 'extension', 'manifest.json'), 'utf8')
) as {
  content_scripts?: Array<{ matches: string[] }>;
  permissions: string[];
  web_accessible_resources: unknown[];
  content_security_policy: { extension_pages: string };
};

describe('Task 0.1 — manifest surface stays minimal', () => {
  it('declares exactly the three known merchant hosts in content_scripts', () => {
    const matches = (manifest.content_scripts ?? []).flatMap((cs) => cs.matches);
    expect(matches.sort()).toEqual(
      [
        'https://www.amazon.com/*',
        'https://www.amazon.in/*',
        'https://www.flipkart.com/*',
      ].sort()
    );
  });

  it('requests only storage + activeTab + alarms permissions', () => {
    // "alarms" was added with the F1 durable-queue remediation (wake the
    // service worker to retry persisted savings tasks — ADR-003).
    expect([...manifest.permissions].sort()).toEqual(['activeTab', 'alarms', 'storage']);
  });

  it('exposes no web-accessible resources', () => {
    expect(manifest.web_accessible_resources).toHaveLength(0);
  });

  it('has no chrome.scripting usage in extension source', () => {
    const offenders = walk(EXT_SRC).filter((f) =>
      readFileSync(f, 'utf8').includes('chrome.scripting')
    );
    expect(offenders).toEqual([]);
  });
});

describe('Task 0.2 — CSP and code-execution integrity', () => {
  it('applies script-src self with a single known connect-src exception', () => {
    const csp = manifest.content_security_policy.extension_pages;
    expect(csp).toContain("script-src 'self'");
    const connectSrc = csp
      .split(';')
      .map((d) => d.trim())
      .find((d) => d.startsWith('connect-src'));
    expect(connectSrc).toBeDefined();
    expect(connectSrc!.split(/\s+/)).toEqual([
      'connect-src',
      `'self'`,
      'https://generativelanguage.googleapis.com',
    ]);
  });

  it('contains zero eval / innerHTML / dangerouslySetInnerHTML in extension source', () => {
    const forbidden = ['eval(', 'innerHTML', 'dangerouslySetInnerHTML'];
    const offenders = walk(EXT_SRC).filter((f) => {
      const src = readFileSync(f, 'utf8');
      return forbidden.some((pat) => src.includes(pat));
    });
    expect(offenders).toEqual([]);
  });
});

describe('Task 0.3 — no external message listener', () => {
  it('never registers onMessageExternal', () => {
    const offenders = walk(EXT_SRC).filter((f) =>
      readFileSync(f, 'utf8').includes('onMessageExternal')
    );
    expect(offenders).toEqual([]);
  });
});

describe('F8 — test-fixtures stays out of the production extension graph', () => {
  it('no non-spec extension source imports @payments-optimizer/test-fixtures', () => {
    // Specs may use fixtures (devDependency); production code may not.
    // Match real import statements, not prose mentions in comments.
    const importPattern = /(?:from\s+|import\(\s*['"])@payments-optimizer\/test-fixtures/;
    const offenders = walk(EXT_SRC).filter((f) => importPattern.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('extension package.json does not list test-fixtures as a dependency', () => {
    const pkg = JSON.parse(
      readFileSync(join(ROOT, 'apps', 'extension', 'package.json'), 'utf8')
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    expect(pkg.dependencies ?? {}).not.toHaveProperty('@payments-optimizer/test-fixtures');
    // Even devDependencies should stay clean now — specs use the local
    // card catalog instead.
    expect(pkg.devDependencies ?? {}).not.toHaveProperty('@payments-optimizer/test-fixtures');
  });
});
