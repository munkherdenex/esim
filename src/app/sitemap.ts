import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { countries } from '@/lib/catalog';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: new URL('/', env.APP_URL).toString(),
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...countries.map((country) => ({
      url: new URL(`/${country.slug}`, env.APP_URL).toString(),
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
