import { describe, expect, it } from 'vitest';
import { calculatePriceMnt } from './calculate-price';

describe('calculatePriceMnt', () => {
  it('converts USD cost, applies percentage markup, then rounds up', () => {
    expect(
      calculatePriceMnt({
        costUsd: 1.25,
        usdToMnt: 3500,
        markupPercent: 20,
        roundingStepMnt: 500,
      }),
    ).toBe(5500);
  });

  it('keeps prices already on a rounding boundary unchanged', () => {
    expect(
      calculatePriceMnt({
        costUsd: 1,
        usdToMnt: 5000,
        markupPercent: 0,
        roundingStepMnt: 500,
      }),
    ).toBe(5000);
  });

  it('rejects invalid values instead of returning a misleading price', () => {
    expect(() =>
      calculatePriceMnt({
        costUsd: 1,
        usdToMnt: 0,
        markupPercent: 20,
        roundingStepMnt: 500,
      }),
    ).toThrow(RangeError);
  });
});
