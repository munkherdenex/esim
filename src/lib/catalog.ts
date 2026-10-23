export interface Country {
  slug: string;
  code: 'CN' | 'KR';
  name: string;
  englishName: string;
  tagline: string;
  description: string;
  accent: string;
  panel: string;
}

export const countries: Country[] = [
  {
    slug: 'china',
    code: 'CN',
    name: 'Хятад',
    englishName: 'China',
    tagline: 'Хилийн цаана ч холбоотой',
    description: 'БНХАУ-д аялахдаа датагаа урьдчилан бэлдээрэй.',
    accent: 'text-rose-700',
    panel: 'bg-[#fff1ed]',
  },
  {
    slug: 'south-korea',
    code: 'KR',
    name: 'Өмнөд Солонгос',
    englishName: 'South Korea',
    tagline: 'Солонгосын аялалд бэлэн',
    description: 'Хот дотор ч, аяллын замдаа ч интернеттэй байгаарай.',
    accent: 'text-sky-800',
    panel: 'bg-[#edf6f5]',
  },
];

export function getCountryBySlug(slug: string): Country | undefined {
  return countries.find((country) => country.slug === slug);
}

export function getCountryByCode(code: string): Country | undefined {
  return countries.find((country) => country.code === code);
}

export function formatPriceMnt(priceMnt: number): string {
  return `₮${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(priceMnt)}`;
}

export interface PackageValue {
  id: string;
  dataGb: number;
  validityDays: number;
  priceMnt: number;
}

export function findBestValuePackage<T extends PackageValue>(
  packageList: T[],
): string | undefined {
  return packageList.reduce<T | undefined>((best, current) => {
    if (!best) return current;
    const currentPricePerGb = current.priceMnt / current.dataGb;
    const bestPricePerGb = best.priceMnt / best.dataGb;

    if (currentPricePerGb < bestPricePerGb) return current;
    if (
      currentPricePerGb === bestPricePerGb &&
      current.validityDays > best.validityDays
    ) {
      return current;
    }
    return best;
  }, undefined)?.id;
}
