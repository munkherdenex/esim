'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { formatPriceMnt } from '@/lib/catalog';

interface CheckoutFormProps {
  packageId: string;
  priceMnt: number;
}

function createIdempotencyKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function CheckoutForm({ packageId, priceMnt }: CheckoutFormProps) {
  const router = useRouter();
  const idempotencyKey = useRef<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [compatibilityConfirmed, setCompatibilityConfirmed] = useState(false);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(undefined);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId,
          customerPhone,
          customerEmail,
          compatibilityConfirmed,
          idempotencyKey: (idempotencyKey.current ??= createIdempotencyKey()),
        }),
      });
      const result: { paymentUrl?: string; error?: string } =
        await response.json();
      if (!response.ok || !result.paymentUrl) {
        setError(result.error ?? 'Захиалга үүсгэж чадсангүй.');
        return;
      }
      router.push(result.paymentUrl);
    } catch (requestError) {
      console.error('Checkout submission failed:', requestError);
      setError('Сүлжээний алдаа гарлаа. Дахин оролдоно уу.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[#40564d]">
          Утасны дугаар <span className="text-[#bd583f]">*</span>
        </span>
        <input
          autoComplete="tel"
          inputMode="tel"
          maxLength={30}
          minLength={8}
          name="customerPhone"
          onChange={(event) => setCustomerPhone(event.target.value)}
          placeholder="Жишээ: 9911 2233"
          required
          type="tel"
          value={customerPhone}
          className="min-h-12 w-full rounded-xl border border-[#dce4db] bg-white px-4 text-base text-[#173b33] outline-none transition placeholder:text-[#a0aaa2] focus:border-[#6d9b7d] focus:ring-2 focus:ring-[#6d9b7d]/15"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[#40564d]">
          И-мэйл <span className="font-normal text-[#8a968d]">(заавал биш)</span>
        </span>
        <input
          autoComplete="email"
          maxLength={254}
          name="customerEmail"
          onChange={(event) => setCustomerEmail(event.target.value)}
          placeholder="name@example.com"
          type="email"
          value={customerEmail}
          className="min-h-12 w-full rounded-xl border border-[#dce4db] bg-white px-4 text-base text-[#173b33] outline-none transition placeholder:text-[#a0aaa2] focus:border-[#6d9b7d] focus:ring-2 focus:ring-[#6d9b7d]/15"
        />
      </label>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#e5ebe3] bg-[#fbfcf8] p-4">
        <input
          checked={compatibilityConfirmed}
          className="mt-0.5 size-5 shrink-0 accent-[#173b33]"
          onChange={(event) => setCompatibilityConfirmed(event.target.checked)}
          required
          type="checkbox"
        />
        <span className="text-sm leading-6 text-[#53665d]">
          Миний утас eSIM дэмждэг болохыг шалгасан.
          <span className="mt-1 block text-xs leading-5 text-[#7c8980]">
            iPhone XS болон түүнээс хойших (эх газрын Хятадын загвараас бусад),
            мөн eSIM дэмждэг Samsung, Pixel загварууд.
          </span>
        </span>
      </label>

      <p className="rounded-xl bg-[#fff8ed] px-4 py-3 text-xs leading-5 text-[#785e32]">
        Буцаалтын нөхцөл: eSIM суулгасны дараа буцаан олголт хийх боломжгүй.
      </p>

      {error && (
        <p role="alert" className="rounded-xl bg-[#fff0ed] px-4 py-3 text-sm text-[#a54232]">
          {error}
        </p>
      )}

      <button
        className="flex min-h-12 w-full items-center justify-center rounded-full bg-[#173b33] px-5 text-sm font-bold text-white transition hover:bg-[#245748] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!compatibilityConfirmed || submitting}
        type="submit"
      >
        {submitting
          ? 'Нэхэмжлэл үүсгэж байна…'
          : `${formatPriceMnt(priceMnt)} төлөх`}
      </button>
    </form>
  );
}
