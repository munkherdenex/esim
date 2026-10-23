import Link from 'next/link';
import { CountryCard } from '@/components/country-card';
import { ShopHeader } from '@/components/shop-header';
import { countries } from '@/lib/catalog';

const benefits = [
  {
    number: '01',
    title: 'Урьдчилан бэлдэнэ',
    description: 'Аяллынхаа улсыг сонгоод тохирох дата багцаа хараарай.',
  },
  {
    number: '02',
    title: 'QR-аар суулгана',
    description: 'Биет SIM карт солих шаардлагагүй.',
  },
  {
    number: '03',
    title: 'Газардмагц ашиглана',
    description: 'Төхөөрөмжөө дэмждэг эсэхийг эхлээд шалгаарай.',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#fbfcf8] text-[#173b33]">
      <ShopHeader />
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#dce8df] bg-white px-3.5 py-1.5 text-xs font-bold tracking-wide text-[#3c6854]">
            <span className="size-1.5 rounded-full bg-[#74a988]" />
            МОНГОЛ АЯЛАГЧДАД ЗОРИУЛАВ
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-[40px] font-bold leading-[1.08] tracking-[-0.055em] sm:text-6xl">
            Аяллаа эхлүүл.
            <br className="hidden sm:block" /> Холбоотой бай.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#66776d] sm:text-lg sm:leading-8">
            Гадаадад датагаа санаа зоволгүй ашиглах eSIM багцаа сонгоорой.
            Урьдчилан суулгаад, очсон даруйдаа холбоотой байгаарай.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-4xl sm:mt-16">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8b9a8f]">
                ЭХЛЭХ УЛСАА СОНГООРОЙ
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-[-0.03em] sm:text-2xl">
                Та хаашаа аялах гэж байна?
              </h2>
            </div>
            <span className="hidden pb-1 text-sm text-[#89978e] sm:block">
              Одоогоор 2 чиглэл
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
            {countries.map((country) => (
              <CountryCard key={country.code} country={country} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#e9ede6] bg-white">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="mb-8 max-w-lg">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6b8c77]">
              ХЭРХЭН АШИГЛАХ ВЭ?
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] sm:text-3xl">
              Аяллын интернетээ амархан бэлдээрэй
            </h2>
          </div>
          <div className="grid gap-7 sm:grid-cols-3 sm:gap-8">
            {benefits.map((benefit) => (
              <article key={benefit.number} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf4ef] text-xs font-bold text-[#47705a]">
                  {benefit.number}
                </span>
                <div>
                  <h3 className="font-bold">{benefit.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-[#708077]">
                    {benefit.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-7 text-xs text-[#89978e] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Link href="/" className="font-bold tracking-tight text-[#547064]">
          holbo.
        </Link>
        <p>Монгол аялагчдад зориулсан аяллын eSIM.</p>
      </footer>
    </main>
  );
}
