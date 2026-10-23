import { describe, expect, it } from 'vitest';
import {
  assertOrderTransition,
  canTransitionOrder,
} from './state-machine';

describe('order state machine', () => {
  it.each([
    ['PENDING_PAYMENT', 'PAID'],
    ['PENDING_PAYMENT', 'EXPIRED'],
    ['PAID', 'PROVISIONING'],
    ['PAID', 'FAILED'],
    ['PROVISIONING', 'DELIVERED'],
    ['PROVISIONING', 'FAILED'],
    ['FAILED', 'PROVISIONING'],
  ] as const)('allows %s → %s', (from, to) => {
    expect(canTransitionOrder(from, to)).toBe(true);
    expect(() => assertOrderTransition(from, to)).not.toThrow();
  });

  it.each([
    ['PENDING_PAYMENT', 'DELIVERED'],
    ['PAID', 'DELIVERED'],
    ['DELIVERED', 'FAILED'],
    ['EXPIRED', 'PAID'],
    ['FAILED', 'DELIVERED'],
  ] as const)('rejects %s → %s', (from, to) => {
    expect(canTransitionOrder(from, to)).toBe(false);
    expect(() => assertOrderTransition(from, to)).toThrow(
      `Invalid order status transition: ${from} → ${to}`,
    );
  });
});
