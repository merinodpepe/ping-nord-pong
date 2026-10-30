# Ping-Nord-Pong · reglas para Claude Code

Ranking ELO público de ping-pong del Campus Nord. Plan completo en `PLAN.md` (resumen aquí de las secciones 0, 3.1, 6 y 7).

## Reglas (sección 0)
1. **El diseño está decidido.** Tokens, tipografías y SVG de `design/` y `app/styles/tokens.css`. Nada de plantillas por defecto (checklist anti-IA, 3.8).
2. **La seguridad va en la base de datos.** Ningún cliente escribe ELO, estados de partido ni roles: todo por RPC `security definer` con RLS activado (`supabase/migrations`).
3. **Cada texto visible va en `messages/{es,ca,en,zh,de}.json`.** Sin texto en duro. `npm run i18n:check` falla si falta o sobra una clave.
4. **Tests antes de la UI** que dependa de ELO o RLS: `npm test` (Vitest) y `npm run db:test` (Postgres en Docker).
5. **Mínimos datos.** Justifica en el PR cualquier campo nuevo.
6. Commits pequeños con la fase: `F2: confirmar partido + recálculo ELO`.
7. El emblema (`lib/emblem/emblem.impl.ts`) es un port literal de `design/emblem/emblem.js`: no se toca la lógica; los snapshots de `design/emblem/ejemplos` deben coincidir.

## Decisiones tomadas con el usuario
- **Sin restricción de dominio de email**: cualquier email puede registrarse con enlace mágico (no hay `ALLOWED_EMAIL_DOMAINS`).
- Avisos solo dentro de la web (sin emails salvo el de login).

## Diseño (3.1)
Solo tema oscuro. `--pf-bg #0A1020`, `--pf-ball #FF7A1A` (CTA), rojo = jugador A, azul = jugador B, `--pf-win #3DDC84`. Fuentes: Bricolage Grotesque (títulos), Manrope (UI), JetBrains Mono (números), Caveat (notas a mano). Foco visible 2px naranja, objetivos táctiles ≥44px, respeta `prefers-reduced-motion`.

## i18n (6)
next-intl, rutas `/es /ca /en /zh /de`, `es` por defecto. ICU para plurales. ELO sin separador de miles. `ca`, `zh`, `de` pendientes de revisión nativa (`TRANSLATIONS.md`).

## Seguridad (7)
- RLS en todas las tablas; público solo ve vistas (`public_profiles`, `rivalries`, …). `service_role` solo en servidor (`lib/supabase/server.ts: supabaseAdmin`), nunca en el cliente.
- Validación zod en servidor aunque el cliente ya valide. Sin `dangerouslySetInnerHTML` con contenido de usuario.
- CSP con nonce y cabeceras en `proxy.ts` / `next.config.ts`.
- Logs sin datos personales: ids, nunca emails.
