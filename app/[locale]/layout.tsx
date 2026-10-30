import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Bricolage_Grotesque, Caveat, JetBrains_Mono, Ma_Shan_Zheng, Manrope, Noto_Sans_SC } from 'next/font/google';
import type { ReactNode } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { htmlLang, locales, routing } from '@/i18n/routing';
import { SITE_URL } from '@/lib/env';
import '../styles/globals.css';

const bricolage = Bricolage_Grotesque({ subsets: ['latin', 'latin-ext'], weight: ['500', '800'], variable: '--font-bricolage', display: 'swap' });
const manrope = Manrope({ subsets: ['latin', 'latin-ext'], weight: ['400', '600', '700', '800'], variable: '--font-manrope', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], weight: ['500', '700'], variable: '--font-jetbrains', display: 'swap' });
const caveat = Caveat({ subsets: ['latin', 'latin-ext'], weight: ['700'], variable: '--font-caveat', display: 'swap' });
const notoSc = Noto_Sans_SC({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-noto-sc', display: 'swap', preload: false });
const maShan = Ma_Shan_Zheng({ subsets: ['latin'], weight: '400', variable: '--font-ma-shan', display: 'swap', preload: false });

export const viewport: Viewport = { themeColor: '#0A1020', colorScheme: 'dark' };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t('title'), template: `%s · Ping-Nord-Pong` },
    description: t('description'),
    applicationName: 'Ping-Nord-Pong',
    authors: [{ name: 'Pepe Flock' }],
    alternates: {
      languages: Object.fromEntries(locales.map((l) => [htmlLang[l], `/${l}`])),
    },
    openGraph: { title: t('title'), description: t('description'), siteName: 'Ping-Nord-Pong', type: 'website', locale },
  };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('nav');
  const fonts = [bricolage, manrope, jetbrains, caveat, notoSc, maShan].map((f) => f.variable).join(' ');
  return (
    <html lang={htmlLang[locale]} className={fonts}>
      <body>
        <NextIntlClientProvider>
          <a href="#main" className="sr-only-focusable pf-btn pf-btn-primary" style={{ position: 'fixed', top: 8, left: 8, zIndex: 100 }}>
            {t('skip')}
          </a>
          <Header />
          <main id="main">{children}</main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
