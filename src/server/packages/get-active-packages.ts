import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { packages } from '@/db/schema';

export async function getActivePackages(countryCode: string) {
  return db
    .select({
      id: packages.id,
      countryCode: packages.countryCode,
      dataGb: packages.dataGb,
      validityDays: packages.validityDays,
      priceMnt: packages.priceMnt,
      supportsChinaSocialApps: packages.supportsChinaSocialApps,
    })
    .from(packages)
    .where(and(eq(packages.countryCode, countryCode), eq(packages.isActive, true)))
    .orderBy(asc(packages.sortOrder), asc(packages.priceMnt));
}
