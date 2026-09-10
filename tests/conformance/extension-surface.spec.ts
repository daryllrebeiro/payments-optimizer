/**
 * Task 0.1 / 0.2 / 0.3 — Conformance regression tests for the audit's
 * "Checked and Found Sound" list (extension attack surface).
 *
 * These lock in the *current* clean state so no remediation fix can
 * silently regress it. They are deliberately grep/parse-based so they run
 * in CI on every change, not just once.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
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

  it('requests only storage + activeTab + alarms + notifications permissions', () => {
    // "alarms" was added with the F1 durable-queue remediation (wake the
    // service worker to retry persisted savings tasks — ADR-003).
    // "notifications" was added for Feature 2 loyalty program expiry alerts.
    expect([...manifest.permissions].sort()).toEqual(['activeTab', 'alarms', 'notifications', 'storage']);
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

describe('Fix S-09 — store build posture', () => {
  it('vite store builds are minified', () => {
    const config = readFileSync(join(ROOT, 'apps', 'extension', 'vite.config.ts'), 'utf8');
    expect(config).toMatch(/minify:\s*true/);
  });

  it('built bundle (when present) carries no fixture card data or non-allowlisted endpoints', () => {
    const dist = join(ROOT, 'apps', 'extension', 'dist');
    const candidates = ['background.js', 'content-script.js']
      .map((f) => join(dist, f))
      .filter((f) => existsSync(f));
    if (candidates.length === 0) return; // build not run in this environment
    const ALLOWED = ['generativelanguage.googleapis.com', 'fonts.googleapis.com'];
    for (const file of candidates) {
      const bundle = readFileSync(file, 'utf8');
      expect(bundle).not.toMatch(/test-fixture/i);
      for (const m of bundle.matchAll(/https:\/\/([A-Za-z0-9.-]+)/g)) {
        expect(ALLOWED).toContain(m[1]);
      }
    }
  });
});

describe('Fix S-01 — key material stays out of local scope by default', () => {
  it('no extension source writes the exact geminiApiKey key except the opt-in store', () => {
    const exactKey = /['"]geminiApiKey['"]/;
    const offenders = walk(EXT_SRC).filter((f) => {
      if (f.endsWith('api-key-store.ts') || f.endsWith('.spec.ts')) return false;
      return exactKey.test(readFileSync(f, 'utf8'));
    });
    expect(offenders).toEqual([]);
  });
});
