import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 prose prose-slate">
      <Link href="/" className="text-sm text-brand no-underline">← Back to home</Link>
      <h1 className="mt-6">Terms of Service</h1>
      <p><strong>Effective date:</strong> 2026-11-08. This placeholder will be replaced with reviewed legal text in Phase 3.</p>
      <p>Yene Verify provides tools to help businesses review payment receipt information. Verification results are provided on a best-effort basis and may require manual review.</p>
      <p>You are responsible for complying with applicable laws, protecting account access, and using the service lawfully.</p>
      <p>Contact: <a href="mailto:support@mekatanker.shop">support@mekatanker.shop</a>.</p>
    </main>
  );
}
