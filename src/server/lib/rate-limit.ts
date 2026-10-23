import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { apiRateLimits } from '@/db/schema';

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);
  const keyHash = createHash('sha256').update(key).digest('hex');
  const windowExpired = sql`${apiRateLimits.windowStartedAt} <= ${cutoff}`;

  const [bucket] = await db
    .insert(apiRateLimits)
    .values({ keyHash, windowStartedAt: now, requestCount: 1 })
    .onConflictDoUpdate({
      target: apiRateLimits.keyHash,
      set: {
        windowStartedAt: sql`CASE WHEN ${windowExpired} THEN ${now} ELSE ${apiRateLimits.windowStartedAt} END`,
        requestCount: sql`CASE WHEN ${windowExpired} THEN 1 ELSE ${apiRateLimits.requestCount} + 1 END`,
      },
    })
    .returning({ requestCount: apiRateLimits.requestCount });

  return bucket.requestCount <= limit;
}
