'use client';
import Script from 'next/script';
import { useEffect, useId, useRef } from 'react';
import { TURNSTILE_SITE_KEY } from '@/lib/env';

declare global {
  interface Window { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; remove: (id: string) => void } }
}

/** Cloudflare Turnstile (sin seguimiento de Google). Añade el campo cf-turnstile-response al formulario. */
export function Turnstile({ action }: { action: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let widget: string | undefined;
    const tryRender = () => {
      if (!window.turnstile || !ref.current || widget) return;
      widget = window.turnstile.render(ref.current, { sitekey: TURNSTILE_SITE_KEY, action, theme: 'dark', appearance: 'interaction-only' });
    };
    tryRender();
    const timer = setInterval(tryRender, 300);
    return () => {
      clearInterval(timer);
      if (widget) window.turnstile?.remove(widget);
    };
  }, [action, id]);
  if (!TURNSTILE_SITE_KEY) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
      <div ref={ref} />
    </>
  );
}
