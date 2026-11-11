const cards: Array<[string, string, string]> = [
  ['Total merchants', '—', 'Merchants and sub-merchants'],
  ['Active today', '—', 'Users with a session today'],
  ['Verifications today', '—', 'All statuses'],
  ['Revenue this month', '—', 'Subscription revenue (ETB)'],
  ['Pending reviews', '—', 'NEEDS_REVIEW queue'],
];

export default function Page() {
  return (
    <main className="p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Platform metrics, verification trend, and operational alerts.
          </p>
        </div>
        <span className="rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Phase E
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([title, value, note]) => (
          <section key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{title}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
            <p className="mt-2 text-xs text-slate-500">{note}</p>
          </section>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">Verifications per day</h2>
          <p className="mt-1 text-xs text-slate-500">
            Last 7 days — chart wired to <code>GET /admin/credits/overview</code> in Phase E.
          </p>
          <div className="mt-4 h-40 rounded-xl border border-dashed border-slate-200 bg-slate-50/60" />
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold">Alerts</h2>
          <ul className="mt-3 space-y-2 text-xs text-slate-500">
            <li>Flagged users</li>
            <li>Pending manual reviews</li>
            <li>Low-credit merchants</li>
          </ul>
          <div className="mt-4 h-24 rounded-xl border border-dashed border-slate-200 bg-slate-50/60" />
        </section>
      </div>
    </main>
  );
}
