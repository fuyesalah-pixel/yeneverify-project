export default function Page({ params }: { params: { id: string } }) {
  return (
    <main className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Merchant {params.id}</h1>
      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">Merchant detail, subscription history, verification counts, and admin actions ship in Phase 4.</div>
    </main>
  );
}
