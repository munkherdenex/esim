import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { orderEvents, orders } from '@/db/schema';
import { createPaymentProvider } from '@/server/qpay';
import type { PaymentVerification } from '@/server/qpay/types';
import { enqueueJob } from '@/server/jobs/queue';
import { FULFILL_ORDER_JOB } from '@/server/jobs/names';
import { assertOrderTransition } from './state-machine';

export async function verifyOrderPayment(orderId: string): Promise<void> {
  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      qpayInvoiceId: orders.qpayInvoiceId,
      expiresAt: orders.expiresAt,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.status !== 'PENDING_PAYMENT' || !order.qpayInvoiceId) {
    return;
  }

  const checkedAt = new Date();
  if (!order.expiresAt || order.expiresAt <= checkedAt) {
    await db.insert(orderEvents).values({
      orderId,
      type: 'PAYMENT_VERIFICATION_SKIPPED',
      message: 'Payment verification skipped because invoice expired',
    });
    return;
  }

  let result: PaymentVerification;
  try {
    result = await createPaymentProvider().checkPayment(order.qpayInvoiceId);
  } catch (error) {
    await db.insert(orderEvents).values({
      orderId,
      type: 'QPAY_PAYMENT_CHECK_FAILED',
      message: 'Payment verification request failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    throw error;
  }
  const paidOrder = await db.transaction(async (transaction) => {
    await transaction.insert(orderEvents).values({
      orderId,
      type: 'QPAY_PAYMENT_CHECKED',
      message: result.paid ? 'Payment confirmed by QPay' : 'Payment not found',
      details: {
        transactionCount: result.transactionCount,
        paid: result.paid,
      },
    });

    if (!result.paid) return false;
    assertOrderTransition('PENDING_PAYMENT', 'PAID');

    const [updatedOrder] = await transaction
      .update(orders)
      .set({
        status: 'PAID',
        qpayPaymentId: result.paymentId ?? null,
        paidAt: checkedAt,
        updatedAt: checkedAt,
      })
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.status, 'PENDING_PAYMENT'),
          gt(orders.expiresAt, checkedAt),
          isNull(orders.qpayPaymentId),
        ),
      )
      .returning({ id: orders.id });

    if (updatedOrder) {
      await transaction.insert(orderEvents).values({
        orderId,
        type: 'STATUS_CHANGED',
        message: 'PENDING_PAYMENT → PAID',
        details: { status: 'PAID' },
      });
    }
    return Boolean(updatedOrder);
  });

  if (paidOrder) {
    try {
      const jobId = await enqueueJob(
        FULFILL_ORDER_JOB,
        { orderId },
        {
          retryLimit: 8,
          retryDelay: 15,
          retryBackoff: true,
          singletonKey: orderId,
          singletonMinutes: 2,
        },
      );
      await db.insert(orderEvents).values({
        orderId,
        type: 'ESIM_FULFILLMENT_ENQUEUED',
        message: 'eSIM fulfillment job enqueued',
        details: { jobId },
      });
    } catch (error) {
      await db.insert(orderEvents).values({
        orderId,
        type: 'ESIM_FULFILLMENT_ENQUEUE_FAILED',
        message: 'eSIM fulfillment job enqueue failed; periodic reconciliation will recover',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }
}
