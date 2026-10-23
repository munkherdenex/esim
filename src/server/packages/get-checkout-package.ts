import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { packages } from '@/db/schema';
import { getCountryByCode } from '@/lib/catalog';

export async function getCheckoutPackage(packageId: string) {
  const [item] = await db
    .select({
      id: packages.id,
      countryCode: packages.countryCode,
      dataGb: packages.dataGb,
      validityDays: packages.validityDays,
      priceMnt: packages.priceMnt,
      supportsChinaSocialApps: packages.supportsChinaSocialApps,
    })
    .from(packages)
    .where(and(eq(packages.id, packageId), eq(packages.isActive, true)))
    .limit(1);

  if (!item) return undefined;
  const country = getCountryByCode(item.countryCode);
  if (!country) return undefined;

  return { ...item, country };
}
