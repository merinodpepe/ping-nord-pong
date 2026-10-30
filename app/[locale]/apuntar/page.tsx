import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { RecordMatchForm } from '@/components/RecordMatchForm';
import { allPlayers } from '@/lib/players';
import { requireProfile } from '@/lib/guard';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'record' }))('title') };
}

export default async function RecordPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ rival?: string; counter?: string; challenge?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const me = await requireProfile('/apuntar');
  const t = await getTranslations('record');
  const players = await allPlayers();
  const limited = me.status === 'limited';
  return (
    <div className="pf-container" style={{ paddingTop: 40, maxWidth: 560 }}>
      <p className="pf-label">{t('label')}</p>
      <h1 className="pf-display" style={{ fontSize: 'clamp(32px,6vw,48px)', margin: '8px 0 20px' }}>{t('title')}</h1>
      {limited ? (
        <p role="alert" className="pf-card" style={{ padding: 16, color: 'var(--pf-red-text)' }}>{t('limited')}</p>
      ) : (
        <>
          <details className="pf-card" style={{ padding: '10px 16px', marginBottom: 24 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, minHeight: 28 }}>{t('rulesReminder')}</summary>
            <ul style={{ color: 'var(--pf-text-2)', fontSize: 14, marginTop: 8, paddingLeft: 18, listStyle: 'disc' }}>
              <li>{t('rule1')}</li><li>{t('rule2')}</li><li>{t('rule3')}</li>
            </ul>
            <Link href="/normativa" style={{ color: 'var(--pf-ball-hi)', display: 'inline-block', marginTop: 8 }}>{t('rulesFull')}</Link>
          </details>
          <RecordMatchForm me={{ id: me.id, alias: me.alias }} players={players} initialRival={sp.rival} challengeId={sp.challenge} counterOf={sp.counter} />
        </>
      )}
    </div>
  );
}
