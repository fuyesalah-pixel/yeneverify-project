import type { Metadata } from 'next';
import Link from 'next/link';
import packages from '@/lib/packages.json';

export const metadata: Metadata = { title: 'Pricing' };

type Pkg = { code: string; name: string; priceMinor: number | null; currency: string; creditsPerMonth: number | null; unlimited: boolean; custom: boolean; features: string[] };

function price(p: Pkg) {
  if (p.custom) return 'Contact us';
  if (!p.priceMinor) return 'Free';
  return `${(p.priceMinor / 100).toLocaleString('en-ET')} ${p.currency}/mo`;
}

export default function Page() {
  const list = (packages as Pkg[]).filter((p) => !('_comment' in (p as object)));
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <Link href="/" className="text-sm text-brand">← Back to home</Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Pricing</h1>
      <p className="mt-4 max-w-2xl text-slate-600">Plans for individual merchants, growing teams, and businesses with higher verification volume. Full comparison table and CTAs refined in Phase 2.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => (
          <article key={p.code} className="rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold">{p.name}</h2>
            <p className="mt-2 text-2xl font-semibold text-brand-dark">{price(p)}</p>
            <p className="mt-1 text-sm text-slate-500">{p.unlimited ? 'Unlimited verifications' : p.creditsPerMonth ? `${p.creditsPerMonth} verifications / month` : 'Custom volume'}</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {p.features.slice(0, 5).map((f) => <li key={f} className="flex gap-2"><span className="text-brand">•</span>{f}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </main>
  );
}
