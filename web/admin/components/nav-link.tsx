'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icon';

export function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm transition ${
        active
          ? 'bg-brand/10 font-medium text-brand-dark'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon name={icon} className={`h-4 w-4 ${active ? 'text-brand-dark' : 'text-slate-400'}`} />
      <span>{label}</span>
    </Link>
  );
}
