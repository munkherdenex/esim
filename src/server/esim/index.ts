import { env } from '@/lib/env';
import { EsimAccessProvider } from './esim-access-provider';
import { MockEsimProvider } from './mock-provider';
import type { EsimProvider } from './types';

export function createEsimProvider(): EsimProvider {
  if (env.ESIM_PROVIDER === 'esim-access') {
    if (!env.ESIM_ACCESS_CODE || !env.ESIM_ACCESS_SECRET) {
      throw new Error(
        'ESIM_ACCESS_CODE and ESIM_ACCESS_SECRET are required for the live provider',
      );
    }
    return new EsimAccessProvider(
      env.ESIM_ACCESS_CODE,
      env.ESIM_ACCESS_SECRET,
    );
  }

  return new MockEsimProvider();
}

export type { EsimPackage, EsimProvider } from './types';
