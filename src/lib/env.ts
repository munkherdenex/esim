import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  ESIM_PROVIDER: z.enum(['mock', 'esim-access']).default('mock'),
  ESIM_ACCESS_CODE: z.string().min(1).optional(),
  USD_TO_MNT_RATE: z.coerce.number().positive().optional(),
  DEFAULT_MARKUP_PERCENT: z.coerce.number().nonnegative().optional(),
  ROUNDING_STEP_MNT: z.coerce.number().int().positive().optional(),
});

export const env = envSchema
  .superRefine((value, context) => {
    if (value.ESIM_PROVIDER === 'esim-access' && !value.ESIM_ACCESS_CODE) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ESIM_ACCESS_CODE'],
        message: 'ESIM_ACCESS_CODE is required when ESIM_PROVIDER=esim-access',
      });
    }
  })
  .parse(process.env);
