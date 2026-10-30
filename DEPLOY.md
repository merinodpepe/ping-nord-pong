# Despliegue (plan, sección 14.7)

1. **Supabase** (región Frankfurt): `npx supabase db push --db-url "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"`.
2. **Auth → URL Configuration**: Site URL y Redirect URLs = la URL de Vercel (y `http://localhost:3000` para desarrollo).
3. **Auth → Email Templates → Magic Link**: pega `supabase/templates/magic_link.html` (la plantilla va en los 5 idiomas a la vez; el enlace usa `token_hash`, así que funciona abriéndolo en otro navegador). Asunto sugerido: `Tu enlace · Your link · Ping-Nord-Pong`.
4. **Vercel**: importa el repo, región `fra1`, y carga las variables de `.env.example` (incluido `CRON_SECRET` y `NEXT_PUBLIC_SITE_URL`).
5. Comprueba en *Settings → Cron Jobs* que aparece `/api/keepalive` y lánzalo una vez.
6. **GitHub → Settings → Secrets → Actions**: `SUPABASE_URL` y `SUPABASE_ANON_KEY`. Ejecuta el workflow `keepalive` con *Run workflow*.
7. Verifica en la tabla `keepalive` que las dos filas tienen `last_ping` reciente.
8. **Turnstile**: crea el widget en Cloudflare y rellena `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`. En producción, sin clave secreta el formulario de entrada rechaza (falla cerrado).
9. Primer admin: tras registrarte, en el SQL editor de Supabase: `update profiles set role = 'admin' where alias = 'tu_alias';`
10. Backups: activa los de Supabase y deja corriendo `pg-dump.yml` (semanal) si estás en plan Free.
