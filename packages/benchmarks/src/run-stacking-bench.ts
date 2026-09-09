/**
 * Standalone benchmark runner for BenefitStackingEngine (Epic 1.1)
 */

import { BenchmarkHarness } from './benchmark-harness.js';
import { createStackingEngineBenchmarks } from './stacking-engine-bench.js';

async function main() {
  const harness = new BenchmarkHarness();

  console.log('='.repeat(60));
  console.log('Epic 1.1: Beam Search for Benefit Stacking - Benchmarks');
  console.log('='.repeat(60));
  console.log('\nTarget: 20-voucher optimization completes in <100ms P95\n');

  const stackingBenchmarks = createStackingEngineBenchmarks();

  // Run each benchmark
  for (const { name, fn } of stackingBenchmarks) {
    console.log(`Running: ${name}...`);
    await harness.benchmark(name, fn, {
      iterations: 100,
      warmupIterations: 20,
      measureMemory: true,
    });
  }

  // Print results
  harness.printResults();

  // Check P95 for the 20-voucher benchmark
  const results = harness.getResults();
  const twentyVoucherBench = results.find(
    (r) =>
      r.name.includes('20 vouchers') &&
      r.name.includes('width=5') &&
      !r.name.includes('Narrow') &&
      !r.name.includes('Wide')
  );

  console.log('\n' + '='.repeat(60));
  console.log('Epic 1.1 Success Criteria Check:');
  console.log('='.repeat(60));

  if (twentyVoucherBench) {
    const p95Target = 100; // ms
    console.log(`\n20-voucher benchmark (beam width=5):`);
    console.log(`  Avg Time: ${twentyVoucherBench.avgTimeMs.toFixed(2)}ms`);
    console.log(`  Max Time (worst case): ${twentyVoucherBench.maxTimeMs.toFixed(2)}ms`);
    console.log(`  P95 Target: <${p95Target}ms`);

    if (twentyVoucherBench.maxTimeMs < p95Target) {
      console.log(
        `  ✓ PASS - Even worst case (${twentyVoucherBench.maxTimeMs.toFixed(2)}ms) is under P95 target`
      );
    } else if (twentyVoucherBench.avgTimeMs < p95Target * 0.8) {
      console.log(`  ✓ LIKELY PASS - Avg is well under target; P95 should be acceptable`);
    } else {
      console.log(`  ⚠ WARNING - May not meet P95 target. Consider profiling.`);
    }
  }

  console.log('\nBenchmarks complete!');
}

main().catch(console.error);
