import type PgBoss from 'pg-boss';
import { z } from 'zod';
import { verifyOrderPayment } from '@/server/orders/verify-payment';
import { db } from '@/db';
import { orderEvents, orders } from '@/db/schema';
import { and, eq, lte } from 'drizzle-orm';

export const VERIFY_PAYMENT_JOB = 'verify-qpay-payment';
export const EXPIRE_INVOICES_JOB = 'expire-pending-invoices';

const verifyPaymentDataSchema = z.object({
  orderId: z.string().uuid(),
});

export async function registerPaymentJobs(boss: PgBoss): Promise<void> {
  await boss.work<{ orderId: string }>(
    VERIFY_PAYMENT_JOB,
    async (jobs) => {
      for (const job of jobs) {
        const { orderId } = verifyPaymentDataSchema.parse(job.data);
        await verifyOrderPayment(orderId);
      }
    },
  );

  await boss.work(EXPIRE_INVOICES_JOB, async () => {
    const now = new Date();
    await db.transaction(async (transaction) => {
      const expiredOrders = await transaction
        .update(orders)
        .set({
          status: 'EXPIRED',
          updatedAt: now,
        })
        .where(
          and(
            eq(orders.status, 'PENDING_PAYMENT'),
            lte(orders.expiresAt, now),
          ),
        )
        .returning({ id: orders.id });

      for (const order of expiredOrders) {
        await transaction.insert(orderEvents).values({
          orderId: order.id,
          type: 'STATUS_CHANGED',
          message: 'PENDING_PAYMENT → EXPIRED',
          details: { status: 'EXPIRED', expiredAt: now.toISOString() },
        });
      }
    });
  });

  await boss.schedule(EXPIRE_INVOICES_JOB, '* * * * *');
}
