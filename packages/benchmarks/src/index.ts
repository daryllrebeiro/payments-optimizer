/**
 * @payments-optimizer/benchmarks
 * 
 * Performance benchmarking suite for payment optimization algorithms
 */

export { BenchmarkHarness, type BenchmarkResult, type BenchmarkOptions } from './benchmark-harness.js';
export { createBenefitOptimizerBenchmarks } from './benefit-optimizer-bench.js';
export { createRulesEngineBenchmarks } from './rules-engine-bench.js';
export { createOfferEngineBenchmarks } from './offer-engine-bench.js';
export { createStackingEngineBenchmarks } from './stacking-engine-bench.js';
