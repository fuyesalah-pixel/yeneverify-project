export default function Page() {
  const cards = [
    ['Merchants', '—', 'Total / active / suspended (Phase 4)'],
    ['Verifications', '—', 'Today / week / month (Phase 5)'],
    ['Revenue', '—', 'Monthly subscription revenue (Phase 5)'],
    ['Health', 'Pending', 'DB, Redis, storage, bank adapters (Phase 4)'],
  ];
  return (
    <main className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-600">Phase 1 scaffold. Real stats, activity, and alerts are wired in Phase 4.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([title, value, note]) => (
          <section key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{title}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
            <p className="mt-2 text-xs text-slate-500">{note}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
