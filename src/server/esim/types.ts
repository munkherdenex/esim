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
}
