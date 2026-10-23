export interface PricingInput {
  costUsd: number;
  usdToMnt: number;
  markupPercent: number;
  roundingStepMnt: number;
}

export function calculatePriceMnt({
  costUsd,
  usdToMnt,
  markupPercent,
  roundingStepMnt,
}: PricingInput): number {
  if (!Number.isFinite(costUsd) || costUsd < 0) {
    throw new RangeError('costUsd must be a finite, non-negative number');
  }
  if (!Number.isFinite(usdToMnt) || usdToMnt <= 0) {
    throw new RangeError('usdToMnt must be a finite, positive number');
  }
  if (!Number.isFinite(markupPercent) || markupPercent < 0) {
    throw new RangeError('markupPercent must be a finite, non-negative number');
  }
  if (!Number.isSafeInteger(roundingStepMnt) || roundingStepMnt <= 0) {
    throw new RangeError('roundingStepMnt must be a positive integer');
  }

  const amountMnt = costUsd * usdToMnt * (1 + markupPercent / 100);
  return Math.ceil(amountMnt / roundingStepMnt) * roundingStepMnt;
}
