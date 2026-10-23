export interface EsimPackage {
  providerPackageCode: string;
  providerName: string;
  countryCode: string;
  dataGb: number;
  validityDays: number;
  costUsd: number;
}

export interface EsimProvider {
  listPackages(): Promise<EsimPackage[]>;
  orderProfile(input: {
    transactionId: string;
    packageCode: string;
  }): Promise<{ orderNo: string }>;
  queryProfiles(orderNo: string): Promise<EsimProfile[]>;
  setWebhook(webhookUrl: string): Promise<void>;
}

export interface EsimProfile {
  orderNo: string;
  transactionId?: string;
  esimTranNo: string;
  iccid: string;
  activationCode: string;
  qrCodeUrl: string;
  smdpStatus: string;
  esimStatus: string;
}
