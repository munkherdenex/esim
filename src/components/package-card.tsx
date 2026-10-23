import { formatPriceMnt } from '@/lib/catalog';

interface PackageCardProps {
  dataGb: number;
  validityDays: number;
  priceMnt: number;
  supportsChinaSocialApps: boolean;
  bestValue: boolean;
}

export function PackageCard({
  dataGb,
  validityDays,
  priceMnt,
  supportsChinaSocialApps,
  bestValue,
}: PackageCardProps) {
  return (
    <article
      className={`relative flex h-full flex-col rounded-[24px] border bg-white p-5 shadow-[0_8px_30px_-25px_rgba(21,54,44,0.4)] sm:p-6 ${
        bestValue
          ? 'border-[#8ab7a3] ring-1 ring-[#8ab7a3]'
          : 'border-[#e8ece5]'
      }`}
    >
      {bestValue && (
        <span className="absolute -top-3 left-5 rounded-full bg-[#173b33] px-3 py-1 text-[11px] font-bold tracking-wide text-white">
          ХАМГИЙН ХЭМНЭЛТТЭЙ
        </span>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#6b7a71]">Аяллын дата</p>
          <p className="mt-2 text-[32px] font-bold leading-none tracking-[-0.05em] text-[#173b33]">
            {dataGb} <span className="text-xl">GB</span>
          </p>
        </div>
        <span className="rounded-xl bg-[#f2f6f0] px-3 py-2 text-sm font-semibold text-[#456056]">
          {validityDays} хоног
        </span>
      </div>
      <div className="my-5 h-px bg-[#edf0eb]" />
      <div className="mt-auto">
        <p className="text-xs font-medium text-[#7a8980]">Нэг удаагийн үнэ</p>
        <p className="mt-1 text-[26px] font-bold tracking-[-0.04em] text-[#173b33]">
          {formatPriceMnt(priceMnt)}
        </p>
        {supportsChinaSocialApps && (
          <p className="mt-3 rounded-xl bg-[#eef7f0] px-3 py-2 text-xs font-medium leading-5 text-[#326348]">
            Энэ багц Google, Facebook, Instagram ашиглахыг дэмждэг.
          </p>
        )}
      </div>
    </article>
  );
}
