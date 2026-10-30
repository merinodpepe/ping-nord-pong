import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase/server';
import { Avatar } from './Avatar';
import { InboxBadge } from './InboxBadge';
import { LocaleSwitcher } from './LocaleSwitcher';
import { Wordmark } from './Wordmark';

export async function Header() {
  const t = await getTranslations('nav');
  const { user, profile } = await getSession();
  let inbox = { pending_to_confirm: 0, new_challenges: 0, unread: 0 };
  if (profile) {
    const sb = await supabaseServer();
    const { data } = await sb.rpc('my_inbox');
    if (data) inbox = data as typeof inbox;
  }
  const links = [
    { href: '/ranking', label: t('ranking') },
    { href: '/rivalidades', label: t('rivalries') },
    { href: '/retos', label: t('challenges'), badge: inbox.new_challenges },
    { href: '/normativa', label: t('rules') },
  ] as const;
  return (
    <header style={{ borderBottom: '1px solid var(--pf-line)' }}>
      <div className="pf-container" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px', flexWrap: 'wrap' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }} aria-label={t('home')}>
          <Image src="/brand/oveja-pingpong.svg" width={44} height={44} alt="" priority />
          <Wordmark className="text-[22px]" />
        </Link>
        <nav aria-label={t('main')} style={{ display: 'flex', gap: 4, marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap' }}>
          {links.map((l) => (
            <Link key={l.href} href={l.href} style={{ padding: '10px 12px', minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--pf-text-2)', textDecoration: 'none' }}>
              {l.label}
              {'badge' in l && l.badge ? <span aria-label={String(l.badge)} style={{ background: 'var(--pf-red)', color: '#fff', borderRadius: 999, fontSize: 12, fontWeight: 800, padding: '1px 7px' }}>{l.badge}</span> : null}
            </Link>
          ))}
          {profile ? (
            <>
              <Link href="/pendientes" style={{ padding: '10px 12px', minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--pf-text-2)', textDecoration: 'none' }}>
                {t('pending')}
                <InboxBadge userId={profile.id} initial={inbox.pending_to_confirm + inbox.new_challenges} />
              </Link>
              <Link href="/ajustes" aria-label={t('account', { alias: profile.alias })} style={{ display: 'inline-flex', minHeight: 44, alignItems: 'center', padding: '0 6px' }}>
                <Avatar id={profile.id} alias={profile.alias} color={profile.avatar_color} size={36} />
              </Link>
            </>
          ) : user ? (
            <Link href="/bienvenida" className="pf-btn pf-btn-primary pf-btn-sm">{t('finishSignup')}</Link>
          ) : (
            <Link href="/entrar" className="pf-btn pf-btn-primary pf-btn-sm">{t('enter')}</Link>
          )}
          <LocaleSwitcher compact />
        </nav>
      </div>
    </header>
  );
}
