import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'About' };

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-brand">← Back to home</Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">About Yene Verify</h1>
      <p className="mt-4 leading-8 text-slate-600">Yene Verify helps Ethiopian businesses confirm bank and wallet payments quickly, reduce fake and duplicate receipts, and keep records they can trust. Built for merchants, teams, and operators who handle payments every day.</p>
      <p className="mt-4 leading-8 text-slate-600">Full company story, team details, and mission copy will be added in Phase 3 with Fuad’s approved content.</p>
    </main>
  );
}
