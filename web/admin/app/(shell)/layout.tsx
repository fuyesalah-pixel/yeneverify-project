import Image from 'next/image';
import { NavLink } from '@/components/nav-link';

const NAV = [
  {
    group: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: 'grid' }],
  },
  {
    group: 'Operations',
    items: [
      { href: '/users', label: 'Users', icon: 'users' },
      { href: '/review-queue', label: 'Review queue', icon: 'check' },
      { href: '/fraud', label: 'Fraud & duplicates', icon: 'shield' },
    ],
  },
  {
    group: 'Finance',
    items: [
      { href: '/reports', label: 'Reports & credits', icon: 'chart' },
      { href: '/subscriptions', label: 'Subscriptions', icon: 'repeat' },
    ],
  },
  {
    group: 'Engagement',
    items: [{ href: '/notifications', label: 'Notifications', icon: 'bell' }],
  },
  {
    group: 'Access',
    items: [
      { href: '/audit', label: 'Audit log', icon: 'list' },
      { href: '/health', label: 'System health', icon: 'pulse' },
      { href: '/admins', label: 'Admins', icon: 'key' },
      { href: '/settings', label: 'Platform config', icon: 'settings' },
    ],
  },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <aside className="flex flex-col border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-4 py-4">
          <Image src="/mark-color.svg" alt="" width={620} height={620} className="h-7 w-7" />
          <span className="text-sm font-semibold">Yene Verify</span>
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-dark">
            Admin
          </span>
        </div>

        <nav className="flex gap-4 overflow-x-auto px-2 pb-3 md:block md:flex-1 md:space-y-4 md:overflow-y-auto md:px-2 md:pb-4">
          {NAV.map((section) => (
            <div key={section.group} className="md:space-y-0.5">
              <p className="hidden px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 md:block">
                {section.group}
              </p>
              <div className="flex gap-1 md:block md:space-y-0.5">
                {section.items.map((item) => (
                  <NavLink key={item.href} {...item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <form action="/api/admin/logout" method="post" className="border-t border-slate-200 px-3 py-3">
          <button
            type="submit"
            className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Sign out
          </button>
        </form>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
