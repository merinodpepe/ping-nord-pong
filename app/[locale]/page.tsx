import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Empty } from '@/components/Empty';
import { HeroTable } from '@/components/HeroTable';
import { RankingTable } from '@/components/RankingTable';
import { RivalryEmblem } from '@/components/RivalryEmblem';
import { getHome } from '@/lib/data';
import { initials } from '@/lib/avatar';
import { getSession } from '@/lib/session';

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const f = await getFormatter();
  const [home, { user }] = await Promise.all([getHome(), getSession()]);
  const w = home.week;
  const crowAlias = w ? (w.crow_id === w.player_low ? w.alias_low : w.alias_high) : '';
  const snakeAlias = w ? (w.crow_id === w.player_low ? w.alias_high : w.alias_low) : '';
  const stats = [
    { n: home.players, l: t('statPlayers') },
    { n: home.matches, l: t('statMatches') },
    { n: home.rivalries, l: t('statRivalries') },
    { n: home.matches7d, l: t('statWeek') },
  ];
  return (
    <>
      {/* HERO */}
      <section className="pf-container" style={{ display: 'grid', gap: 32, padding: '48px 20px 24px', alignItems: 'center' }}>
        <div className="hero-grid" style={{ display: 'grid', gap: 32, alignItems: 'center' }}>
          <div>
            <p className="pf-label">{t('kicker')}</p>
            <h1 className="pf-display" aria-label="Ping-Nord-Pong" style={{ fontSize: 'clamp(52px, 8vw, 112px)', lineHeight: 0.9, letterSpacing: '-3px', margin: '16px 0 20px' }}>
              <span aria-hidden="true" style={{ display: 'block' }}>Ping<span style={{ color: 'var(--pf-ball)' }}>-</span></span>
              <span aria-hidden="true" style={{ display: 'block' }}>Nord<span style={{ color: 'var(--pf-ball)' }}>-</span></span>
              <span aria-hidden="true" style={{ display: 'inline-block', position: 'relative' }}>
                Pong
                <svg viewBox="0 0 220 24" preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', left: '-4%', bottom: -14, width: '108%', height: 22 }}>
                  <path d="M4 14 C40 6 70 20 104 11 C136 3 170 19 216 8" fill="none" stroke="#FF7A1A" strokeWidth="6" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p style={{ fontSize: 20, color: 'var(--pf-text-2)', maxWidth: '38ch', marginBottom: 12 }}>{t('title')}</p>
            <p style={{ color: 'var(--pf-muted)', maxWidth: '52ch', marginBottom: 28 }}>{t('lead')}</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {user ? (
                <Link href="/apuntar" className="pf-btn pf-btn-primary">{t('ctaRecord')}</Link>
              ) : (
                <Link href="/entrar" className="pf-btn pf-btn-primary">{t('ctaEnter')}</Link>
              )}
              <Link href="/ranking" className="pf-btn pf-btn-secondary">{t('ctaRanking')}</Link>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <HeroTable />
            <span className="pf-hand" aria-hidden="true" style={{ position: 'absolute', right: 8, bottom: -8 }}>{t('note')}</span>
          </div>
        </div>
      </section>

      {/* CIFRAS (datos reales de la BD) */}
      <section aria-label={t('statsLabel')} style={{ background: 'var(--pf-surface)', borderBlock: '1px solid var(--pf-line)', marginTop: 40 }}>
        <dl className="pf-container stats-grid" style={{ display: 'grid', gap: 16, padding: '24px 20px', margin: '0 auto' }}>
          {stats.map((s) => (
            <div key={s.l}>
              <dd className="pf-display" style={{ fontSize: 40, letterSpacing: '-1px' }}>{f.number(s.n, { useGrouping: false })}</dd>
              <dt style={{ color: 'var(--pf-muted)', fontSize: 14 }}>{s.l}</dt>
            </div>
          ))}
        </dl>
      </section>

      {/* RANKING */}
      <section className="pf-container" style={{ paddingTop: 64 }}>
        <p className="pf-label">{t('rankLabel')}</p>
        <div style={{ display: 'flex', alignItems: 'end', gap: 16, flexWrap: 'wrap', margin: '8px 0 20px' }}>
          <h2 className="pf-display" style={{ fontSize: 'clamp(32px,4vw,48px)' }}>{t('rankTitle')}</h2>
          <Link href="/ranking" className="pf-btn pf-btn-secondary pf-btn-sm" style={{ marginLeft: 'auto' }}>{t('rankAll')}</Link>
        </div>
        {home.top.length ? <RankingTable rows={home.top} /> : <Empty title={t('emptyRankTitle')}>{t('emptyRankBody')}</Empty>}
      </section>

      {/* RIVALIDAD DE LA SEMANA */}
      <section className="pf-container" style={{ paddingTop: 72 }}>
        <p className="pf-label">{t('weekLabel')}</p>
        {w ? (
          <div className="pf-card week-grid" style={{ display: 'grid', gap: 24, padding: 28, marginTop: 12, alignItems: 'center' }}>
            <div style={{ justifySelf: 'center' }}>
              <RivalryEmblem
                crowIni={initials(crowAlias)} snakeIni={initials(snakeAlias)} state={w.emblem_state} prevState={w.prev_state}
                seed={w.seed} size={260} label={t('emblemLabel', { crow: crowAlias, snake: snakeAlias })}
              />
            </div>
            <div>
              <h2 className="pf-display" style={{ fontSize: 'clamp(28px,4vw,44px)' }}>
                <Link href={`/jugador/${w.alias_low}`}>{w.alias_low}</Link> <span style={{ color: 'var(--pf-faint)', fontWeight: 500 }}>{t('vs')}</span> <Link href={`/jugador/${w.alias_high}`}>{w.alias_high}</Link>
              </h2>
              <p style={{ color: 'var(--pf-muted)', margin: '12px 0 20px', maxWidth: '52ch' }}>{t('weekBody', { crow: crowAlias, snake: snakeAlias })}</p>
              <p className="pf-mono" style={{ fontSize: 44, fontWeight: 700 }}>
                <span style={{ color: 'var(--pf-red-text)' }}>{w.wins_low}</span><span style={{ color: '#4A5B78' }}> – </span><span style={{ color: 'var(--pf-blue-text)' }}>{w.wins_high}</span>
              </p>
              <p style={{ color: 'var(--pf-muted)', marginBottom: 20 }}>{t('weekMeta', { total: w.total, week: w.matches_7d })}</p>
              <Link href={`/rivalidad/${w.alias_low}/${w.alias_high}`} className="pf-btn pf-btn-primary">{t('weekCta')}</Link>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}><Empty title={t('emptyWeekTitle')}>{t('emptyWeekBody')}</Empty></div>
        )}
      </section>

      {/* TRES BOTES */}
      <section className="pf-container" style={{ paddingTop: 80 }}>
        <h2 className="pf-display" style={{ fontSize: 'clamp(30px,4vw,48px)' }}>{t('stepsTitle')}</h2>
        <p style={{ color: 'var(--pf-muted)', marginBottom: 8 }}>{t('stepsSub')}</p>
        <svg viewBox="0 0 1200 110" preserveAspectRatio="none" aria-hidden="true" style={{ width: '100%', height: 90 }} className="steps-arc">
          <line x1="0" y1="104" x2="1200" y2="104" stroke="#2E4366" strokeWidth="2" />
          <line x1="400" y1="60" x2="400" y2="104" stroke="#E8EEF7" strokeWidth="3" opacity="0.6" />
          <line x1="800" y1="60" x2="800" y2="104" stroke="#E8EEF7" strokeWidth="3" opacity="0.6" />
          <path d="M30 100 Q215 -30 400 100 Q600 -30 800 100 Q985 -30 1170 100" fill="none" stroke="#FF7A1A" strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round" />
          <circle cx="1170" cy="96" r="9" fill="#FF7A1A" />
        </svg>
        <ol className="steps-grid" style={{ display: 'grid', gap: 24, listStyle: 'none', marginTop: 8 }}>
          {[1, 2, 3].map((n, i) => (
            <li key={n} style={{ paddingTop: i * 28 }}>
              <span className="pf-step-n" aria-hidden="true">{n}</span>
              <h3 className="pf-display" style={{ fontSize: 26, margin: '4px 0 8px' }}>{t(`step${n}Title`)}</h3>
              <p style={{ color: 'var(--pf-muted)', maxWidth: '36ch' }}>{t(`step${n}Body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* NORMATIVA */}
      <section style={{ background: 'var(--pf-table)', marginTop: 80 }}>
        <div className="pf-container" style={{ padding: '48px 20px', display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}>
            <h2 className="pf-display" style={{ fontSize: 'clamp(26px,3.5vw,40px)' }}>{t('rulesTitle')}</h2>
            <p style={{ color: 'var(--pf-text-2)', marginTop: 8, maxWidth: '52ch' }}>{t('rulesBody')}</p>
          </div>
          <Link href="/normativa" className="pf-btn pf-btn-primary">{t('rulesCta')}</Link>
        </div>
      </section>
      <style>{`
        .hero-grid { grid-template-columns: 1fr; }
        .stats-grid { grid-template-columns: repeat(2, 1fr); }
        .week-grid { grid-template-columns: 1fr; }
        .steps-grid { grid-template-columns: 1fr; }
        .steps-arc { display: none; }
        @media (min-width: 900px) {
          .hero-grid { grid-template-columns: 1.1fr 1fr; }
          .stats-grid { grid-template-columns: repeat(4, 1fr); }
          .week-grid { grid-template-columns: 300px 1fr; }
          .steps-grid { grid-template-columns: repeat(3, 1fr); }
          .steps-arc { display: block; }
        }
      `}</style>
    </>
  );
}
