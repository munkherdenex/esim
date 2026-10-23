import { z } from 'zod';
import { createCheckoutOrder } from '@/server/orders/create-checkout-order';
import { checkRateLimit } from '@/server/lib/rate-limit';

export const runtime = 'nodejs';

const checkoutRequestSchema = z
  .object({
    packageId: z.string().uuid(),
    customerPhone: z.string().trim().min(8).max(30),
    customerEmail: z.union([z.literal(''), z.string().trim().email()]).optional(),
    compatibilityConfirmed: z.literal(true),
    idempotencyKey: z.string().regex(/^[a-f0-9]{64}$/i),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const clientIp =
    forwardedFor?.split(',').at(-1)?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  if (!(await checkRateLimit(`checkout:${clientIp}`, 5, 60_000))) {
    return Response.json(
      { error: 'Хэт олон хүсэлт илгээлээ. Түр хүлээгээд дахин оролдоно уу.' },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Хүсэлтийн мэдээлэл буруу байна.' }, { status: 400 });
  }

  const parsed = checkoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Утасны дугаар, багц болон төхөөрөмжийн баталгаажуулалтаа шалгана уу.' },
      { status: 400 },
    );
  }

  try {
    const result = await createCheckoutOrder({
      packageId: parsed.data.packageId,
      customerPhone: parsed.data.customerPhone,
      customerEmail: parsed.data.customerEmail || undefined,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    if (result.kind === 'unavailable') {
      return Response.json(
        { error: 'Энэ багц одоогоор худалдаанд байхгүй байна.' },
        { status: 404 },
      );
    }
    if (result.kind === 'reconciliation-required') {
      return Response.json(
        {
          error:
            'Нэхэмжлэлийн хариу тодорхойгүй байна. Дахин төлбөр үүсгэхгүйн тулд дэмжлэгтэй холбогдоно уу.',
        },
        { status: 409 },
      );
    }
    if (result.kind === 'invoice-failed') {
      return Response.json(
        { error: 'Төлбөрийн нэхэмжлэл үүссэнгүй. Дэмжлэгтэй холбогдоно уу.' },
        { status: 502 },
      );
    }

    const paymentUrl = new URL(
      `/payment/${encodeURIComponent(result.publicCode)}`,
      new URL(request.url).origin,
    );
    paymentUrl.searchParams.set('t', result.accessToken);

    return Response.json({
      paymentUrl: `${paymentUrl.pathname}${paymentUrl.search}`,
    });
  } catch (error) {
    console.error('Checkout request failed:', error);
    return Response.json(
      { error: 'Захиалга үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.' },
      { status: 500 },
    );
  }
}
