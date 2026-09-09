# @payments-optimizer/benchmarks

Performance benchmarking suite for payment optimization algorithms.

## Features

- **Benchmark Harness**: Measure execution time and memory usage
- **BenefitOptimizer Benchmarks**: Test findBestStrategy() with various scenarios
- **RulesEngine Benchmarks**: Test evaluate() with simple and complex rule sets
- **OfferEngine Benchmarks**: Test stackOffers() with different offer counts
- **Regression Detection**: Compare against baselines to detect performance regressions

## Usage

### Run All Benchmarks

```bash
pnpm --filter @payments-optimizer/benchmarks bench
```

### Programmatic Usage

```typescript
import { BenchmarkHarness } from '@payments-optimizer/benchmarks';

const harness = new BenchmarkHarness();

await harness.benchmark(
  'My Algorithm',
  () => {
    // Your code here
  },
  {
    iterations: 1000,
    warmupIterations: 100,
    measureMemory: true,
  }
);

harness.printResults();
```

## Benchmark Scenarios

### BenefitOptimizer

- **Small**: 2 cards, 5 offers
- **Medium**: 5 cards, 15 offers
- **Large**: 10 cards, 30 offers

### RulesEngine

- **Simple**: 2 basic rules
- **Medium**: 10 mixed rules
- **Complex**: 50 nested conditional rules

### OfferEngine

- **Small**: 5 offers
- **Medium**: 15 offers
- **Large**: 50 offers

## Output

The benchmarks output:

- Total execution time
- Average time per iteration
- Min/Max times
- Memory usage (heap delta)
- Timestamp

## Regression Detection

```typescript
import { BenchmarkHarness } from '@payments-optimizer/benchmarks';

const harness = new BenchmarkHarness();
// ... run benchmarks ...

const baseline = JSON.parse(fs.readFileSync('baseline.json', 'utf8'));
harness.compareWithBaseline(baseline, 0.1); // 10% threshold
```
