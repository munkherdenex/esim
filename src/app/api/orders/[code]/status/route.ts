import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { checkRateLimit } from '@/server/lib/rate-limit';
import { matchesAccessToken } from '@/server/orders/token';

export const runtime = 'nodejs';

const tokenSchema = z.string().min(32).max(128);

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await context.params;
  const accessToken = new URL(request.url).searchParams.get('t') ?? '';
  if (!tokenSchema.safeParse(accessToken).success) {
    return Response.json({ error: 'Захиалга олдсонгүй.' }, { status: 404 });
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  const clientIp =
    forwardedFor?.split(',').at(-1)?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  if (!(await checkRateLimit(`order-status:${clientIp}`, 30, 60_000))) {
    return Response.json({ error: 'Хэт олон хүсэлт илгээлээ.' }, { status: 429 });
  }

  const [order] = await db
    .select({
      accessTokenHash: orders.accessTokenHash,
      status: orders.status,
      expiresAt: orders.expiresAt,
      deliveredAt: orders.deliveredAt,
      iccid: orders.iccid,
      activationCode: orders.lpaActivationCode,
      qrUrl: orders.qrUrl,
    })
    .from(orders)
    .where(eq(orders.publicCode, code))
    .limit(1);

  if (!order || !matchesAccessToken(accessToken, order.accessTokenHash)) {
    return Response.json({ error: 'Захиалга олдсонгүй.' }, { status: 404 });
  }

  return Response.json({
    status: order.status,
    expiresAt: order.expiresAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    ...(order.status === 'DELIVERED'
      ? {
          profile: {
            iccid: order.iccid,
            activationCode: order.activationCode,
            qrUrl: order.qrUrl,
          },
        }
      : {}),
  });
}
