import { pool } from '@/db';
import { createEsimProvider } from '@/server/esim';
import { syncPackages } from '@/server/packages/sync-packages';
import { getPricingConfig } from '@/server/pricing/get-pricing-config';

async function main() {
  try {
    const count = await syncPackages(
      createEsimProvider(),
      await getPricingConfig(),
    );
    console.info(`Synced ${count} eSIM packages`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Failed to sync eSIM packages:', error);
  process.exitCode = 1;
});
