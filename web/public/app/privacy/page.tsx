import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Privacy Policy' };

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 prose prose-slate">
      <Link href="/" className="text-sm text-brand no-underline">← Back to home</Link>
      <h1 className="mt-6">Privacy Policy</h1>
      <p><strong>Effective date:</strong> 2026-11-08. This placeholder will be replaced with reviewed privacy text in Phase 3.</p>
      <p>We collect information needed to operate verification services, such as account details, receipt data submitted for verification, and service usage logs.</p>
      <p>We use reasonable safeguards to protect data and do not sell personal information. Data handling details, retention, and rights will be documented in the final policy.</p>
      <p>Contact: <a href="mailto:support@mekatanker.shop">support@mekatanker.shop</a>.</p>
    </main>
  );
}
