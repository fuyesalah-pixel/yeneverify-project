import Link from 'next/link';

const nav = [
  ['Dashboard', '/dashboard'],
  ['Merchants', '/merchants'],
  ['Verifications', '/verifications'],
  ['Billing', '/billing'],
  ['Fraud', '/fraud'],
  ['Revenue', '/revenue'],
  ['Audit', '/audit'],
  ['Settings', '/settings'],
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white md:min-h-screen md:w-56 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-5 py-4 font-semibold">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand text-xs text-white">YV</span>
          Admin
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1 md:pb-0">
          {nav.map(([label, href]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">{label}</Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}
