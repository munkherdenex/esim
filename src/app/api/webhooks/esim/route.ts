import { createHash } from 'node:crypto';
import { checkRateLimit } from '@/server/lib/rate-limit';
import { env } from '@/lib/env';
import { enqueueJob } from '@/server/jobs/queue';
import { RECONCILE_FULFILLMENTS_JOB } from '@/server/jobs/names';
import { hashAccessToken, matchesAccessToken } from '@/server/orders/token';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const callbackSecret = new URL(request.url).searchParams.get('secret') ?? '';
  if (
    !env.ESIM_WEBHOOK_SECRET ||
    !matchesAccessToken(
      callbackSecret,
      hashAccessToken(env.ESIM_WEBHOOK_SECRET),
    )
  ) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 65_536) {
    return Response.json({ error: 'Payload too large' }, { status: 413 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > 65_536) {
      return Response.json({ error: 'Payload too large' }, { status: 413 });
    }
    JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  const clientIp =
    forwardedFor?.split(',').at(-1)?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  if (!(await checkRateLimit(`esim-webhook:${clientIp}`, 60, 60_000))) {
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const jobId = await enqueueJob(
      RECONCILE_FULFILLMENTS_JOB,
      { source: 'provider-webhook' },
      {
        singletonKey: RECONCILE_FULFILLMENTS_JOB,
        singletonMinutes: 1,
      },
    );
    console.info('eSIM Access webhook accepted', {
      payloadHash: createHash('sha256').update(rawBody).digest('hex'),
      jobId,
    });
  } catch (error) {
    console.error('Failed to enqueue eSIM fulfillment reconciliation:', error);
    return Response.json(
      { error: 'Webhook could not be queued' },
      { status: 503 },
    );
  }

  return Response.json({ accepted: true });
}
