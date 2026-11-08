import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Contact' };

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-brand">← Back to home</Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Contact</h1>
      <p className="mt-4 text-slate-600">Support: <a className="text-brand underline" href="mailto:support@mekatanker.shop">support@mekatanker.shop</a></p>
      <p className="mt-6 text-sm text-slate-500">Contact form and waitlist confirmation state ship in Phase 3.</p>
    </main>
  );
}
