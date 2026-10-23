import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { ShopHeader } from '@/components/shop-header';
import { PaymentStatus } from '@/components/payment-status';
import { db } from '@/db';
import { orders, packages } from '@/db/schema';
import { env } from '@/lib/env';
import { matchesAccessToken } from '@/server/orders/token';

export const dynamic = 'force-dynamic';

export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const [{ code }, { t: accessToken }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!accessToken || !/^[a-f0-9]{64}$/i.test(accessToken)) notFound();

  const [order] = await db
    .select({
      publicCode: orders.publicCode,
      accessTokenHash: orders.accessTokenHash,
      status: orders.status,
      priceMnt: orders.priceMnt,
      qpayQrText: orders.qpayQrText,
      qpayQrImage: orders.qpayQrImage,
      qpayShortUrl: orders.qpayShortUrl,
      qpayUrls: orders.qpayUrls,
    })
    .from(orders)
    .innerJoin(packages, eq(orders.packageId, packages.id))
    .where(eq(orders.publicCode, code))
    .limit(1);

  if (
    !order ||
    !matchesAccessToken(accessToken, order.accessTokenHash)
  ) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#fbfcf8] text-[#173b33]">
      <ShopHeader />
      <section className="mx-auto max-w-xl px-5 pb-16 pt-8 sm:px-8 sm:pb-24 sm:pt-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#718078] hover:text-[#173b33]"
        >
          ← Нүүр хуудас
        </Link>
        <div className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6b8c77]">
            QPAY ТӨЛБӨР
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.05em]">
            Захиалгын төлбөр
          </h1>
        </div>
        <div className="mt-6 rounded-[26px] border border-[#e4eae1] bg-white p-5 shadow-[0_18px_55px_-42px_rgba(22,52,43,0.4)] sm:p-7">
          <PaymentStatus
            accessToken={accessToken}
            initialStatus={order.status}
            isMock={env.QPAY_PROVIDER === 'mock'}
            priceMnt={order.priceMnt}
            publicCode={order.publicCode}
            qrImage={order.qpayQrImage}
            qrText={order.qpayQrText}
            shortUrl={order.qpayShortUrl}
            urls={order.qpayUrls ?? []}
          />
        </div>
        <p className="mt-5 text-center text-xs leading-5 text-[#87938b]">
          Төлбөр төлөхөд асуудал гарвал захиалгын дугаараа хадгалж, дэмжлэгтэй
          холбогдоно уу.
        </p>
      </section>
    </main>
  );
}
