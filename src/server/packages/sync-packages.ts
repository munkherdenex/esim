import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { packages } from '@/db/schema';
import type { EsimPackage, EsimProvider } from '@/server/esim';
import { calculatePriceMnt } from '@/server/pricing/calculate-price';
import type { PricingConfig } from '@/server/pricing/get-pricing-config';

const countryNamesMn: Record<string, string> = {
  CN: 'Хятад',
  KR: 'Өмнөд Солонгос',
};

export async function syncPackages(
  provider: EsimProvider,
  pricing: PricingConfig,
): Promise<number> {
  const providerPackages = await provider.listPackages();
  const syncedAt = new Date();

  await db.transaction(async (transaction) => {
    for (const item of providerPackages) {
      await upsertPackage(transaction, item, pricing, syncedAt);
    }
  });

  return providerPackages.length;
}

async function upsertPackage(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  item: EsimPackage,
  pricing: PricingConfig,
  syncedAt: Date,
): Promise<void> {
  const priceMnt = calculatePriceMnt({
    costUsd: item.costUsd,
    usdToMnt: pricing.usdToMnt,
    markupPercent: pricing.markupPercent,
    roundingStepMnt: pricing.roundingStepMnt,
  });

  await transaction
    .insert(packages)
    .values({
      providerPackageCode: item.providerPackageCode,
      providerName: item.providerName,
      countryCode: item.countryCode,
      countryNameMn: countryNamesMn[item.countryCode] ?? null,
      dataGb: item.dataGb,
      validityDays: item.validityDays,
      costUsd: item.costUsd,
      priceMnt,
      lastSyncedAt: syncedAt,
      updatedAt: syncedAt,
    })
    .onConflictDoUpdate({
      target: packages.providerPackageCode,
      set: {
        providerName: item.providerName,
        countryCode: item.countryCode,
        countryNameMn: sql`COALESCE(${packages.countryNameMn}, EXCLUDED.country_name_mn)`,
        dataGb: item.dataGb,
        validityDays: item.validityDays,
        costUsd: item.costUsd,
        priceMnt: sql`CASE WHEN ${packages.priceOverridden} THEN ${packages.priceMnt} ELSE EXCLUDED.price_mnt END`,
        lastSyncedAt: syncedAt,
        updatedAt: syncedAt,
      },
    });
}
