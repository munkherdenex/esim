import { describe, expect, it } from 'vitest';
import {
  findBestValuePackage,
  formatPriceMnt,
  getCountryBySlug,
} from './catalog';

describe('catalog helpers', () => {
  it('formats prices in the MNT display format', () => {
    expect(formatPriceMnt(35_000)).toBe('₮35,000');
  });

  it('chooses the package with the lowest price per GB', () => {
    const bestValue = findBestValuePackage([
      { id: 'small', dataGb: 1, validityDays: 7, priceMnt: 10_000 },
      { id: 'large', dataGb: 5, validityDays: 30, priceMnt: 35_000 },
    ]);

    expect(bestValue).toBe('large');
  });

  it('breaks equal value-per-GB ties in favor of longer validity', () => {
    const bestValue = findBestValuePackage([
      { id: 'short', dataGb: 2, validityDays: 7, priceMnt: 20_000 },
      { id: 'long', dataGb: 4, validityDays: 30, priceMnt: 40_000 },
    ]);

    expect(bestValue).toBe('long');
  });

  it('has Mongolian catalog metadata for the initial countries', () => {
    expect(getCountryBySlug('china')?.name).toBe('Хятад');
    expect(getCountryBySlug('south-korea')?.name).toBe('Өмнөд Солонгос');
    expect(getCountryBySlug('unknown')).toBeUndefined();
  });
});
