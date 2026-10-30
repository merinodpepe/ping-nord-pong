import { getTranslations, setRequestLocale } from 'next-intl/server';
import { signOut, signOutEverywhere, acceptTerms, markAllRead } from '@/app/actions';
import { DeleteAccountForm, ProfileForm } from '@/components/SettingsForms';
import { requireProfile } from '@/lib/guard';
import { TERMS_VERSION } from '@/lib/env';
import { supabaseServer } from '@/lib/supabase/server';
import { Link } from '@/i18n/navigation';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'settings' }))('title') };
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireProfile('/ajustes');
  const t = await getTranslations('settings');
  const tn = await getTranslations('notifications');
  const sb = await supabaseServer();
  const { data: notes } = await sb.from('notifications').select('id, kind, detail, read_at, created_at').order('created_at', { ascending: false }).limit(20);
  const sec = { display: 'grid', gap: 14, paddingTop: 32, borderTop: '1px solid var(--pf-line)' } as const;
  return (
    <div className="pf-container" style={{ paddingTop: 40, maxWidth: 560, display: 'grid', gap: 32 }}>
      <header>
        <p className="pf-label">{t('label')}</p>
        <h1 className="pf-display" style={{ fontSize: 'clamp(32px,6vw,48px)', margin: '8px 0' }}>{t('title')}</h1>
        <p style={{ color: 'var(--pf-muted)' }}>{me.email}</p>
      </header>
      {me.terms_version !== TERMS_VERSION ? (
        <form action={acceptTerms} className="pf-card" style={{ padding: 16, display: 'grid', gap: 10 }}>
          <p>{t('newTerms')} <Link href="/legal/terminos" style={{ textDecoration: 'underline' }}>{t('readTerms')}</Link></p>
          <button className="pf-btn pf-btn-primary pf-btn-sm" type="submit">{t('acceptTerms')}</button>
        </form>
      ) : null}
      {me.status !== 'active' ? <p role="alert" className="pf-card" style={{ padding: 16, color: 'var(--pf-red-text)' }}>{me.status === 'limited' ? t('limited') : t('banned')}</p> : null}
      <ProfileForm id={me.id} alias={me.alias} color={me.avatar_color} locale={me.locale} />
      <section style={sec} aria-labelledby="h-notes">
        <h2 id="h-notes" className="pf-display" style={{ fontSize: 22 }}>{t('notifications')}</h2>
        {(notes ?? []).length ? (
          <>
            <ul style={{ display: 'grid', gap: 8 }}>
              {(notes ?? []).map((n) => (
                <li key={n.id} style={{ color: n.read_at ? 'var(--pf-muted)' : 'var(--pf-text)' }}>
                  {tn(n.kind as never)}{n.detail ? ` — ${n.detail}` : ''}
                </li>
              ))}
            </ul>
            <form action={markAllRead}><button className="pf-btn pf-btn-secondary pf-btn-sm" type="submit">{t('markRead')}</button></form>
          </>
        ) : <p style={{ color: 'var(--pf-muted)' }}>{t('noNotifications')}</p>}
        <p style={{ color: 'var(--pf-faint)', fontSize: 13 }}>{t('noEmails')}</p>
      </section>
      <section style={sec} aria-labelledby="h-data">
        <h2 id="h-data" className="pf-display" style={{ fontSize: 22 }}>{t('yourData')}</h2>
        <a className="pf-btn pf-btn-secondary" href={`/api/export`} download>{t('export')}</a>
        <form action={signOut}><button className="pf-btn pf-btn-secondary" type="submit" style={{ width: '100%' }}>{t('signOut')}</button></form>
        <form action={signOutEverywhere}><button className="pf-btn pf-btn-secondary" type="submit" style={{ width: '100%' }}>{t('signOutAll')}</button></form>
      </section>
      <section style={sec} aria-labelledby="h-del">
        <h2 id="h-del" className="pf-display" style={{ fontSize: 22 }}>{t('deleteTitle')}</h2>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
