/**
 * Main benchmark runner
 */

import { BenchmarkHarness } from './benchmark-harness.js';
import { createBenefitOptimizerBenchmarks } from './benefit-optimizer-bench.js';
import { createRulesEngineBenchmarks } from './rules-engine-bench.js';
import { createOfferEngineBenchmarks } from './offer-engine-bench.js';

async function main() {
  const harness = new BenchmarkHarness();

  console.log('Starting Payment Optimizer Benchmarks...\n');

  // Collect all benchmarks
  const allBenchmarks = [
    ...createBenefitOptimizerBenchmarks(),
    ...createRulesEngineBenchmarks(),
    ...createOfferEngineBenchmarks(),
  ];

  // Run each benchmark
  for (const { name, fn } of allBenchmarks) {
    console.log(`Running: ${name}...`);
    await harness.benchmark(name, fn, {
      iterations: 1000,
      warmupIterations: 100,
      measureMemory: true,
    });
  }

  // Print results
  harness.printResults();

  // Export to file (optional)
  const resultsJSON = harness.exportJSON();
  console.log('\n=== JSON Export ===');
  console.log(resultsJSON);

  console.log('\nBenchmarks complete!');
}

main().catch(console.error);
