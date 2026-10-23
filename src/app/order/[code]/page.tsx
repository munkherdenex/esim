import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { EsimActivationCode } from '@/components/esim-activation-code';
import { OrderStatusRefresh } from '@/components/order-status-refresh';
import { ShopHeader } from '@/components/shop-header';
import { db } from '@/db';
import { orders, packages } from '@/db/schema';
import { getCountryByCode } from '@/lib/catalog';
import { env } from '@/lib/env';
import { matchesAccessToken } from '@/server/orders/token';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Миний eSIM | Holbo',
  robots: { index: false, follow: false },
};

function statusLabel(status: string): string {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'Төлбөр хүлээж байна';
    case 'PAID':
      return 'Төлбөр амжилттай';
    case 'PROVISIONING':
      return 'Таны eSIM бэлдэж байна';
    case 'FAILED':
      return 'Захиалгыг шалгаж байна';
    case 'EXPIRED':
      return 'Нэхэмжлэлийн хугацаа дууссан';
    case 'DELIVERED':
      return 'Таны eSIM бэлэн боллоо';
    default:
      return 'Захиалгын төлөв';
  }
}

function isSafeQrUrl(value: string): boolean {
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export default async function OrderPage({
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
      iccid: orders.iccid,
      activationCode: orders.lpaActivationCode,
      qrUrl: orders.qrUrl,
      countryCode: packages.countryCode,
      dataGb: packages.dataGb,
      validityDays: packages.validityDays,
    })
    .from(orders)
    .innerJoin(packages, eq(orders.packageId, packages.id))
    .where(eq(orders.publicCode, code))
    .limit(1);

  if (!order || !matchesAccessToken(accessToken, order.accessTokenHash)) {
    notFound();
  }

  const country = getCountryByCode(order.countryCode);
  const profileIsReady =
    order.status === 'DELIVERED' &&
    Boolean(order.activationCode) &&
    Boolean(order.qrUrl);

  return (
    <main className="min-h-screen bg-[#fbfcf8] text-[#173b33]">
      <ShopHeader />
      <section className="mx-auto max-w-3xl px-5 pb-16 pt-8 sm:px-8 sm:pb-24 sm:pt-12">
        <OrderStatusRefresh status={order.status} />
        <Link
          href={`/payment/${encodeURIComponent(order.publicCode)}?t=${encodeURIComponent(accessToken)}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#718078] hover:text-[#173b33]"
        >
          ← Захиалгын төлөв рүү буцах
        </Link>
        <div className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6b8c77]">
            МИНИЙ ESIM
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.05em] sm:text-4xl">
            {country?.name ?? 'Таны'} eSIM
          </h1>
          <p className="mt-2 text-sm text-[#718078]">
            {order.dataGb} GB · {order.validityDays} хоног · {order.publicCode}
          </p>
        </div>

        {profileIsReady && order.activationCode && order.qrUrl ? (
          <div className="mt-7 space-y-5">
            <div className="rounded-2xl bg-[#eef7f0] p-4 text-sm font-bold text-[#326348]">
              Таны eSIM бэлэн боллоо. QR код эсвэл LPA кодоор суулгаарай.
            </div>
            {env.ESIM_PROVIDER === 'mock' && (
              <p className="rounded-xl bg-[#fff8ed] px-4 py-3 text-xs leading-5 text-[#785e32]">
                Хөгжүүлэлтийн mock профайл: бодит операторт холбогдохгүй, идэвхжүүлэх боломжгүй.
              </p>
            )}
            {isSafeQrUrl(order.qrUrl) ? (
              <div className="rounded-2xl border border-[#e4eae1] bg-white p-5 text-center">
                <p className="mb-4 text-sm font-bold">eSIM QR код</p>
                {/* eSIM Access supplies an HTTPS QR image URL; the mock uses a same-origin SVG. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="Таны eSIM QR код"
                  className="mx-auto size-56 rounded-xl object-contain"
                  src={order.qrUrl}
                />
              </div>
            ) : (
              <p role="alert" className="text-sm text-[#a54232]">
                QR кодыг аюулгүй харуулах боломжгүй байна. LPA кодыг ашиглана уу.
              </p>
            )}
            <EsimActivationCode code={order.activationCode} />
            {order.iccid && (
              <p className="text-xs text-[#718078]">ICCID: {order.iccid}</p>
            )}
            <div className="rounded-2xl border border-[#e4eae1] bg-white p-4 sm:p-5">
              <h2 className="font-bold">iPhone дээр суулгах</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-[#5c6e63]">
                <li>Тохиргоо → Үүрэн холбоо → eSIM нэмэх хэсгийг нээнэ.</li>
                <li>QR кодыг уншуулж, дэлгэц дээрх зааврыг дагана.</li>
                <li>QR уншуулах боломжгүй бол LPA кодыг гараар оруулна.</li>
              </ol>
              <h2 className="mt-6 font-bold">Android дээр суулгах</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-[#5c6e63]">
                <li>Тохиргоо → Сүлжээ ба интернет → SIM → eSIM нэмэх хэсгийг нээнэ.</li>
                <li>QR код уншуулж, операторын зааврыг дагана.</li>
                <li>Цэсний нэр утасны загвараас хамааран өөр байж болно.</li>
              </ol>
            </div>
            <p className="rounded-2xl bg-[#fff8ed] px-4 py-4 text-sm font-bold text-[#785e32]">
              Нислэгээс өмнө гэртээ суулгаарай.
            </p>
          </div>
        ) : (
          <div
            aria-live="polite"
            className="mt-7 rounded-2xl bg-[#fff8ed] p-5 text-[#785e32]"
          >
            <p className="font-bold">{statusLabel(order.status)}</p>
            <p className="mt-2 text-sm leading-6">
              eSIM бэлэн болмогц энэ хуудсанд QR код болон суулгах заавар гарна.
              Та энэ холбоосыг хадгалаарай.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
