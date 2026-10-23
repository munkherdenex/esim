import { z } from 'zod';
import type {
  CreateInvoiceInput,
  CreatedInvoice,
  PaymentProvider,
  PaymentVerification,
} from './types';

const invoiceProfileSchema = z
  .object({
    invoice_code: z.string().min(1),
    sender_invoice_no: z.string().min(1),
    sender_branch_code: z.string().min(1),
    sender_branch_data: z.record(z.string(), z.unknown()),
    sender_staff_code: z.string().min(1),
    sender_staff_data: z.record(z.string(), z.unknown()),
    sender_terminal_code: z.string().min(1),
    sender_terminal_data: z.record(z.string(), z.unknown()),
    invoice_receiver_code: z.string().min(1),
    invoice_receiver_data: z.record(z.string(), z.unknown()),
    invoice_description: z.string(),
    enable_expiry: z.literal(true),
    allow_partial: z.literal(false),
    minimum_amount: z.number().nonnegative(),
    allow_exceed: z.literal(false),
    maximum_amount: z.number().positive(),
    amount: z.number().positive(),
    callback_url: z.string().url(),
    allow_subscribe: z.literal(false),
    subscription_interval: z.string(),
    subscription_webhook: z.string(),
    note: z.string(),
    calculate_vat: z.boolean(),
    tax_customer_code: z.string(),
    line_tax_code: z.string(),
    district_code: z.string(),
    tax_type: z.string(),
    lines: z.array(z.unknown()),
    transactions: z.array(z.unknown()),
    lottery: z.array(z.unknown()),
  })
  .passthrough();

export type QPayInvoiceProfile = z.infer<typeof invoiceProfileSchema>;

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
});

const invoiceResponseSchema = z.object({
  invoice_id: z.string().min(1),
  qr_text: z.string(),
  qr_image: z.string(),
  qPay_shortUrl: z.string().url().optional(),
  urls: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        logo: z.string().optional(),
        link: z.string().min(1),
      }),
    )
    .default([]),
});

const paymentCheckResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  rows: z.array(z.record(z.string(), z.unknown())),
});

type RequestOptions = {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
};

export class QPayApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'QPayApiError';
  }
}

export class QPayClient implements PaymentProvider {
  private accessToken: string | undefined;
  private accessTokenExpiresAt = 0;
  private tokenRequest: Promise<string> | undefined;
  private readonly baseUrl: string;

  constructor(
    private readonly credentials: {
      clientId: string;
      clientSecret: string;
    },
    private readonly invoiceProfile: QPayInvoiceProfile,
    environment: 'sandbox' | 'production',
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.baseUrl =
      environment === 'sandbox'
        ? 'https://merchant-sandbox.qpay.mn'
        : 'https://merchant.qpay.mn';
  }

  static parseInvoiceProfile(rawProfile: string): QPayInvoiceProfile {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawProfile);
    } catch (error) {
      throw new Error(
        `QPAY_INVOICE_PROFILE_JSON is not valid JSON: ${
          error instanceof Error ? error.message : 'unknown parse error'
        }`,
      );
    }
    return invoiceProfileSchema.parse(parsed);
  }

  async createInvoice(input: CreateInvoiceInput): Promise<CreatedInvoice> {
    const invoiceBody = {
      ...this.invoiceProfile,
      sender_invoice_no: input.senderInvoiceNo,
      invoice_description: input.description,
      amount: input.amountMnt,
      callback_url: input.callbackUrl,
    };

    const result = await this.request({
      method: 'POST',
      path: '/v2/invoice',
      body: invoiceBody,
    });
    const parsed = invoiceResponseSchema.safeParse(result);
    if (!parsed.success) {
      throw new QPayApiError(
        `QPay invoice response did not match the documented schema: ${parsed.error.message}`,
      );
    }

    return {
      invoiceId: parsed.data.invoice_id,
      qrText: parsed.data.qr_text,
      qrImage: parsed.data.qr_image,
      shortUrl: parsed.data.qPay_shortUrl,
      urls: parsed.data.urls,
    };
  }

  async checkPayment(invoiceId: string): Promise<PaymentVerification> {
    const result = await this.request({
      method: 'POST',
      path: '/v2/payment/check',
      body: {
        object_type: 'INVOICE',
        object_id: invoiceId,
        offset: {
          page_number: 1,
          page_limit: 100,
        },
      },
    });
    const parsed = paymentCheckResponseSchema.safeParse(result);
    if (!parsed.success) {
      throw new QPayApiError(
        `QPay payment-check response did not match the documented schema: ${parsed.error.message}`,
      );
    }

    if (parsed.data.count === 0 && parsed.data.rows.length === 0) {
      return { paid: false, transactionCount: 0 };
    }

    throw new QPayApiError(
      'QPay returned payment-check rows, but the official positive-payment response schema has not been confirmed; refusing to mark the order paid',
    );
  }

  private async request({ method, path, body }: RequestOptions): Promise<unknown> {
    const accessToken = await this.getAccessToken();
    let response = await this.sendRequest(method, path, body, accessToken);
    if (response.status === 401) {
      this.accessToken = undefined;
      this.accessTokenExpiresAt = 0;
      response = await this.sendRequest(
        method,
        path,
        body,
        await this.getAccessToken(),
      );
    }

    if (!response.ok) {
      throw new QPayApiError(
        `QPay request to ${path} failed with HTTP ${response.status}`,
        response.status,
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new QPayApiError(
        `QPay returned invalid JSON for ${path}: ${
          error instanceof Error ? error.message : 'unknown parse error'
        }`,
        response.status,
      );
    }
  }

  private async sendRequest(
    method: RequestOptions['method'],
    path: string,
    body: unknown,
    accessToken: string,
  ): Promise<Response> {
    return this.fetcher(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15_000),
    });
  }

  private async getAccessToken(): Promise<string> {
    if (
      this.accessToken &&
      Date.now() < this.accessTokenExpiresAt - 30_000
    ) {
      return this.accessToken;
    }

    if (!this.tokenRequest) {
      this.tokenRequest = this.fetchAccessToken();
    }

    try {
      return await this.tokenRequest;
    } finally {
      this.tokenRequest = undefined;
    }
  }

  private async fetchAccessToken(): Promise<string> {
    const response = await this.fetcher(`${this.baseUrl}/v2/auth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${this.credentials.clientId}:${this.credentials.clientSecret}`,
        ).toString('base64')}`,
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new QPayApiError(
        `QPay token request failed with HTTP ${response.status}`,
        response.status,
      );
    }

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch (error) {
      throw new QPayApiError(
        `QPay token response was invalid JSON: ${
          error instanceof Error ? error.message : 'unknown parse error'
        }`,
        response.status,
      );
    }

    const parsed = tokenResponseSchema.safeParse(responseBody);
    if (!parsed.success) {
      throw new QPayApiError(
        `QPay token response did not match the documented schema: ${parsed.error.message}`,
        response.status,
      );
    }

    this.accessToken = parsed.data.access_token;
    const nowInSeconds = Date.now() / 1000;
    this.accessTokenExpiresAt =
      parsed.data.expires_in > nowInSeconds
        ? parsed.data.expires_in * 1000
        : Date.now() + parsed.data.expires_in * 1000;
    return this.accessToken;
  }
}
