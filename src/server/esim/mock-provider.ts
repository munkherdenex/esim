import type { EsimPackage, EsimProfile, EsimProvider } from './types';

const packages: EsimPackage[] = [
  {
    providerPackageCode: 'MOCK-CN-1GB-7D',
    providerName: 'China 1GB 7Days',
    countryCode: 'CN',
    dataGb: 1,
    validityDays: 7,
    costUsd: 1.25,
  },
  {
    providerPackageCode: 'MOCK-CN-5GB-30D',
    providerName: 'China 5GB 30Days',
    countryCode: 'CN',
    dataGb: 5,
    validityDays: 30,
    costUsd: 4.5,
  },
  {
    providerPackageCode: 'MOCK-KR-3GB-15D',
    providerName: 'South Korea 3GB 15Days',
    countryCode: 'KR',
    dataGb: 3,
    validityDays: 15,
    costUsd: 2.75,
  },
];

export class MockEsimProvider implements EsimProvider {
  async listPackages(): Promise<EsimPackage[]> {
    return packages.map((item) => ({ ...item }));
  }

  async orderProfile(input: {
    transactionId: string;
    packageCode: string;
  }): Promise<{ orderNo: string }> {
    return {
      orderNo: `MOCK-${input.transactionId}`,
    };
  }

  async queryProfiles(orderNo: string): Promise<EsimProfile[]> {
    const transactionId = orderNo.replace(/^MOCK-/, '');
    return [
      {
        orderNo,
        transactionId,
        esimTranNo: `MOCK-TRAN-${transactionId}`,
        iccid: `MOCK-${transactionId}`,
        activationCode: 'LPA:1$mock.invalid$MOCK-NOT-INSTALLABLE',
        qrCodeUrl: '/mock-esim-qr.svg',
        smdpStatus: 'RELEASED',
        esimStatus: 'GOT_RESOURCE',
      },
    ];
  }

  async setWebhook(): Promise<void> {
    throw new Error('Webhook registration is unavailable with the mock provider');
  }
}
