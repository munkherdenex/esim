import { eq } from 'drizzle-orm';
import { enqueueJob } from '@/server/jobs/queue';
import { VERIFY_PAYMENT_JOB } from '@/server/jobs/payment';
import { z } from 'zod';
import { db } from '@/db';
import { orderEvents, orders } from '@/db/schema';

export const runtime = 'nodejs';

async function handleCallback(request: Request): Promise<Response> {
  const callbackUrl = new URL(request.url);
  const orderId = callbackUrl.searchParams.get('orderId');
  const parsedOrderId = z.string().uuid().safeParse(orderId);

  if (!parsedOrderId.success) {
    console.error('QPay callback did not include a valid order identifier');
    return new Response('SUCCESS', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const validOrderId = parsedOrderId.data;
  try {
    const [order] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.id, validOrderId))
      .limit(1);
    if (!order) {
      console.error('QPay callback referenced an unknown order');
      return new Response('SUCCESS', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    await db.insert(orderEvents).values({
      orderId: validOrderId,
      type: 'QPAY_CALLBACK_RECEIVED',
      message: 'QPay callback received',
      details: { method: request.method },
    });
    const jobId = await enqueueJob(VERIFY_PAYMENT_JOB, {
      orderId: validOrderId,
    });
    await db.insert(orderEvents).values({
      orderId: validOrderId,
      type: 'QPAY_VERIFICATION_ENQUEUED',
      message: 'Payment verification job enqueued',
      details: { jobId },
    });
  } catch (error) {
    console.error('Failed to enqueue QPay payment verification:', error);
  }

  return new Response('SUCCESS', {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export const GET = handleCallback;
export const POST = handleCallback;
