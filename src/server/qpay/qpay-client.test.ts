import { describe, expect, it, vi } from 'vitest';
import { QPayApiError, QPayClient } from './qpay-client';
import type { QPayInvoiceProfile } from './qpay-client';

const invoiceProfile: QPayInvoiceProfile = {
  invoice_code: 'merchant-invoice-code',
  sender_invoice_no: 'profile-value',
  sender_branch_code: 'branch',
  sender_branch_data: {},
  sender_staff_code: 'staff',
  sender_staff_data: {},
  sender_terminal_code: 'terminal',
  sender_terminal_data: {},
  invoice_receiver_code: 'receiver',
  invoice_receiver_data: {},
  invoice_description: '',
  enable_expiry: true,
  allow_partial: false,
  minimum_amount: 0,
  allow_exceed: false,
  maximum_amount: 100000,
  amount: 1000,
  callback_url: 'https://example.com/callback',
  allow_subscribe: false,
  subscription_interval: '',
  subscription_webhook: '',
  note: '',
  calculate_vat: false,
  tax_customer_code: '',
  line_tax_code: '',
  district_code: '',
  tax_type: '',
  lines: [],
  transactions: [],
  lottery: [],
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('QPayClient', () => {
  it('creates an invoice and checks payment using documented Merchant V2 requests', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'access-token',
          expires_in: Math.floor(Date.now() / 1000) + 3600,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          invoice_id: 'invoice-1',
          qr_text: 'qr-data',
          qr_image: 'base64-image',
          qPay_shortUrl: 'https://qpay.mn/invoice-1',
          urls: [{ name: 'Bank', link: 'bank-app://invoice-1' }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ count: 0, rows: [] }));
    const client = new QPayClient(
      { clientId: 'client', clientSecret: 'secret' },
      invoiceProfile,
      'sandbox',
      fetcher,
    );

    const invoice = await client.createInvoice({
      senderInvoiceNo: 'unique-order-number',
      description: 'Holbo order HB123',
      amountMnt: 35000,
      callbackUrl: 'https://example.com/api/qpay/callback?orderId=123',
      customerPhone: '99112233',
      orderCode: 'HB123',
    });
    const verification = await client.checkPayment(invoice.invoiceId);

    expect(invoice).toEqual({
      invoiceId: 'invoice-1',
      qrText: 'qr-data',
      qrImage: 'base64-image',
      shortUrl: 'https://qpay.mn/invoice-1',
      urls: [{ name: 'Bank', link: 'bank-app://invoice-1' }],
    });
    expect(verification).toEqual({ paid: false, transactionCount: 0 });
    expect(fetcher).toHaveBeenCalledTimes(3);

    const invoiceRequest = fetcher.mock.calls[1];
    expect(invoiceRequest[0]).toBe('https://merchant-sandbox.qpay.mn/v2/invoice');
    expect(JSON.parse(String(invoiceRequest[1]?.body))).toMatchObject({
      invoice_code: 'merchant-invoice-code',
      sender_invoice_no: 'unique-order-number',
      invoice_description: 'Holbo order HB123',
      amount: 35000,
      callback_url: 'https://example.com/api/qpay/callback?orderId=123',
    });

    const checkRequest = fetcher.mock.calls[2];
    expect(checkRequest[0]).toBe(
      'https://merchant-sandbox.qpay.mn/v2/payment/check',
    );
    expect(JSON.parse(String(checkRequest[1]?.body))).toEqual({
      object_type: 'INVOICE',
      object_id: 'invoice-1',
      offset: { page_number: 1, page_limit: 100 },
    });
  });

  it('caches a token when expires_in is a duration in seconds', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ access_token: 'access-token', expires_in: 3600 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          invoice_id: 'invoice-1',
          qr_text: '',
          qr_image: '',
          urls: [],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ count: 0, rows: [] }));
    const client = new QPayClient(
      { clientId: 'client', clientSecret: 'secret' },
      invoiceProfile,
      'sandbox',
      fetcher,
    );

    await client.createInvoice({
      senderInvoiceNo: 'unique-order-number',
      description: 'Holbo order HB123',
      amountMnt: 35000,
      callbackUrl: 'https://example.com/api/qpay/callback?orderId=123',
      customerPhone: '99112233',
      orderCode: 'HB123',
    });
    await client.checkPayment('invoice-1');

    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('fails closed when QPay returns payment rows without a confirmed row schema', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'access-token',
          expires_in: Math.floor(Date.now() / 1000) + 3600,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ count: 1, rows: [{ payment_id: 'payment-1' }] }),
      );
    const client = new QPayClient(
      { clientId: 'client', clientSecret: 'secret' },
      invoiceProfile,
      'sandbox',
      fetcher,
    );

    await expect(client.checkPayment('invoice-1')).rejects.toThrowError(
      QPayApiError,
    );
  });
});
