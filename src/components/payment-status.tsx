'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatPriceMnt } from '@/lib/catalog';
import type { QPayInvoiceLink } from '@/server/qpay/types';

type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROVISIONING'
  | 'DELIVERED'
  | 'FAILED'
  | 'EXPIRED';

interface PaymentStatusProps {
  publicCode: string;
  accessToken: string;
  initialStatus: OrderStatus;
  priceMnt: number;
  qrText: string | null;
  qrImage: string | null;
  shortUrl: string | null;
  urls: QPayInvoiceLink[];
  isMock: boolean;
}

const finishedStatuses = new Set<OrderStatus>([
  'DELIVERED',
  'FAILED',
  'EXPIRED',
]);

const statusCopy: Record<OrderStatus, { title: string; detail: string }> = {
  PENDING_PAYMENT: {
    title: 'Төлбөр хүлээж байна',
    detail: 'Төлбөрөө хийсний дараа энэ хуудас автоматаар шинэчлэгдэнэ.',
  },
  PAID: {
    title: 'Төлбөр амжилттай',
    detail: 'Таны eSIM профайлыг бэлдэж байна. Энэ хуудсыг нээлттэй үлдээнэ үү.',
  },
  PROVISIONING: {
    title: 'Таны eSIM бэлдэж байна',
    detail: 'Бэлэн болмогц захиалгын мэдээлэл шинэчлэгдэнэ.',
  },
  DELIVERED: {
    title: 'Таны eSIM бэлэн боллоо',
    detail: 'QR код болон суулгах зааврыг захиалгын хуудсаас хараарай.',
  },
  FAILED: {
    title: 'Захиалгыг шалгаж байна',
    detail: 'Төлбөр баталгаажсан. Дэмжлэгийн баг захиалгыг шалгана.',
  },
  EXPIRED: {
    title: 'Нэхэмжлэлийн хугацаа дууссан',
    detail: 'Энэ нэхэмжлэлээр төлбөр хийх боломжгүй боллоо. Шинэ захиалга үүсгэнэ үү.',
  },
};

function isSafePaymentLink(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return true;
    return (
      !['javascript:', 'data:', 'vbscript:', 'file:', 'blob:'].includes(
        url.protocol,
      ) && /^[a-z][a-z\d+.-]*:\/\/[^\s]+$/i.test(value)
    );
  } catch {
    return false;
  }
}

