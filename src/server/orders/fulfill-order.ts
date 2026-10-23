import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { orderEvents, orders, packages } from '@/db/schema';
import { createEsimProvider } from '@/server/esim';
import { enqueueJob } from '@/server/jobs/queue';
import { DELIVERY_EMAIL_JOB } from '@/server/jobs/names';
import { env } from '@/lib/env';
import { assertOrderTransition } from './state-machine';

export class EsimProfilePendingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EsimProfilePendingError';
  }
}

export async function fulfillOrder(orderId: string): Promise<void> {
  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      packageCode: packages.providerPackageCode,
      providerTransactionId: orders.providerTransactionId,
      providerOrderNo: orders.providerOrderNo,
      customerEmail: orders.customerEmail,
    })
    .from(orders)
    .innerJoin(packages, eq(orders.packageId, packages.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || !['PAID', 'PROVISIONING'].includes(order.status)) return;

  if (env.NODE_ENV === 'production' && env.ESIM_PROVIDER === 'mock') {
    throw new Error('Mock eSIM fulfillment is disabled in production');
  }

  if (order.status === 'PAID') {
    assertOrderTransition(order.status, 'PROVISIONING');
  }

  const startedAt = new Date();
  const started = await db.transaction(async (transaction) => {
    const [transitioned] = await transaction
      .update(orders)
      .set({
        status: 'PROVISIONING',
        fulfillmentAttempts: sql`${orders.fulfillmentAttempts} + 1`,
        updatedAt: startedAt,
      })
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.status, 'PAID'),
        ),
      )
      .returning({
        id: orders.id,
        fulfillmentAttempts: orders.fulfillmentAttempts,
      });

    if (transitioned) {
      await transaction.insert(orderEvents).values({
        orderId,
        type: 'STATUS_CHANGED',
        message: 'PAID → PROVISIONING',
        details: { status: 'PROVISIONING' },
      });
    }

    const [updated] = transitioned
      ? [transitioned]
      : await transaction
          .update(orders)
          .set({
            fulfillmentAttempts: sql`${orders.fulfillmentAttempts} + 1`,
            updatedAt: startedAt,
          })
          .where(
            and(
              eq(orders.id, orderId),
              eq(orders.status, 'PROVISIONING'),
            ),
          )
          .returning({
            id: orders.id,
            fulfillmentAttempts: orders.fulfillmentAttempts,
          });

    if (updated) {
      await transaction.insert(orderEvents).values({
        orderId,
        type: 'ESIM_FULFILLMENT_ATTEMPT',
        message: 'eSIM fulfillment attempt started',
        details: { attempt: updated.fulfillmentAttempts },
      });
    }

    return updated;
  });
  if (!started) return;

  const provider = createEsimProvider();
  let providerOrderNo = order.providerOrderNo;

  if (!providerOrderNo) {
    await db.insert(orderEvents).values({
      orderId,
      type: 'ESIM_ORDER_REQUESTED',
      message: 'eSIM Access profile order requested',
      details: {
        endpoint: '/api/v1/open/esim/order',
        transactionId: order.providerTransactionId,
        packageCode: order.packageCode,
      },
    });

    const providerOrder = await provider.orderProfile({
      transactionId: order.providerTransactionId,
      packageCode: order.packageCode,
    });
    const [savedOrder] = await db
      .update(orders)
      .set({ providerOrderNo: providerOrder.orderNo, updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), isNull(orders.providerOrderNo)))
      .returning({ providerOrderNo: orders.providerOrderNo });

    if (savedOrder?.providerOrderNo) {
      providerOrderNo = savedOrder.providerOrderNo;
      await db.insert(orderEvents).values({
        orderId,
        type: 'ESIM_ORDER_ACCEPTED',
        message: 'eSIM Access accepted the profile order',
        details: {
          endpoint: '/api/v1/open/esim/order',
          providerOrderNo,
          transactionId: order.providerTransactionId,
        },
      });
    } else {
      const [currentOrder] = await db
        .select({ providerOrderNo: orders.providerOrderNo })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      if (!currentOrder?.providerOrderNo) {
        throw new Error('Could not persist the eSIM Access order number');
      }
      if (currentOrder.providerOrderNo !== providerOrder.orderNo) {
        throw new Error('eSIM Access returned inconsistent order numbers');
      }
      providerOrderNo = currentOrder.providerOrderNo;
    }
  }

  if (!providerOrderNo) {
    throw new Error('Provider order number is unavailable');
  }

  const profiles = await provider.queryProfiles(providerOrderNo);
  const profileMatches = profiles.filter(
    (profile) =>
      profile.orderNo === providerOrderNo &&
      (!profile.transactionId ||
        profile.transactionId === order.providerTransactionId),
  );
  await db.insert(orderEvents).values({
    orderId,
    type: 'ESIM_PROFILES_QUERIED',
    message: 'eSIM Access allocation status checked',
    details: {
      endpoint: '/api/v1/open/esim/query',
      providerOrderNo,
      profileCount: profiles.length,
      matchingProfileCount: profileMatches.length,
    },
  });

  if (profileMatches.length === 0) {
    throw new EsimProfilePendingError(
      'eSIM profile has not been allocated yet',
    );
  }
  if (profileMatches.length !== 1) {
    throw new Error(
      `Expected one eSIM profile for transaction ${order.providerTransactionId}, found ${profileMatches.length}`,
    );
  }

  const profile = profileMatches[0];
  if (
    !['RELEASED', 'ENABLED'].includes(profile.smdpStatus) ||
    !profile.activationCode ||
    !profile.qrCodeUrl
  ) {
    throw new EsimProfilePendingError(
      'eSIM profile is not ready for customer delivery',
    );
  }

  const deliveredAt = new Date();
  const [deliveredOrder] = await db.transaction(async (transaction) => {
    const [updated] = await transaction
      .update(orders)
      .set({
        status: 'DELIVERED',
        iccid: profile.iccid,
        lpaActivationCode: profile.activationCode,
        qrUrl: profile.qrCodeUrl,
        deliveredAt,
        errorMessage: null,
        updatedAt: deliveredAt,
      })
      .where(and(eq(orders.id, orderId), eq(orders.status, 'PROVISIONING')))
      .returning({ id: orders.id });

    if (updated) {
      assertOrderTransition('PROVISIONING', 'DELIVERED');
      await transaction.insert(orderEvents).values({
        orderId,
        type: 'STATUS_CHANGED',
        message: 'PROVISIONING → DELIVERED',
        details: {
          status: 'DELIVERED',
          providerOrderNo,
          esimTranNo: profile.esimTranNo,
          hasActivationCode: true,
          hasQrUrl: true,
        },
      });
    }
    return [updated];
  });

  if (deliveredOrder && order.customerEmail) {
    if (env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) {
      const jobId = await enqueueJob(
        DELIVERY_EMAIL_JOB,
        { orderId },
        {
          retryLimit: 8,
          retryDelay: 15,
          retryBackoff: true,
          singletonKey: orderId,
          singletonMinutes: 15,
        },
      );
      await db.insert(orderEvents).values({
        orderId,
        type: 'DELIVERY_EMAIL_ENQUEUED',
        message: 'Delivery email job enqueued',
        details: { jobId },
      });
    } else {
      await db.insert(orderEvents).values({
        orderId,
        type: 'DELIVERY_EMAIL_SKIPPED',
        message: 'Delivery email skipped because Resend is not configured',
      });
    }
  }
}

export async function failOrderFulfillment(
  orderId: string,
  error: unknown,
): Promise<void> {
  const failedAt = new Date();
  const errorMessage =
    error instanceof Error ? error.message : 'Unknown fulfillment error';

  await db.transaction(async (transaction) => {
    const [current] = await transaction
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (
      !current ||
      !['PAID', 'PROVISIONING'].includes(current.status)
    ) {
      return;
    }
    assertOrderTransition(current.status, 'FAILED');

    const [failed] = await transaction
      .update(orders)
      .set({
        status: 'FAILED',
        errorMessage: errorMessage.slice(0, 1000),
        updatedAt: failedAt,
      })
      .where(and(eq(orders.id, orderId), eq(orders.status, current.status)))
      .returning({ id: orders.id });

    if (failed) {
      await transaction.insert(orderEvents).values({
        orderId,
        type: 'STATUS_CHANGED',
        message: `${current.status} → FAILED`,
        details: {
          status: 'FAILED',
          error: errorMessage.slice(0, 1000),
        },
      });
    }
  });
}
