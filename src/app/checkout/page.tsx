import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckoutForm } from '@/components/checkout-form';
import { ShopHeader } from '@/components/shop-header';
import { formatPriceMnt } from '@/lib/catalog';
import { getCheckoutPackage } from '@/server/packages/get-checkout-package';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ packageId?: string }>;
}) {
  const { packageId } = await searchParams;
  if (!packageId) notFound();

  const item = await getCheckoutPackage(packageId);
  if (!item) notFound();

  return (
    <main className="min-h-screen bg-[#fbfcf8] text-[#173b33]">
      <ShopHeader />
      <section className="mx-auto max-w-5xl px-5 pb-16 pt-8 sm:px-8 sm:pb-24 sm:pt-12">
        <Link
          href={`/${item.country.slug}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#718078] hover:text-[#173b33]"
        >
          ← Багц руу буцах
        </Link>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:gap-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6b8c77]">
              ТӨЛБӨР ТӨЛӨХ
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.05em] sm:text-4xl">
              Захиалгаа баталгаажуулна уу
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#6b7a71]">
              Төлбөрийн холбоос болон захиалгын мэдээллийг утасны дугаартай
              холбох тул дугаараа зөв оруулна уу.
            </p>
            <div className="mt-8 rounded-2xl border border-[#e4eae1] bg-white p-5 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#829087]">
                СОНГОСОН БАГЦ
              </p>
              <div className="mt-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-bold">
                    {item.country.name} · {item.dataGb} GB
                  </p>
                  <p className="mt-1 text-sm text-[#76847b]">
                    {item.validityDays} хоногийн хүчинтэй
                  </p>
                </div>
                <p className="shrink-0 text-xl font-bold">
                  {formatPriceMnt(item.priceMnt)}
                </p>
              </div>
              {item.country.code === 'CN' &&
                item.supportsChinaSocialApps && (
                  <p className="mt-4 rounded-xl bg-[#eef7f0] px-3 py-2 text-xs leading-5 text-[#326348]">
                    Энэ багц Google, Facebook, Instagram ашиглахыг дэмждэг.
                  </p>
                )}
            </div>
          </div>
          <div className="rounded-[26px] border border-[#e4eae1] bg-white p-5 shadow-[0_18px_55px_-42px_rgba(22,52,43,0.4)] sm:p-7">
            <h2 className="mb-5 text-lg font-bold">Холбоо барих мэдээлэл</h2>
            <CheckoutForm packageId={item.id} priceMnt={item.priceMnt} />
          </div>
        </div>
      </section>
    </main>
  );
}
