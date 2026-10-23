import { inArray } from 'drizzle-orm';
import { env } from '@/lib/env';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { z } from 'zod';

const pricingSettingSchema = z.number().finite();
const settingKeys = [
  'usd_to_mnt',
  'default_markup_percent',
  'rounding_step_mnt',
] as const;

export interface PricingConfig {
  usdToMnt: number;
  markupPercent: number;
  roundingStepMnt: number;
}

export async function getPricingConfig(): Promise<PricingConfig> {
  const rows = await db
    .select()
    .from(settings)
    .where(inArray(settings.key, [...settingKeys]));
  const stored = new Map(rows.map((row) => [row.key, row.value]));

  const usdToMnt = readSetting(
    stored.get('usd_to_mnt'),
    env.USD_TO_MNT_RATE,
    'usd_to_mnt / USD_TO_MNT_RATE',
  );
  const markupPercent = readSetting(
    stored.get('default_markup_percent'),
    env.DEFAULT_MARKUP_PERCENT,
    'default_markup_percent / DEFAULT_MARKUP_PERCENT',
  );
  const roundingStepMnt = readSetting(
    stored.get('rounding_step_mnt'),
    env.ROUNDING_STEP_MNT,
    'rounding_step_mnt / ROUNDING_STEP_MNT',
  );

  return {
    usdToMnt: z.number().positive().parse(usdToMnt),
    markupPercent: z.number().nonnegative().parse(markupPercent),
    roundingStepMnt: z.number().int().positive().parse(roundingStepMnt),
  };
}

function readSetting(
  storedValue: unknown,
  envValue: number | undefined,
  name: string,
): number {
  const value = storedValue ?? envValue;
  const parsed = pricingSettingSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `Missing or invalid pricing setting ${name}; configure it in settings or the environment`,
    );
  }
  return parsed.data;
}
