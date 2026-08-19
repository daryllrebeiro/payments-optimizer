import { Cart, UserProfile } from '@payments-optimizer/domain';
import {
  generateCandidates,
  filterDominated,
  rankStrategies,
  generateTrace,
} from '@payments-optimizer/optimizer';
import {
  hdfcMillenniaCard,
  sbiCashbackCard,
  axisAtlasCard,
  amazonCoupon,
  hdfcInstantDiscountOffer,
} from '@payments-optimizer/test-fixtures';

const milestoneCart: Cart = {
  merchantId: 'amazon',
  items: [
    {
      id: 'item-1',
      name: 'Amazon Purchase',
      price: { amountMinor: 2000000n, currency: 'INR' },
      quantity: 1,
      category: 'ELECTRONICS',
    },
  ],
  subtotal: { amountMinor: 2000000n, currency: 'INR' },
  discounts: [],
  shipping: { amountMinor: 0n, currency: 'INR' },
  taxes: { amountMinor: 0n, currency: 'INR' },
  total: { amountMinor: 2000000n, currency: 'INR' },
  currency: 'INR',
};

const profile: UserProfile = {
  version: 1,
  currency: 'INR',
  paymentMethods: [
    { type: 'CREDIT_CARD', card: hdfcMillenniaCard },
    { type: 'CREDIT_CARD', card: sbiCashbackCard },
    { type: 'CREDIT_CARD', card: axisAtlasCard },
  ],
  rewardPreferences: {
    defaultValuations: {
      'HDFC Millennia Points': { amountMinor: 100n, currency: 'INR' },
      'SBI Cashback Program': { amountMinor: 100n, currency: 'INR' },
      'Axis Edge Miles': { amountMinor: 100n, currency: 'INR' },
    },
  },
  optimizationPreferences: {
    immediateSavingsWeight: 1.0,
    rewardValueWeight: 1.0,
    milestoneWeight: 1.0,
    simplicityWeight: 0.2,
    riskWeight: 0.1,
  },
};

console.log('========================================================');
console.log('PaymentsOptimizer --- First Milestone CLI Test Harness');
console.log('========================================================\n');
console.log(`Merchant: ${milestoneCart.merchantId.toUpperCase()}`);
console.log(`Purchase Amount: ₹${Number(milestoneCart.total.amountMinor) / 100}\n`);

const candidates = generateCandidates(
  milestoneCart,
  profile,
  [hdfcInstantDiscountOffer],
  [amazonCoupon]
);
console.log(`Generated strategies: ${candidates.length}`);

const pruned = filterDominated(candidates);
console.log(`Pruned strategies (after dominance filtering): ${pruned.length}\n`);

const ranked = rankStrategies(pruned, profile.optimizationPreferences);
const best = ranked[0];

if (!best) {
  console.error('Error: No strategies generated.');
  process.exit(1);
}

console.log('🏆 BEST STRATEGY RECOMMENDATION');
console.log('--------------------------------------------------------');
console.log(`Strategy ID: ${best.id}`);
console.log(`Effective Cost: ₹${Number(best.effectiveCost.amountMinor) / 100}`);
console.log(`Immediate Savings: ₹${Number(best.immediateDiscount.amountMinor) / 100}`);
console.log(`Reward Value: ₹${Number(best.rewardValue.amountMinor) / 100}`);
console.log(`Future Milestone Value: ₹${Number(best.futureBenefit.amountMinor) / 100}`);
console.log(`Fees: ₹${Number(best.fees.amountMinor) / 100}`);
console.log(`Complexity Score: ${best.complexityScore}`);
console.log(`Confidence: ${best.confidence * 100}%\n`);

console.log('📋 PAYMENT STEPS');
best.steps.forEach((step, idx) => {
  console.log(`  Step ${idx + 1}: [${step.type}] ${step.description}`);
});
console.log('');

console.log('📊 CALCULATION TRACE AUDIT');
console.log('--------------------------------------------------------');
const trace = generateTrace(milestoneCart, best);
trace.steps.forEach((step) => {
  const symbol = step.amountChange.amountMinor >= 0n ? '+' : '';
  console.log(
    `  ${step.description.padEnd(35)}: ${symbol}₹${Number(step.amountChange.amountMinor) / 100}`
  );
});
console.log('--------------------------------------------------------');
console.log(
  `  ${'Final Effective Cost'.padEnd(35)}:  ₹${Number(trace.output.effectiveCost.amountMinor) / 100}\n`
);
console.log('========================================================');
