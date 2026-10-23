import type PgBoss from 'pg-boss';
import { createEsimProvider } from '@/server/esim';
import { syncPackages } from '@/server/packages/sync-packages';
import { getPricingConfig } from '@/server/pricing/get-pricing-config';

export const PACKAGE_SYNC_JOB = 'sync-esim-packages';

export async function registerPackageSyncJob(boss: PgBoss): Promise<void> {
  await boss.work(PACKAGE_SYNC_JOB, async () => {
    const count = await syncPackages(
      createEsimProvider(),
      await getPricingConfig(),
    );
    console.info(`Synced ${count} eSIM packages`);
  });

  await boss.schedule(PACKAGE_SYNC_JOB, '0 3 * * *');
}
