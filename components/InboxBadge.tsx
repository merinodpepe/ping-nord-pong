'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';

/** Contador rojo de la navegación. Se actualiza con Supabase Realtime (RLS: solo llegan los avisos propios). */
export function InboxBadge({ userId, initial }: { userId: string; initial: number }) {
  const router = useRouter();
  const n = initial;
  useEffect(() => {
    const sb = supabaseBrowser();
    const ch = sb
      .channel(`inbox:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `profile_id=eq.${userId}` }, () => {
        router.refresh(); // el servidor recalcula el contador
      })
      .subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, [userId, router]);
  if (!n) return null;
  return <span aria-label={String(n)} style={{ background: 'var(--pf-red)', color: '#fff', borderRadius: 999, fontSize: 12, fontWeight: 800, padding: '1px 7px' }}>{n}</span>;
}
