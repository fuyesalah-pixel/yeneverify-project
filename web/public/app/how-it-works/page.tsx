import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'How it works' };

const steps = [
  ['1. Capture the receipt', 'Take a photo of the customer’s payment confirmation or upload the receipt image in the app.'],
  ['2. We check official records', 'Yene Verify reads the reference details and checks them using supported bank-side verification flows.'],
  ['3. Get a clear verdict', 'See Verified, Fake, Duplicate, or Needs Review in seconds, with details your team can act on.'],
];

export default function Page() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link href="/" className="text-sm text-brand">← Back to home</Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">How Yene Verify works</h1>
      <p className="mt-4 text-slate-600">A simple flow for merchants and staff at the point of sale. Full illustrated walkthrough with app screenshots ships in Phase 2.</p>
      <div className="mt-10 space-y-4">
        {steps.map(([title, body]) => (
          <section key={title} className="rounded-2xl border border-slate-200 p-6">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
