import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/routing';
import { SITE_URL } from '@/lib/env';

const paths = ['', '/ranking', '/rivalidades', '/normativa', '/legal/terminos', '/legal/privacidad', '/legal/cookies'];

export default function sitemap(): MetadataRoute.Sitemap {
  return paths.flatMap((p) =>
    locales.map((l) => ({
      url: `${SITE_URL}/${l}${p}`,
      alternates: { languages: Object.fromEntries(locales.map((x) => [x, `${SITE_URL}/${x}${p}`])) },
    })),
  );
}
