import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PackageCard } from '@/components/package-card';
import { ShopHeader } from '@/components/shop-header';
import { CountryFlag } from '@/components/country-flag';
import {
  countries,
  findBestValuePackage,
  getCountryBySlug,
} from '@/lib/catalog';
import { getActivePackages } from '@/server/packages/get-active-packages';

export const dynamic = 'force-dynamic';

interface CountryPageProps {
  params: Promise<{ country: string }>;
}

export function generateStaticParams() {
  return countries.map(({ slug }) => ({ country: slug }));
}

export async function generateMetadata({
  params,
}: CountryPageProps): Promise<Metadata> {
  const { country: slug } = await params;
  const country = getCountryBySlug(slug);

  if (!country) {
    return { title: 'Улс олдсонгүй | Holbo' };
  }

  return {
    title: `${country.name} eSIM багц | Holbo`,
    description: `${country.name} руу аялахдаа ашиглах eSIM дата багцуудаа сонгоорой.`,
    openGraph: {
      title: `${country.name} eSIM багц | Holbo`,
      description: `${country.name} руу аялахдаа датагаа урьдчилан бэлдээрэй.`,
      locale: 'mn_MN',
      type: 'website',
    },
  };
}

export default async function CountryPage({ params }: CountryPageProps) {
  const { country: slug } = await params;
  const country = getCountryBySlug(slug);
  if (!country) notFound();

  const availablePackages = await getActivePackages(country.code);
  const bestValuePackageId = findBestValuePackage(availablePackages);

  return (
    <main className="min-h-screen bg-[#fbfcf8] text-[#173b33]">
      <ShopHeader />
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pb-24 sm:pt-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#718078] transition hover:text-[#173b33]"
        >
          <span aria-hidden="true">←</span>
          Улс сонгох
        </Link>

        <div className="mt-8 flex items-start gap-4 sm:mt-10 sm:gap-6">
          <span className="grid size-16 shrink-0 place-items-center rounded-[22px] bg-white shadow-[0_6px_24px_-18px_rgba(22,52,43,0.5)] sm:size-20">
            <CountryFlag code={country.code} className="h-8 w-12 sm:h-10 sm:w-[60px]" />
          </span>
          <div className="pt-1">
            <p className="text-sm font-semibold text-[#6b8c77]">
              {country.tagline}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-[-0.05em] sm:text-5xl">
              {country.name} eSIM
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#6b7a71] sm:text-base sm:leading-7">
              {country.description} Өөрт тохирох дата хэмжээ, хугацаагаа сонгоорой.
            </p>
          </div>
        </div>

        <div className="mt-10 sm:mt-14">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8b9a8f]">
                ТАНД ТОХИРОХ БАГЦ
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-[-0.03em] sm:text-2xl">
                Дата багцууд
              </h2>
            </div>
            {availablePackages.length > 0 && (
              <span className="pb-1 text-xs font-medium text-[#829087] sm:text-sm">
                {availablePackages.length} багц
              </span>
            )}
          </div>

          {availablePackages.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {availablePackages.map((item) => (
                <PackageCard
                  key={item.id}
                  dataGb={item.dataGb}
                  validityDays={item.validityDays}
                  priceMnt={item.priceMnt}
                  supportsChinaSocialApps={
                    country.code === 'CN' && item.supportsChinaSocialApps
                  }
                  bestValue={item.id === bestValuePackageId}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-[#cfd9d0] bg-white px-6 py-12 text-center sm:py-16">
              <span
                aria-hidden="true"
                className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#edf4ef] text-2xl"
              >
                ✦
              </span>
              <h3 className="mt-4 text-lg font-bold">
                Багцуудыг удахгүй нэмнэ
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#748279]">
                Энэ чиглэлийн багцууд одоогоор худалдаанд гараагүй байна.
                Бусад улсыг сонирхож үзээрэй.
              </p>
              <Link
                href="/"
                className="mt-5 inline-flex rounded-full bg-[#173b33] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#245748]"
              >
                Бусад улс үзэх
              </Link>
            </div>
          )}
        </div>

        {country.code === 'CN' && (
          <p className="mt-6 rounded-2xl bg-[#f2f5ef] px-4 py-3 text-xs leading-5 text-[#68796e]">
            Google, Facebook, Instagram ашиглах боломж нь багцаас хамаарна.
            Дэмждэг багцыг тусгайлан тэмдэглэсэн.
          </p>
        )}
      </section>
    </main>
  );
}
