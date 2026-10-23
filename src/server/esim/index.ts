import { env } from '@/lib/env';
import { EsimAccessProvider } from './esim-access-provider';
import { MockEsimProvider } from './mock-provider';
import type { EsimProvider } from './types';

export function createEsimProvider(): EsimProvider {
  if (env.ESIM_PROVIDER === 'esim-access') {
    if (!env.ESIM_ACCESS_CODE) {
      throw new Error('ESIM_ACCESS_CODE is required for the live provider');
    }
    return new EsimAccessProvider(env.ESIM_ACCESS_CODE);
  }

  return new MockEsimProvider();
}

export type { EsimPackage, EsimProvider } from './types';
