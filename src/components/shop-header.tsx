import Link from 'next/link';

export function ShopHeader() {
  return (
    <header className="border-b border-[#e6e9e2] bg-[#fbfcf8]">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          aria-label="Holbo нүүр хуудас"
          className="inline-flex items-center gap-2.5"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-[#143b32] text-lg font-bold text-white">
            h
          </span>
          <span className="text-[21px] font-bold tracking-[-0.06em] text-[#173b33]">
            holbo<span className="text-[#ef8b57]">.</span>
          </span>
        </Link>
        <Link
          href="/"
          className="rounded-full border border-[#dfe5dc] px-4 py-2 text-sm font-semibold text-[#40564d] transition hover:border-[#173b33] hover:text-[#173b33]"
        >
          Улс сонгох
        </Link>
      </div>
    </header>
  );
}
