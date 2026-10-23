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
    const provider = new EsimAccessProvider('test-access-code', fetcher);

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
    const provider = new EsimAccessProvider('test-access-code', fetcher);

    await expect(provider.listPackages()).rejects.toBeInstanceOf(
      EsimAccessApiError,
    );
  });
});
