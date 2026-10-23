import { z } from 'zod';
import type { EsimPackage, EsimProvider } from './types';

const baseUrl = 'https://api.esimaccess.com';
const packagesPath = '/api/v1/open/package/list';
const requestIntervalMs = 125;

const providerPackageSchema = z.object({
  packageCode: z.string().min(1),
  name: z.string().min(1),
  price: z.number().int().nonnegative(),
  currencyCode: z.literal('USD'),
  volume: z.number().int().positive(),
  duration: z.number().int().positive(),
  durationUnit: z.literal('DAY'),
  location: z.string().min(1),
});

const packageListResponseSchema = z.object({
  success: z.boolean(),
  errorCode: z.union([z.string(), z.number()]).nullable().optional(),
  errorMsg: z.string().nullable().optional(),
  obj: z
    .object({
      packageList: z.array(providerPackageSchema),
    })
    .nullable()
    .optional(),
});

export class EsimAccessApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly providerCode?: string | number | null,
  ) {
    super(message);
    this.name = 'EsimAccessApiError';
  }
}

export class EsimAccessProvider implements EsimProvider {
  private requestQueue: Promise<void> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(
    private readonly accessCode: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    if (!accessCode.trim()) {
      throw new Error('An eSIM Access RT-AccessCode is required');
    }
  }

  async listPackages(): Promise<EsimPackage[]> {
    await this.waitForRateLimit();

    const response = await this.fetcher(`${baseUrl}${packagesPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'RT-AccessCode': this.accessCode,
      },
      body: JSON.stringify({ type: 'BASE' }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new EsimAccessApiError(
        `eSIM Access package request failed with HTTP ${response.status}`,
        response.status,
      );
    }

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch (error) {
      throw new EsimAccessApiError(
        `eSIM Access returned invalid JSON: ${
          error instanceof Error ? error.message : 'unknown parse error'
        }`,
        response.status,
      );
    }

    const parsed = packageListResponseSchema.safeParse(responseBody);
    if (!parsed.success) {
      throw new EsimAccessApiError(
        `eSIM Access package response did not match the documented schema: ${parsed.error.message}`,
        response.status,
      );
    }

    if (!parsed.data.success || !parsed.data.obj) {
      throw new EsimAccessApiError(
        `eSIM Access package request was rejected: ${
          parsed.data.errorMsg ?? 'provider returned success=false'
        }`,
        response.status,
        parsed.data.errorCode,
      );
    }

    return parsed.data.obj.packageList.map((item) => ({
      providerPackageCode: item.packageCode,
      providerName: item.name,
      countryCode: item.location,
      dataGb: Number((item.volume / 1024 ** 3).toFixed(3)),
      validityDays: item.duration,
      costUsd: item.price / 10_000,
    }));
  }

  private async waitForRateLimit(): Promise<void> {
    const previousRequest = this.requestQueue;
    let releaseQueue: () => void = () => undefined;
    this.requestQueue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });

    await previousRequest;
    const delay = Math.max(
      0,
      this.lastRequestAt + requestIntervalMs - Date.now(),
    );
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    this.lastRequestAt = Date.now();
    releaseQueue();
  }
}
