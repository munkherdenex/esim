import Link from 'next/link';
import type { Country } from '@/lib/catalog';
import { CountryFlag } from './country-flag';

export function CountryCard({ country }: { country: Country }) {
  return (
    <Link
      href={`/${country.slug}`}
      className={`group relative flex min-h-[244px] flex-col overflow-hidden rounded-[28px] ${country.panel} p-6 transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_45px_-28px_rgba(22,52,43,0.4)] sm:min-h-[276px] sm:p-8`}
    >
      <span
        aria-hidden="true"
        className="absolute -right-7 -top-10 select-none text-[150px] leading-none opacity-[0.12] transition-transform duration-300 group-hover:scale-110 sm:text-[180px]"
      >
        {country.code}
      </span>
      <span className="relative grid size-12 place-items-center rounded-2xl bg-white/80 text-3xl shadow-sm">
        <CountryFlag code={country.code} className="h-7 w-10" />
      </span>
      <div className="relative mt-auto pt-10">
        <p className={`text-sm font-bold ${country.accent}`}>
          {country.tagline}
        </p>
        <h2 className="mt-1 text-[27px] font-bold tracking-[-0.04em] text-[#173b33] sm:text-3xl">
          {country.name}
        </h2>
        <p className="mt-2 max-w-xs text-sm leading-6 text-[#53665d]">
          {country.description}
        </p>
      </div>
      <span
        aria-hidden="true"
        className="absolute bottom-7 right-7 grid size-10 place-items-center rounded-full bg-white text-xl text-[#173b33] transition group-hover:translate-x-1"
      >
        →
      </span>
    </Link>
  );
}
