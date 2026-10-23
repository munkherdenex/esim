import { createHmac, randomUUID } from 'node:crypto';
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

const apiResponseSchema = <T extends z.ZodType>(objSchema: T) =>
  z.object({
    success: z.boolean(),
    errorCode: z.union([z.string(), z.number()]).nullable().optional(),
    errorMsg: z.string().nullable().optional(),
    errorMessage: z.string().nullable().optional(),
    obj: objSchema.nullable().optional(),
  });

const packageListResponseSchema = apiResponseSchema(
  z.object({
    packageList: z.array(providerPackageSchema),
  }),
);

const orderResponseSchema = apiResponseSchema(
  z.object({
    orderNo: z.string().min(1),
    transactionId: z.string().min(1).optional(),
  }),
);

const profileResponseSchema = apiResponseSchema(
  z.object({
    esimList: z.array(
      z.object({
        orderNo: z.string().min(1),
        transactionId: z.string().min(1).optional(),
        esimTranNo: z.string().min(1),
        iccid: z.string().min(1),
        ac: z.string().min(1),
        qrCodeUrl: z.string().url(),
        smdpStatus: z.string().min(1),
        esimStatus: z.string().min(1),
      }),
    ),
  }),
);

const setWebhookResponseSchema = apiResponseSchema(z.object({}));

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
    private readonly secretKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    if (!accessCode.trim() || !secretKey.trim()) {
      throw new Error('eSIM Access RT-AccessCode and secret key are required');
    }
  }

  async listPackages(): Promise<EsimPackage[]> {
    const data = await this.request(
      packagesPath,
      { type: 'BASE' },
      packageListResponseSchema,
    );

    return data.packageList.map((item) => ({
      providerPackageCode: item.packageCode,
      providerName: item.name,
      countryCode: item.location,
      dataGb: Number((item.volume / 1024 ** 3).toFixed(3)),
      validityDays: item.duration,
      costUsd: item.price / 10_000,
    }));
  }

  async orderProfile(input: {
    transactionId: string;
    packageCode: string;
  }): Promise<{ orderNo: string }> {
    const result = await this.request(
      '/api/v1/open/esim/order',
      {
        transactionId: input.transactionId,
        packageInfoList: [{ packageCode: input.packageCode, count: 1 }],
      },
      orderResponseSchema,
    );
    if (
      result.transactionId &&
      result.transactionId !== input.transactionId
    ) {
      throw new EsimAccessApiError(
        'eSIM Access returned a different transactionId for the profile order',
      );
    }
    return { orderNo: result.orderNo };
  }

  async queryProfiles(orderNo: string) {
    const result = await this.request(
      '/api/v1/open/esim/query',
      {
        orderNo,
        iccid: '',
        pager: { pageNum: 1, pageSize: 50 },
      },
      profileResponseSchema,
    );

    return result.esimList.map((profile) => ({
      orderNo: profile.orderNo,
      transactionId: profile.transactionId,
      esimTranNo: profile.esimTranNo,
      iccid: profile.iccid,
      activationCode: profile.ac,
      qrCodeUrl: profile.qrCodeUrl,
      smdpStatus: profile.smdpStatus,
      esimStatus: profile.esimStatus,
    }));
  }

  async setWebhook(webhookUrl: string): Promise<void> {
    const validatedUrl = z.string().url().parse(webhookUrl);
    await this.request(
      '/api/v1/open/webhook/save',
      { webhook: validatedUrl },
      setWebhookResponseSchema,
    );
  }

  private async request<T>(
    path: string,
    body: unknown,
    responseSchema: z.ZodType<{
      success: boolean;
      errorCode?: string | number | null;
      errorMsg?: string | null;
      errorMessage?: string | null;
      obj?: T | null;
    }>,
  ): Promise<T> {
    await this.waitForRateLimit();
    const requestBody = JSON.stringify(body);
    const timestamp = Date.now().toString();
    const requestId = randomUUID();
    const signature = createHmac('sha256', this.secretKey)
      .update(`${timestamp}${requestId}${this.accessCode}${requestBody}`)
      .digest('hex');
    const response = await this.fetcher(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'RT-AccessCode': this.accessCode,
        'RT-Timestamp': timestamp,
        'RT-RequestID': requestId,
        'RT-Signature': signature,
      },
      body: requestBody,
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new EsimAccessApiError(
        `eSIM Access request to ${path} failed with HTTP ${response.status}`,
        response.status,
      );
    }

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch (error) {
      throw new EsimAccessApiError(
        `eSIM Access returned invalid JSON for ${path}: ${
          error instanceof Error ? error.message : 'unknown parse error'
        }`,
        response.status,
      );
    }

    const parsed = responseSchema.safeParse(responseBody);
    if (!parsed.success) {
      throw new EsimAccessApiError(
        `eSIM Access response for ${path} did not match the documented schema: ${parsed.error.message}`,
        response.status,
      );
    }
    if (!parsed.data.success || !parsed.data.obj) {
      throw new EsimAccessApiError(
        `eSIM Access request to ${path} was rejected: ${
          parsed.data.errorMsg ??
          parsed.data.errorMessage ??
          'provider returned success=false'
        }`,
        response.status,
        parsed.data.errorCode,
      );
    }
    return parsed.data.obj;
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
