import type { orderStatus } from '@/db/schema';

export type OrderStatus = (typeof orderStatus.enumValues)[number];

const allowedTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: ['PAID', 'EXPIRED'],
  PAID: ['PROVISIONING', 'FAILED'],
  PROVISIONING: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  FAILED: ['PROVISIONING'],
  EXPIRED: [],
};

export function canTransitionOrder(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
): boolean {
  return allowedTransitions[currentStatus].includes(nextStatus);
}

export function assertOrderTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
): void {
  if (!canTransitionOrder(currentStatus, nextStatus)) {
    throw new Error(
      `Invalid order status transition: ${currentStatus} → ${nextStatus}`,
    );
  }
}
