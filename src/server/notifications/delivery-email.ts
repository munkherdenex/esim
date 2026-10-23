import { z } from 'zod';
import { env } from '@/lib/env';

interface DeliveryEmailInput {
  orderId: string;
  publicCode: string;
  customerEmail: string;
  accessToken: string;
  qrUrl: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildDeliveryEmail(input: DeliveryEmailInput) {
  const orderUrl = new URL(
    `/order/${encodeURIComponent(input.publicCode)}`,
    env.APP_URL,
  );
  orderUrl.searchParams.set('t', input.accessToken);
  const safeOrderUrl = escapeHtml(orderUrl.toString());
  const resolvedQrUrl = new URL(input.qrUrl, env.APP_URL);
  if (!['https:', 'http:'].includes(resolvedQrUrl.protocol)) {
    throw new Error('eSIM QR URL must use HTTP or HTTPS');
  }
  const safeQrUrl = escapeHtml(resolvedQrUrl.toString());
  const safeOrderCode = escapeHtml(input.publicCode);

  return {
    subject: 'Таны Holbo eSIM бэлэн боллоо',
    text: [
      'Таны eSIM бэлэн боллоо.',
      `Захиалгын дугаар: ${input.publicCode}`,
      `Суулгах заавар болон eSIM: ${orderUrl.toString()}`,
      'Нислэгээс өмнө гэртээ суулгаарай.',
    ].join('\n'),
    html: `<div style="font-family:Arial,sans-serif;color:#173b33;line-height:1.6"><h1>Таны eSIM бэлэн боллоо</h1><p>Захиалгын дугаар: <strong>${safeOrderCode}</strong></p><p><img src="${safeQrUrl}" width="220" height="220" alt="Таны eSIM QR код" /></p><p><a href="${safeOrderUrl}">eSIM болон суулгах заавар харах</a></p><p><strong>Нислэгээс өмнө гэртээ суулгаарай.</strong></p></div>`,
  };
}

export async function sendDeliveryEmail(
  input: DeliveryEmailInput,
): Promise<void> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new Error('RESEND_API_KEY and RESEND_FROM_EMAIL are required');
  }

  const email = buildDeliveryEmail(input);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `holbo-delivery-${input.orderId}`,
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [input.customerEmail],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Resend delivery email failed with HTTP ${response.status}`);
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch (error) {
    throw new Error(
      `Resend returned invalid JSON: ${
        error instanceof Error ? error.message : 'unknown parse error'
      }`,
    );
  }
  const parsed = z.object({ id: z.string().min(1) }).safeParse(responseBody);
  if (!parsed.success) {
    throw new Error(
      `Resend response did not match the documented schema: ${parsed.error.message}`,
    );
  }
}
