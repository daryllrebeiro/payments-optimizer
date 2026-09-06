/**
 * Performance benchmarking harness for measuring execution time and memory usage
 */

export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTimeMs: number;
  avgTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  memoryUsedMB?: number;
  timestamp: string;
}

export interface BenchmarkOptions {
  iterations?: number;
  warmupIterations?: number;
  measureMemory?: boolean;
}

export class BenchmarkHarness {
  private results: BenchmarkResult[] = [];

  /**
   * Run a benchmark test
   */
  async benchmark<T>(
    name: string,
    fn: () => T | Promise<T>,
    options: BenchmarkOptions = {}
  ): Promise<BenchmarkResult> {
    const {
      iterations = 1000,
      warmupIterations = 100,
      measureMemory = true,
    } = options;

    // Warmup phase
    for (let i = 0; i < warmupIterations; i++) {
      await fn();
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const memBefore = measureMemory ? this.getMemoryUsage() : 0;
    const timings: number[] = [];

    // Benchmark phase
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      timings.push(end - start);
    }

    const memAfter = measureMemory ? this.getMemoryUsage() : 0;

    const totalTimeMs = timings.reduce((sum, t) => sum + t, 0);
    const avgTimeMs = totalTimeMs / iterations;
    const minTimeMs = Math.min(...timings);
    const maxTimeMs = Math.max(...timings);
    const memoryUsedMB = measureMemory ? (memAfter - memBefore) / 1024 / 1024 : undefined;

    const result: BenchmarkResult = {
      name,
      iterations,
      totalTimeMs,
      avgTimeMs,
      minTimeMs,
      maxTimeMs,
      memoryUsedMB,
      timestamp: new Date().toISOString(),
    };

    this.results.push(result);
    return result;
  }

  /**
   * Get current memory usage in bytes
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  /**
   * Get all benchmark results
   */
  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  /**
   * Clear all results
   */
  clear(): void {
    this.results = [];
  }

  /**
   * Print results to console
   */
  printResults(): void {
    console.log('\n=== Benchmark Results ===\n');
    for (const result of this.results) {
      console.log(`${result.name}:`);
      console.log(`  Iterations: ${result.iterations}`);
      console.log(`  Avg Time: ${result.avgTimeMs.toFixed(4)}ms`);
      console.log(`  Min Time: ${result.minTimeMs.toFixed(4)}ms`);
      console.log(`  Max Time: ${result.maxTimeMs.toFixed(4)}ms`);
      console.log(`  Total Time: ${result.totalTimeMs.toFixed(2)}ms`);
      if (result.memoryUsedMB !== undefined) {
        console.log(`  Memory: ${result.memoryUsedMB.toFixed(2)}MB`);
      }
      console.log('');
    }
  }

  /**
   * Compare results against baseline and detect regressions
   */
  compareWithBaseline(baseline: BenchmarkResult[], threshold = 0.1): void {
    console.log('\n=== Regression Analysis ===\n');
    
    for (const current of this.results) {
      const baselineResult = baseline.find(b => b.name === current.name);
      if (!baselineResult) {
        console.log(`${current.name}: NO BASELINE`);
        continue;
      }

      const speedup = baselineResult.avgTimeMs / current.avgTimeMs;
      const percentChange = ((current.avgTimeMs - baselineResult.avgTimeMs) / baselineResult.avgTimeMs) * 100;
      
      let status = '✓ OK';
      if (percentChange > threshold * 100) {
        status = '⚠ REGRESSION';
      } else if (percentChange < -threshold * 100) {
        status = '✓ IMPROVEMENT';
      }

      console.log(`${current.name}: ${status}`);
      console.log(`  Baseline: ${baselineResult.avgTimeMs.toFixed(4)}ms`);
      console.log(`  Current:  ${current.avgTimeMs.toFixed(4)}ms`);
      console.log(`  Change:   ${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(2)}% (${speedup.toFixed(2)}x)`);
      console.log('');
    }
  }

  /**
   * Export results as JSON
   */
  exportJSON(): string {
    return JSON.stringify(this.results, null, 2);
  }
}
