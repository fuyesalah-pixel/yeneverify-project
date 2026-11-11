export function SectionPlaceholder({
  title,
  description,
  planned,
  phase,
  children,
}: {
  title: string;
  description: string;
  planned: string[];
  phase: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="p-6 md:p-8">
      {children}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p>
        </div>
        <span className="rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {phase}
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {planned.map((item) => (
          <section
            key={item}
            className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600"
          >
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-brand/60 align-middle" />
            {item}
          </section>
        ))}
      </div>

      <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4 text-xs text-slate-500">
        Layout and navigation are live. Data, filters, and actions are wired to the admin API in
        the build phases listed in the spec.
      </p>
    </main>
  );
}
