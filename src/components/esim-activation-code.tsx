'use client';

import { useState } from 'react';

export function EsimActivationCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setError(undefined);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (copyError) {
      console.error('Could not copy eSIM activation code:', copyError);
      setError('Кодыг хуулж чадсангүй. Гараар сонгон хуулна уу.');
    }
  }

  return (
    <div className="rounded-2xl border border-[#e4eae1] bg-white p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#829087]">
        LPA ИДЭВХЖҮҮЛЭХ КОД
      </p>
      <p className="mt-3 break-all rounded-xl bg-[#f3f6f1] p-3 font-mono text-sm leading-6 text-[#173b33]">
        {code}
      </p>
      <button
        className="mt-3 min-h-10 rounded-full border border-[#6b8c77] px-4 text-sm font-bold text-[#326348] hover:bg-[#eef7f0]"
        onClick={() => void copyCode()}
        type="button"
      >
        {copied ? 'Хуулагдлаа' : 'Код хуулах'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-[#a54232]">
          {error}
        </p>
      )}
    </div>
  );
}
