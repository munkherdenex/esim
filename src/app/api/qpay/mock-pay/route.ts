import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { env } from '@/lib/env';
import { db } from '@/db';
import { orderEvents, orders } from '@/db/schema';
import { enqueueJob } from '@/server/jobs/queue';
import { VERIFY_PAYMENT_JOB } from '@/server/jobs/payment';
import { checkRateLimit } from '@/server/lib/rate-limit';
import { matchesAccessToken } from '@/server/orders/token';

export const runtime = 'nodejs';

const mockPaymentSchema = z.object({
  publicCode: z.string().regex(/^HB[A-F0-9]{10}$/),
  accessToken: z.string().min(32),
});

export async function POST(request: Request): Promise<Response> {
  if (env.QPAY_PROVIDER !== 'mock' || env.NODE_ENV === 'production') {
    return Response.json({ error: 'Mock payment is disabled.' }, { status: 404 });
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  const clientIp =
    forwardedFor?.split(',').at(-1)?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  if (!(await checkRateLimit(`mock-payment:${clientIp}`, 10, 60_000))) {
    return Response.json({ error: 'Хэт олон хүсэлт илгээлээ.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Хүсэлтийн мэдээлэл буруу байна.' }, { status: 400 });
  }
  const parsed = mockPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Захиалга олдсонгүй.' }, { status: 404 });
  }

  const [order] = await db
    .select({
      id: orders.id,
      accessTokenHash: orders.accessTokenHash,
      status: orders.status,
      qpayInvoiceId: orders.qpayInvoiceId,
    })
    .from(orders)
    .where(eq(orders.publicCode, parsed.data.publicCode))
    .limit(1);

  if (
    !order ||
    !matchesAccessToken(parsed.data.accessToken, order.accessTokenHash)
  ) {
    return Response.json({ error: 'Захиалга олдсонгүй.' }, { status: 404 });
  }
  if (order.status !== 'PENDING_PAYMENT' || !order.qpayInvoiceId) {
    return Response.json(
      { error: 'Энэ захиалга төлбөр хүлээн авах боломжгүй байна.' },
      { status: 409 },
    );
  }

  await db.transaction(async (transaction) => {
    const [existingEvent] = await transaction
      .select({ id: orderEvents.id })
      .from(orderEvents)
      .where(
        and(
          eq(orderEvents.orderId, order.id),
          eq(orderEvents.type, 'MOCK_PAYMENT_CONFIRMED'),
        ),
      )
      .limit(1);

    if (!existingEvent) {
      await transaction.insert(orderEvents).values({
        orderId: order.id,
        type: 'MOCK_PAYMENT_CONFIRMED',
        message: 'Mock payment action requested by the order holder',
        details: { invoiceId: order.qpayInvoiceId },
      });
    }
  });

  try {
    await enqueueJob(VERIFY_PAYMENT_JOB, { orderId: order.id });
  } catch (error) {
    console.error('Failed to enqueue mock payment verification:', error);
    return Response.json(
      { error: 'Төлбөр шалгах хүсэлт явсангүй. Дахин оролдоно уу.' },
      { status: 503 },
    );
  }

  return Response.json({ accepted: true });
}