export function PaymentStatus({
  publicCode,
  accessToken,
  initialStatus,
  priceMnt,
  qrText,
  qrImage,
  shortUrl,
  urls,
  isMock,
}: PaymentStatusProps) {
  const [status, setStatus] = useState(initialStatus);
  const [pollError, setPollError] = useState(false);
  const [mockSubmitting, setMockSubmitting] = useState(false);
  const [mockError, setMockError] = useState<string>();

  const pollStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(publicCode)}/status?t=${encodeURIComponent(accessToken)}`,
        { cache: 'no-store' },
      );
      if (!response.ok) {
        if (response.status !== 429) {
          setPollError(true);
        }
        return;
      }
      const result: { status?: OrderStatus } = await response.json();
      if (
        result.status &&
        [
          'PENDING_PAYMENT',
          'PAID',
          'PROVISIONING',
          'DELIVERED',
          'FAILED',
          'EXPIRED',
        ].includes(result.status)
      ) {
        setStatus(result.status);
        setPollError(false);
      }
    } catch (error) {
      console.error('Order status polling failed:', error);
      setPollError(true);
    }
  }, [accessToken, publicCode]);

  useEffect(() => {
    if (finishedStatuses.has(status)) return;
    const intervalId = window.setInterval(() => void pollStatus(), 5000);
    return () => window.clearInterval(intervalId);
  }, [pollStatus, status]);

  async function confirmMockPayment() {
    setMockSubmitting(true);
    setMockError(undefined);
    try {
      const response = await fetch('/api/qpay/mock-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicCode, accessToken }),
      });
      if (!response.ok) {
        const result: { error?: string } = await response.json();
        setMockError(result.error ?? 'Төлбөр шалгах хүсэлт амжилтгүй.');
        return;
      }
      await pollStatus();
    } catch (error) {
      console.error('Mock payment request failed:', error);
      setMockError('Сүлжээний алдаа гарлаа. Дахин оролдоно уу.');
    } finally {
      setMockSubmitting(false);
    }
  }

  const copyText = async () => {
    if (!qrText) return;
    try {
      await navigator.clipboard.writeText(qrText);
    } catch (error) {
      console.error('Could not copy QPay invoice text:', error);
    }
  };

  const qrImageSource = qrImage
    ? qrImage.startsWith('data:')
      ? qrImage
      : `data:image/png;base64,${qrImage}`
    : undefined;
  const safeShortUrl = shortUrl && isSafePaymentLink(shortUrl) ? shortUrl : null;
  const copy = statusCopy[status];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[#f3f6f1] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#829087]">
              ЗАХИАЛГЫН ДУГААР
            </p>
            <p className="mt-1 font-bold">{publicCode}</p>
          </div>
          <p className="text-lg font-bold">{formatPriceMnt(priceMnt)}</p>
        </div>
      </div>

      {status === 'DELIVERED' && (
        <Link
          className="flex min-h-12 items-center justify-center rounded-full bg-[#173b33] px-5 text-sm font-bold text-white transition hover:bg-[#245748]"
          href={`/order/${encodeURIComponent(publicCode)}?t=${encodeURIComponent(accessToken)}`}
        >
          eSIM харах, суулгах заавар
        </Link>
      )}

      <div
        aria-live="polite"
        className={`rounded-2xl px-4 py-4 ${
          status === 'PENDING_PAYMENT'
            ? 'bg-[#fff8ed] text-[#785e32]'
            : status === 'EXPIRED'
              ? 'bg-[#fff0ed] text-[#a54232]'
              : 'bg-[#eef7f0] text-[#326348]'
        }`}
      >
        <p className="font-bold">{copy.title}</p>
        <p className="mt-1 text-sm leading-6">{copy.detail}</p>
        {pollError && (
          <p className="mt-2 text-xs">
            Төлөв шинэчлэхэд алдаа гарлаа. Хуудас нээлттэй байхад дахин шалгана.
          </p>
        )}
      </div>

      {status === 'PENDING_PAYMENT' && (
        <div className="space-y-4">
          {qrImageSource && (
            <div className="mx-auto grid size-56 place-items-center rounded-2xl border border-[#e5ebe3] bg-white p-3">
              {/* QPay returns the QR image as base64 data. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="QPay төлбөрийн QR код"
                className="size-full object-contain"
                src={qrImageSource}
              />
            </div>
          )}
          {safeShortUrl && (
            <a
              className="flex min-h-12 items-center justify-center rounded-full bg-[#173b33] px-5 text-sm font-bold text-white transition hover:bg-[#245748]"
              href={safeShortUrl}
              rel="noreferrer"
              target="_blank"
            >
              QPay-р төлөх
            </a>
          )}
          {urls.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-[#53665d]">
                Банкны апп-аар төлөх
              </p>
              <div className="grid grid-cols-2 gap-2">
                {urls.filter((item) => isSafePaymentLink(item.link)).map((item, index) => (
                  <a
                    key={`${item.name}-${index}`}
                    className="flex min-h-11 items-center justify-center rounded-xl border border-[#dce4db] px-3 text-sm font-semibold text-[#40564d] hover:bg-[#f6f8f3]"
                    href={item.link}
                    rel="noreferrer"
                    target="_blank"
                    title={item.description}
                  >
                    {item.name}
                  </a>
                ))}
              </div>
            </div>
          )}
          {qrText && (
            <details className="rounded-xl border border-[#e5ebe3] px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-[#53665d]">
                QR уншуулах боломжгүй бол
              </summary>
              <p className="mt-3 break-all text-xs leading-5 text-[#718078]">
                {qrText}
              </p>
              <button
                className="mt-2 text-sm font-bold text-[#326348]"
                onClick={() => void copyText()}
                type="button"
              >
                QR мэдээлэл хуулах
              </button>
            </details>
          )}
          {isMock && (
            <div className="border-t border-dashed border-[#dce4db] pt-4">
              <p className="mb-3 text-xs text-[#829087]">
                Хөгжүүлэлтийн горим: mock төлбөрийг баталгаажуулах
              </p>
              <button
                className="min-h-11 w-full rounded-full border border-[#6b8c77] px-5 text-sm font-bold text-[#326348] hover:bg-[#eef7f0] disabled:opacity-60"
                disabled={mockSubmitting}
                onClick={() => void confirmMockPayment()}
                type="button"
              >
                {mockSubmitting ? 'Шалгаж байна…' : 'Mock төлбөр баталгаажуулах'}
              </button>
              {mockError && (
                <p role="alert" className="mt-2 text-sm text-[#a54232]">
                  {mockError}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
