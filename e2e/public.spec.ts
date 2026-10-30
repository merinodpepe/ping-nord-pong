import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const locales = ['es', 'ca', 'en', 'zh', 'de'] as const;

for (const l of locales) {
  test(`home en ${l}: lang, hero y sin desbordes`, async ({ page }) => {
    await page.goto(`/${l}`);
    await expect(page.locator('html')).toHaveAttribute('lang', l === 'zh' ? 'zh-Hans' : l);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
  });
}

test('el selector de idioma cambia la ruta', async ({ page }) => {
  await page.goto('/es');
  await page.getByRole('combobox', { name: /idioma/i }).first().selectOption('en');
  await expect(page).toHaveURL(/\/en$/);
});

for (const path of ['', '/ranking', '/normativa', '/entrar', '/legal/privacidad']) {
  test(`axe sin violaciones serias en /es${path}`, async ({ page }) => {
    await page.goto(`/es${path}`);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  });
}

test('rutas privadas redirigen a /entrar', async ({ page }) => {
  await page.goto('/es/apuntar');
  await expect(page).toHaveURL(/\/es\/entrar/);
});

test('cabeceras de seguridad y CSP con nonce', async ({ request }) => {
  const res = await request.get('/es');
  const h = res.headers();
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['content-security-policy']).toMatch(/script-src 'self' 'nonce-/);
  expect(h['content-security-policy']).not.toMatch(/script-src[^;]*'unsafe-inline'/);
});
