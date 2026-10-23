import 'dotenv/config';
import { env } from '@/lib/env';
import { createEsimProvider } from '@/server/esim';

async function main() {
  if (env.ESIM_PROVIDER !== 'esim-access') {
    throw new Error(
      'Set ESIM_PROVIDER=esim-access before configuring the provider webhook',
    );
  }
  if (!env.ESIM_WEBHOOK_SECRET) {
    throw new Error('ESIM_WEBHOOK_SECRET is required to configure the webhook');
  }

  const webhookUrl = new URL('/api/webhooks/esim', env.APP_URL);
  if (env.NODE_ENV === 'production' && webhookUrl.protocol !== 'https:') {
    throw new Error('Production eSIM webhook URL must use HTTPS');
  }
  webhookUrl.searchParams.set('secret', env.ESIM_WEBHOOK_SECRET);

  await createEsimProvider().setWebhook(webhookUrl.toString());
  console.info('eSIM Access webhook registered:', webhookUrl.origin + webhookUrl.pathname);
}

main().catch((error: unknown) => {
  console.error('Failed to configure eSIM Access webhook:', error);
  process.exitCode = 1;
});
