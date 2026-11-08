import Link from 'next/link';

const banks = ['CBE', 'Telebirr', 'Awash', 'Dashen', 'Abyssinia', 'M-Pesa', 'Zemen'];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm text-white">YV</span>
            Yene Verify
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
            <Link href="/how-it-works">How it works</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
          </nav>
          <a href="#download" className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            Get notified
          </a>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center md:py-28">
        <div>
          <p className="mb-4 text-sm font-medium text-brand">Payment verification for Ethiopian businesses</p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            Verify any Ethiopian bank payment. In seconds.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
            Check a customer&apos;s payment receipt against official bank records, catch duplicates before they cost you, and keep a clear audit trail for your team.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#download" className="rounded-full bg-brand px-5 py-3 text-sm font-medium text-white hover:bg-brand-dark">Download the app</a>
            <Link href="/how-it-works" className="rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-800 hover:border-slate-400">See how it works</Link>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-8 shadow-sm">
          <div className="mx-auto max-w-[280px] rounded-[2rem] border border-slate-200 bg-white p-4 shadow-lg">
            <div className="rounded-2xl bg-brand/10 p-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
              </div>
              <p className="text-sm font-medium text-brand-dark">Verified</p>
              <p className="mt-1 text-xs text-slate-600">Payment confirmed against bank records</p>
              <div className="mt-4 rounded-xl bg-white p-3 text-left text-xs text-slate-700">
                <p><span className="text-slate-500">Bank:</span> CBE</p>
                <p><span className="text-slate-500">Amount:</span> 1,250.00 ETB</p>
                <p><span className="text-slate-500">Reference:</span> FT24305983477</p>
              </div>
            </div>
            <p className="mt-4 text-center text-[11px] text-slate-500">App screenshot placeholder — real screenshots added in Phase 2.</p>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50/60">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <p className="text-center text-xs font-medium uppercase tracking-wide text-slate-500">Works with Ethiopian banks and wallets</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-slate-700">
            {banks.map((b) => (
              <span key={b} className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-brand" />{b}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Built for the way payments actually happen</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            ['Under 10 seconds', 'Capture the receipt and get a clear verdict backed by bank-side checks.'],
            ['Duplicate detection', 'Spot reused receipts automatically before they become a loss.'],
            ['Team management', 'Give branch staff access with the controls a business owner needs.'],
            ['Analytics', 'Understand verification volume, outcomes, and trends as you grow.'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="download" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-3xl bg-slate-950 px-8 py-12 text-white md:px-12">
          <h2 className="text-2xl font-semibold tracking-tight">Get notified when we launch</h2>
          <p className="mt-2 max-w-xl text-slate-300">Yene Verify is preparing for Google Play. Leave your email and we&apos;ll let you know when the app is available.</p>
          <form className="mt-6 flex max-w-md flex-col gap-3 sm:flex-row" action="/contact/" method="get">
            <input type="email" name="email" placeholder="you@business.com" className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm placeholder:text-slate-400" aria-label="Email" />
            <button type="submit" className="rounded-xl bg-brand px-5 py-3 text-sm font-medium text-white hover:bg-brand-dark">Notify me</button>
          </form>
          <p className="mt-3 text-xs text-slate-400">Phase 1 placeholder form. Waitlist API + confirmation state ship in Phase 3.</p>
        </div>
      </section>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
          <p>© 2026 Yene Verify. Made in Ethiopia.</p>
          <div className="flex flex-wrap gap-5">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/contact">Support</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
