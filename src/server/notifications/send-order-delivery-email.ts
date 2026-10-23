import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { orderEvents, orders } from '@/db/schema';
import { env } from '@/lib/env';
import { decryptAccessToken } from '@/server/orders/encrypted-token';
import { sendDeliveryEmail } from './delivery-email';

export async function sendOrderDeliveryEmail(orderId: string): Promise<void> {
  const [order] = await db
    .select({
      publicCode: orders.publicCode,
      status: orders.status,
      customerEmail: orders.customerEmail,
      accessTokenEncrypted: orders.accessTokenEncrypted,
      qrUrl: orders.qrUrl,
      deliveryEmailCompletedAt: orders.deliveryEmailCompletedAt,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (
    !order ||
    order.status !== 'DELIVERED' ||
    !order.customerEmail ||
    order.deliveryEmailCompletedAt
  ) {
    return;
  }

  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    return;
  }

  if (!order.accessTokenEncrypted || !order.qrUrl) {
    const processedAt = new Date();
    await db.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(orders)
        .set({ deliveryEmailCompletedAt: processedAt, updatedAt: processedAt })
        .where(
          and(eq(orders.id, orderId), isNull(orders.deliveryEmailCompletedAt)),
        )
        .returning({ id: orders.id });
      if (!updated) return;

      await transaction.insert(orderEvents).values({
        orderId,
        type: 'DELIVERY_EMAIL_SKIPPED',
        message: 'Delivery email skipped because the encrypted order link or QR URL is missing',
      });
    });
    return;
  }

  const accessToken = decryptAccessToken(order.accessTokenEncrypted);
  await sendDeliveryEmail({
    orderId,
    publicCode: order.publicCode,
    customerEmail: order.customerEmail,
    accessToken,
    qrUrl: order.qrUrl,
  });

  const sentAt = new Date();
  await db.transaction(async (transaction) => {
    const [updated] = await transaction
      .update(orders)
      .set({ deliveryEmailCompletedAt: sentAt, updatedAt: sentAt })
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.status, 'DELIVERED'),
          isNull(orders.deliveryEmailCompletedAt),
        ),
      )
      .returning({ id: orders.id });
    if (!updated) return;

    await transaction.insert(orderEvents).values({
      orderId,
      type: 'DELIVERY_EMAIL_SENT',
      message: 'eSIM delivery email sent',
    });
  });
}
