import { randomBytes, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { env } from '@/lib/env';
import { db } from '@/db';
import { orderEvents, orders, packages } from '@/db/schema';
import { createPaymentProvider } from '@/server/qpay';
import { hashAccessToken } from './token';

const invoiceLifetimeMs = 30 * 60 * 1000;

export type CheckoutOrderResult =
  | { kind: 'created' | 'existing'; publicCode: string; accessToken: string }
  | { kind: 'unavailable' }
  | { kind: 'reconciliation-required'; publicCode: string }
  | { kind: 'invoice-failed'; publicCode: string };

export async function createCheckoutOrder(input: {
  packageId: string;
  customerPhone: string;
  customerEmail?: string;
  idempotencyKey: string;
}): Promise<CheckoutOrderResult> {
  const idempotencyHash = hashAccessToken(input.idempotencyKey);
  const [existingOrder] = await db
    .select({
      id: orders.id,
      publicCode: orders.publicCode,
      status: orders.status,
      qpayInvoiceId: orders.qpayInvoiceId,
      qpayInvoiceAttemptedAt: orders.qpayInvoiceAttemptedAt,
    })
    .from(orders)
    .where(eq(orders.checkoutIdempotencyKeyHash, idempotencyHash))
    .limit(1);

  if (existingOrder) {
    if (existingOrder.qpayInvoiceId) {
      return {
        kind: 'existing',
        publicCode: existingOrder.publicCode,
        accessToken: input.idempotencyKey,
      };
    }
    if (existingOrder.qpayInvoiceAttemptedAt) {
      return {
        kind: 'reconciliation-required',
        publicCode: existingOrder.publicCode,
      };
    }
  }

  const [packageRecord] = await db
    .select({
      id: packages.id,
      countryCode: packages.countryCode,
      dataGb: packages.dataGb,
      validityDays: packages.validityDays,
      priceMnt: packages.priceMnt,
    })
    .from(packages)
    .where(
      and(eq(packages.id, input.packageId), eq(packages.isActive, true)),
    )
    .limit(1);

  if (!packageRecord) {
    return { kind: 'unavailable' };
  }

  const orderId = randomUUID();
  const publicCode = `HB${randomBytes(5).toString('hex').toUpperCase()}`;
  const expiresAt = new Date(Date.now() + invoiceLifetimeMs);
  const orderValues = {
    id: orderId,
    publicCode,
    accessTokenHash: idempotencyHash,
    checkoutIdempotencyKeyHash: idempotencyHash,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail ?? null,
    packageId: packageRecord.id,
    priceMnt: packageRecord.priceMnt,
    providerTransactionId: randomUUID(),
    expiresAt,
  };

  const insertedOrder = await db.transaction(async (transaction) => {
    const [created] = await transaction
      .insert(orders)
      .values(orderValues)
      .onConflictDoNothing({
        target: orders.checkoutIdempotencyKeyHash,
      })
      .returning({ id: orders.id });

    if (!created) return false;

    await transaction.insert(orderEvents).values({
      orderId,
      type: 'ORDER_CREATED',
      message: 'Checkout order created',
      details: {
        packageId: packageRecord.id,
        countryCode: packageRecord.countryCode,
        priceMnt: packageRecord.priceMnt,
      },
    });

    return true;
  });

  if (!insertedOrder) {
    const [concurrentOrder] = await db
      .select({
        id: orders.id,
        publicCode: orders.publicCode,
        qpayInvoiceId: orders.qpayInvoiceId,
        qpayInvoiceAttemptedAt: orders.qpayInvoiceAttemptedAt,
      })
      .from(orders)
      .where(eq(orders.checkoutIdempotencyKeyHash, idempotencyHash))
      .limit(1);

    if (!concurrentOrder) {
      throw new Error('Checkout idempotency conflict without an existing order');
    }
    if (concurrentOrder.qpayInvoiceId) {
      return {
        kind: 'existing',
        publicCode: concurrentOrder.publicCode,
        accessToken: input.idempotencyKey,
      };
    }
    if (concurrentOrder.qpayInvoiceAttemptedAt) {
      return {
        kind: 'reconciliation-required',
        publicCode: concurrentOrder.publicCode,
      };
    }
    throw new Error('Concurrent checkout order is not ready for invoice creation');
  }

  const attemptedAt = new Date();
  await db.transaction(async (transaction) => {
    await transaction
      .update(orders)
      .set({ qpayInvoiceAttemptedAt: attemptedAt, updatedAt: attemptedAt })
      .where(eq(orders.id, orderId));

    await transaction.insert(orderEvents).values({
      orderId,
      type: 'QPAY_INVOICE_REQUESTED',
      message: 'Invoice creation requested',
      details: {
        provider: env.QPAY_PROVIDER,
        endpoint: env.QPAY_PROVIDER === 'qpay' ? '/v2/invoice' : 'mock',
        amountMnt: packageRecord.priceMnt,
      },
    });
  });

  try {
    const invoice = await createPaymentProvider().createInvoice({
      senderInvoiceNo: orderId.replaceAll('-', ''),
      description: `Holbo order ${publicCode}`,
      amountMnt: packageRecord.priceMnt,
      callbackUrl: new URL(
        `/api/qpay/callback?orderId=${encodeURIComponent(orderId)}`,
        env.APP_URL,
      ).toString(),
      customerPhone: input.customerPhone,
      orderCode: publicCode,
    });

    await db.transaction(async (transaction) => {
      await transaction
        .update(orders)
        .set({
          qpayInvoiceId: invoice.invoiceId,
          qpayQrText: invoice.qrText,
          qpayQrImage: invoice.qrImage,
          qpayShortUrl: invoice.shortUrl ?? null,
          qpayUrls: invoice.urls,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));

      await transaction.insert(orderEvents).values({
        orderId,
        type: 'QPAY_INVOICE_CREATED',
        message: 'Invoice created',
        details: {
          provider: env.QPAY_PROVIDER,
          endpoint: env.QPAY_PROVIDER === 'qpay' ? '/v2/invoice' : 'mock',
          invoiceId: invoice.invoiceId,
          bankLinkCount: invoice.urls.length,
          hasQrImage: Boolean(invoice.qrImage),
        },
      });
    });

    return {
      kind: 'created',
      publicCode,
      accessToken: input.idempotencyKey,
    };
  } catch (error) {
    console.error('QPay invoice creation failed:', error);
    await db.transaction(async (transaction) => {
      await transaction
        .update(orders)
        .set({
          errorMessage: 'Invoice creation failed; manual reconciliation required',
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));

      await transaction.insert(orderEvents).values({
        orderId,
        type: 'QPAY_INVOICE_FAILED',
        message: 'Invoice creation failed; automatic retry is disabled',
        details: {
          provider: env.QPAY_PROVIDER,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    });
    return { kind: 'invoice-failed', publicCode };
  }
}
