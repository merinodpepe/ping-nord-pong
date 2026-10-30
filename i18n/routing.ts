import { defineRouting } from 'next-intl/routing';

export const locales = ['es', 'ca', 'en', 'zh', 'de'] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: 'es',
  localePrefix: 'always',
});

export const localeNames: Record<Locale, string> = {
  es: 'Español',
  ca: 'Català',
  en: 'English',
  zh: '中文',
  de: 'Deutsch',
};

export const htmlLang: Record<Locale, string> = { es: 'es', ca: 'ca', en: 'en', zh: 'zh-Hans', de: 'de' };
