import Image from 'next/image';
import { GoogleSignIn } from './google-signin';

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-6">
      <div
        className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-brand/10 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand via-brand-accent to-brand-lime" />
        <div className="mb-7">
          <Image
            src="/logo-color.svg"
            alt="Yene Verify"
            width={923}
            height={890}
            priority
            className="h-16 w-auto"
          />
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            Admin console
          </p>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Sign in with Google</h1>
        <p className="mt-2 text-sm text-slate-600">
          Only allowlisted admin accounts can open this dashboard. Access is granted by email, not
          by phone or OTP.
        </p>
        <GoogleSignIn />
        <p className="mt-6 border-t border-slate-100 pt-4 text-[11px] leading-relaxed text-slate-500">
          Unauthorized accounts are rejected and the attempt is recorded in the audit log.
        </p>
      </div>
    </main>
  );
}
