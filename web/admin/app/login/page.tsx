'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm text-white">YV</span>
          <span className="font-semibold">Yene Verify Admin</span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">Admin access uses phone + OTP (ADMIN role only). Full auth wiring ships in Phase 4.</p>
        <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="phone">Phone</label>
        <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+251..." className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-brand" />
        <button type="button" className="mt-4 w-full rounded-xl bg-brand px-4 py-3 text-sm font-medium text-white hover:bg-brand-dark">Request OTP</button>
        <p className="mt-4 text-xs text-slate-500">Phase 1 scaffold: login UI is present; backend session/cookie flow is implemented in Phase 4.</p>
      </div>
    </main>
  );
}
