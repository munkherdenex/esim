import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type PgBoss from 'pg-boss';
import { z } from 'zod';
import { db } from '@/db';
import { orderEvents, orders } from '@/db/schema';
import { env } from '@/lib/env';
import { failOrderFulfillment, fulfillOrder } from '@/server/orders/fulfill-order';
import { sendOrderDeliveryEmail } from '@/server/notifications/send-order-delivery-email';
import {
  DELIVERY_EMAIL_JOB,
  FULFILL_ORDER_JOB,
  RECONCILE_FULFILLMENTS_JOB,
} from './names';

const orderJobDataSchema = z.object({ orderId: z.string().uuid() });

export async function enqueueFulfillment(
  boss: PgBoss,
  orderId: string,
): Promise<string | null> {
  return boss.send(
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
}

export async function registerFulfillmentJobs(boss: PgBoss): Promise<void> {
  await boss.work(
    FULFILL_ORDER_JOB,
    { includeMetadata: true, batchSize: 1 },
    async (jobs) => {
      for (const job of jobs) {
        const parsed = orderJobDataSchema.safeParse(job.data);
        if (!parsed.success) {
          throw new Error(`Invalid fulfillment job data: ${parsed.error.message}`);
        }

        try {
          await fulfillOrder(parsed.data.orderId);
        } catch (error) {
          console.error('eSIM fulfillment attempt failed:', error);
          const failureMessage =
            error instanceof Error ? error.message : 'Unknown error';
          await db.insert(orderEvents).values({
            orderId: parsed.data.orderId,
            type: 'ESIM_FULFILLMENT_RETRY',
            message: 'eSIM fulfillment attempt failed',
            details: {
              retryCount: job.retryCount,
              retryLimit: job.retryLimit,
              error: failureMessage.slice(0, 1000),
            },
          });

          if (job.retryCount >= job.retryLimit) {
            await failOrderFulfillment(parsed.data.orderId, error);
            continue;
          }
          throw error;
        }
      }
    },
  );

  await boss.work(
    DELIVERY_EMAIL_JOB,
    { includeMetadata: true, batchSize: 1 },
    async (jobs) => {
      for (const job of jobs) {
        const parsed = orderJobDataSchema.safeParse(job.data);
        if (!parsed.success) {
          throw new Error(`Invalid delivery email job data: ${parsed.error.message}`);
        }

        try {
          await sendOrderDeliveryEmail(parsed.data.orderId);
        } catch (error) {
          console.error('eSIM delivery email attempt failed:', error);
          if (job.retryCount >= job.retryLimit) {
            await db.insert(orderEvents).values({
              orderId: parsed.data.orderId,
              type: 'DELIVERY_EMAIL_FAILED',
              message: 'Delivery email retry limit reached; reconciliation will retry later',
              details: {
                retryCount: job.retryCount,
                error:
                  error instanceof Error
                    ? error.message.slice(0, 1000)
                    : 'Unknown error',
              },
            });
            continue;
          }
          throw error;
        }
      }
    },
  );

  await boss.work(RECONCILE_FULFILLMENTS_JOB, async () => {
    const activeOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(inArray(orders.status, ['PAID', 'PROVISIONING']))
      .orderBy(asc(orders.createdAt))
      .limit(50);

    for (const order of activeOrders) {
      await enqueueFulfillment(boss, order.id);
    }

    if (env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) {
      const pendingEmails = await db
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(
            eq(orders.status, 'DELIVERED'),
            isNull(orders.deliveryEmailCompletedAt),
          ),
        )
        .orderBy(asc(orders.deliveredAt))
        .limit(50);

      for (const order of pendingEmails) {
        await boss.send(
          DELIVERY_EMAIL_JOB,
          { orderId: order.id },
          {
            retryLimit: 8,
            retryDelay: 15,
            retryBackoff: true,
            singletonKey: order.id,
            singletonMinutes: 2,
          },
        );
      }
    }
  });

  await boss.schedule(RECONCILE_FULFILLMENTS_JOB, '* * * * *', {
    singletonKey: RECONCILE_FULFILLMENTS_JOB,
    singletonMinutes: 1,
  });
}
