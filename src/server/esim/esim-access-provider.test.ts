import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { EsimAccessApiError, EsimAccessProvider } from './esim-access-provider';

describe('EsimAccessProvider', () => {
  it('uses the documented package endpoint and maps provider fields', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          success: true,
          errorCode: '0',
          errorMsg: null,
          obj: {
            packageList: [
              {
                packageCode: 'CN-1GB-7D',
                name: 'China 1GB 7Days',
                price: 12_500,
                currencyCode: 'USD',
                volume: 1_073_741_824,
                duration: 7,
                durationUnit: 'DAY',
                location: 'CN',
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );
    const provider = new EsimAccessProvider(
      'test-access-code',
      'test-secret',
      fetcher,
    );

    await expect(provider.listPackages()).resolves.toEqual([
      {
        providerPackageCode: 'CN-1GB-7D',
        providerName: 'China 1GB 7Days',
        countryCode: 'CN',
        dataGb: 1,
        validityDays: 7,
        costUsd: 1.25,
      },
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.esimaccess.com/api/v1/open/package/list',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'RT-AccessCode': 'test-access-code',
        }),
        body: JSON.stringify({ type: 'BASE' }),
      }),
    );
    const request = fetcher.mock.calls[0];
    const headers = new Headers(request?.[1]?.headers);
    const requestBody = String(request?.[1]?.body);
    const timestamp = headers.get('RT-Timestamp');
    const requestId = headers.get('RT-RequestID');
    expect(timestamp).toMatch(/^\d+$/);
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(headers.get('RT-Signature')).toBe(
      createHmac('sha256', 'test-secret')
        .update(
          `${timestamp}${requestId}test-access-code${requestBody}`,
        )
        .digest('hex'),
    );
  });

  it('rejects package fields outside the documented schema', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          success: true,
          obj: {
            packageList: [
              {
                packageCode: 'CN-1GB-7D',
                name: 'China 1GB 7Days',
                price: 12_500,
                currencyCode: 'USD',
                volume: 1_073_741_824,
                duration: 7,
                durationUnit: 'MONTH',
                location: 'CN',
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );
    const provider = new EsimAccessProvider(
      'test-access-code',
      'test-secret',
      fetcher,
    );

    await expect(provider.listPackages()).rejects.toBeInstanceOf(
      EsimAccessApiError,
    );
  });

  it('orders with a stable transactionId and queries allocated profile details', async () => {
    const transactionId = 'ec3eddbc-8ec5-46cb-8325-5bb9a1dd87ca';
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            errorCode: null,
            errorMsg: null,
            obj: { orderNo: 'B23051616050537', transactionId },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            errorCode: '0',
            errorMsg: null,
            obj: {
              esimList: [
                {
                  orderNo: 'B23051616050537',
                  transactionId,
                  esimTranNo: '23120118156818',
                  iccid: '8943108170000775671',
                  ac: 'LPA:1$rsp.example.com$secret',
                  qrCodeUrl: 'https://p.qrsim.net/profile.png',
                  smdpStatus: 'RELEASED',
                  esimStatus: 'GOT_RESOURCE',
                },
              ],
              pager: { pageSize: 20, pageNum: 1, total: 1 },
            },
          }),
          { status: 200 },
        ),
      );
    const provider = new EsimAccessProvider(
      'test-access-code',
      'test-secret',
      fetcher,
    );

    await expect(
      provider.orderProfile({
        transactionId,
        packageCode: 'CN-1GB-7D',
      }),
    ).resolves.toEqual({ orderNo: 'B23051616050537' });
    await expect(provider.queryProfiles('B23051616050537')).resolves.toEqual([
      {
        orderNo: 'B23051616050537',
        transactionId,
        esimTranNo: '23120118156818',
        iccid: '8943108170000775671',
        activationCode: 'LPA:1$rsp.example.com$secret',
        qrCodeUrl: 'https://p.qrsim.net/profile.png',
        smdpStatus: 'RELEASED',
        esimStatus: 'GOT_RESOURCE',
      },
    ]);

    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://api.esimaccess.com/api/v1/open/esim/order',
    );
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      transactionId,
      packageInfoList: [{ packageCode: 'CN-1GB-7D', count: 1 }],
    });
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      'https://api.esimaccess.com/api/v1/open/esim/query',
    );
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      orderNo: 'B23051616050537',
      iccid: '',
      pager: { pageNum: 1, pageSize: 50 },
    });
  });

  it('registers a webhook using the documented endpoint and body', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          success: true,
          errorCode: '0',
          errorMsg: null,
          obj: {},
        }),
        { status: 200 },
      ),
    );
    const provider = new EsimAccessProvider(
      'test-access-code',
      'test-secret',
      fetcher,
    );

    await expect(
      provider.setWebhook(
        'https://holbo.example/api/webhooks/esim?secret=secret-value',
      ),
    ).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.esimaccess.com/api/v1/open/webhook/save',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          webhook: 'https://holbo.example/api/webhooks/esim?secret=secret-value',
        }),
      }),
    );
  });
});
