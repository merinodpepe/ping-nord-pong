import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Empty } from '@/components/Empty';
import { EmblemMini } from '@/components/EmblemMini';
import { getRivalries } from '@/lib/data';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'rivalries' }))('title') };
}

export default async function RivalriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('rivalries');
  const list = await getRivalries();
  return (
    <div className="pf-container" style={{ paddingTop: 48 }}>
      <p className="pf-label">{t('label')}</p>
      <h1 className="pf-display" style={{ fontSize: 'clamp(36px,5vw,60px)', margin: '8px 0 8px' }}>{t('title')}</h1>
      <p style={{ color: 'var(--pf-text-2)', marginBottom: 24, maxWidth: '60ch' }}>{t('lead')}</p>
      {list.length ? (
        <ul style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {list.map((r) => (
            <li key={r.player_low + r.player_high}>
              <Link href={`/rivalidad/${r.alias_low}/${r.alias_high}`} className="pf-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, textDecoration: 'none', minHeight: 72 }}>
                <EmblemMini role="crow" seed={r.seed} label={t('crow')} />
                <span style={{ fontWeight: 700 }}>{r.alias_low} <span style={{ color: 'var(--pf-faint)', fontWeight: 500 }}>{t('vs')}</span> {r.alias_high}</span>
                <span className="pf-mono" style={{ marginLeft: 'auto', fontWeight: 700 }}>{r.wins_low}–{r.wins_high}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <Empty title={t('emptyTitle')}>{t('emptyBody')}</Empty>}
    </div>
  );
}
