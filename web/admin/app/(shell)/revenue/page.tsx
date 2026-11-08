function P({ title, body }: { title: string; body: string }) {
  return <main className="p-6 md:p-8"><h1 className="text-2xl font-semibold tracking-tight">{title}</h1><div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">{body}</div></main>;
}
export default function Page() { return <P title="Revenue" body="MRR, ARR, and per-plan revenue views ship in Phase 5." />; }
