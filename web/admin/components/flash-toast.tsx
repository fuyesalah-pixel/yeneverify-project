'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/** Fixed toast for action feedback; hides itself after a few seconds. */
export function FlashToast({ notice, error }: { notice?: string; error?: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!notice && !error) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(timer);
  }, [notice, error]);

  if (!visible || (!notice && !error)) return null;

  return (
    <div className="fixed right-4 top-4 z-[60] w-full max-w-sm" role="status" aria-live="polite">
      <p
        className={cn(
          'rounded-xl border px-4 py-3 text-sm shadow-lg',
          error
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-emerald-200 bg-emerald-50 text-emerald-800',
        )}
      >
        {error ?? notice}
      </p>
    </div>
  );
}
