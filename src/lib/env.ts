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
  QPAY_PROVIDER: z.enum(['mock', 'qpay']).default('mock'),
  QPAY_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  QPAY_CLIENT_ID: z.string().min(1).optional(),
  QPAY_CLIENT_SECRET: z.string().min(1).optional(),
  QPAY_INVOICE_PROFILE_JSON: z.string().min(1).optional(),
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
    if (value.QPAY_PROVIDER === 'qpay') {
      for (const key of [
        'QPAY_CLIENT_ID',
        'QPAY_CLIENT_SECRET',
        'QPAY_INVOICE_PROFILE_JSON',
      ] as const) {
        if (!value[key]) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when QPAY_PROVIDER=qpay`,
          });
        }
      }
    }
  })
  .parse(process.env);
