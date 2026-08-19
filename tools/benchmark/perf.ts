import { PaymentStrategy, Currency } from '@payments-optimizer/domain';
import { filterDominated } from '@payments-optimizer/optimizer';

// Helper to generate N mock payment strategies to simulate a large search space.
function generateMockStrategies(count: number, currency: Currency = 'INR'): PaymentStrategy[] {
  const list: PaymentStrategy[] = [];

  for (let i = 0; i < count; i++) {
    // Alternate metrics to create a mix of dominating and dominated options
    const cost = BigInt(10000 + (i % 20) * 100); 
    const complexity = (i % 4) + 1;
    const confidence = 0.5 + (i % 5) * 0.1;

    list.push({
      id: `strategy-${i}`,
      immediateDiscount: { amountMinor: 100n, currency },
      rewardValue: { amountMinor: 50n, currency },
      futureBenefit: { amountMinor: 0n, currency },
      fees: { amountMinor: 0n, currency },
      effectiveCost: { amountMinor: cost, currency },
      totalBenefit: { amountMinor: 150n, currency },
      confidence,
      complexityScore: complexity,
      steps: [],
    });
  }

  return list;
}

function runBenchmark() {
  const count = 300;
  const iterations = 100;
  
  console.log('========================================================');
  console.log('PaymentsOptimizer --- Performance Benchmark Harness');
  console.log('========================================================');
  console.log(`Generating ${count} mock strategy candidates...`);
  const candidates = generateMockStrategies(count);
  console.log(`Total initial candidates: ${candidates.length}\n`);

  console.log(`Running filterDominated over ${iterations} iterations...`);
  
  const start = performance.now();
  let totalPrunedCount = 0;
  
  for (let i = 0; i < iterations; i++) {
    const pruned = filterDominated(candidates);
    totalPrunedCount = pruned.length;
  }
  
  const end = performance.now();
  const totalTime = end - start;
  const avgTime = totalTime / iterations;
  const opsPerSec = (1000 / avgTime).toFixed(2);

  console.log('📊 BENCHMARK METRICS');
  console.log('--------------------------------------------------------');
  console.log(`  Total execution time : ${totalTime.toFixed(2)} ms`);
  console.log(`  Average latency      : ${avgTime.toFixed(3)} ms / run`);
  console.log(`  Throughput           : ${opsPerSec} ops/sec`);
  console.log(`  Filtered candidates  : ${totalPrunedCount} active strategies`);
  console.log('========================================================\n');
}

runBenchmark();
