const pages = [
  ['Merchants', 'Search, filter, detail, and actions (suspend/ban/reset PIN/delete) ship in Phase 4.'],
  ['Verifications', 'Review queue with OCR/adapter detail and manual verdict actions ships in Phase 5.'],
  ['Billing', 'Payment review queue and approve/reject flows ship in Phase 5.'],
  ['Fraud', 'Duplicate fingerprints and velocity alerts ship in Phase 5.'],
  ['Revenue', 'MRR/ARR and per-plan charts ship in Phase 5.'],
  ['Audit', 'Searchable/exportable admin action log ships in Phase 5.'],
  ['Settings', 'Payment accounts, packages, feature flags, announcements ship in Phase 5.'],
];

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <main className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">{body}</div>
    </main>
  );
}

export default function Merchants() { return <Placeholder title="Merchants" body={pages[0][1]} />; }
