import { and, eq } from 'drizzle-orm';
import { env } from '@/lib/env';
import { db } from '@/db';
import { orderEvents, orders } from '@/db/schema';
import { MockPaymentProvider } from './mock-provider';
import { QPayClient } from './qpay-client';
import type { PaymentProvider } from './types';

export function createPaymentProvider(): PaymentProvider {
  if (env.QPAY_PROVIDER === 'qpay') {
    if (
      !env.QPAY_CLIENT_ID ||
      !env.QPAY_CLIENT_SECRET ||
      !env.QPAY_INVOICE_PROFILE_JSON
    ) {
      throw new Error('QPay credentials and invoice profile are required');
    }

    return new QPayClient(
      {
        clientId: env.QPAY_CLIENT_ID,
        clientSecret: env.QPAY_CLIENT_SECRET,
      },
      QPayClient.parseInvoiceProfile(env.QPAY_INVOICE_PROFILE_JSON),
      env.QPAY_ENVIRONMENT,
    );
  }

  return new MockPaymentProvider(async (invoiceId) => {
    const [order] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.qpayInvoiceId, invoiceId))
      .limit(1);
    if (!order) return false;

    const [confirmation] = await db
      .select({ id: orderEvents.id })
      .from(orderEvents)
      .where(
        and(
          eq(orderEvents.orderId, order.id),
          eq(orderEvents.type, 'MOCK_PAYMENT_CONFIRMED'),
        ),
      )
      .limit(1);

    return Boolean(confirmation);
  });
}

export type { PaymentProvider } from './types';
