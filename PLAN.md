# Ping-Nord-Pong — Plan de construcción

> **Proyecto:** Pepe Flock: Pingpong · **Nombre público de la web:** Ping-Nord-Pong
> **Qué es:** ranking ELO público de ping-pong del Campus Nord (UPC, Barcelona), con cuentas, confirmación de resultados por el rival, rivalidades con emblemas, retos con chat y normativa oficial.
> **Idiomas:** español (por defecto), català, English, 中文 (simplificado), Deutsch.
> **Este documento es para Claude Code.** Síguelo por fases. No pases a la siguiente fase sin cumplir sus criterios de aceptación.

---

## 0. Reglas para Claude Code

1. **El diseño está decidido.** Reproduce fielmente los tokens, tipografías, componentes y SVG de la sección 3. No inventes una estética nueva ni metas plantillas por defecto (ver 3.8).
2. **La seguridad va en la base de datos, no en el cliente.** Ningún cliente escribe ELO, estados de partido ni roles. Todo pasa por funciones RPC de Postgres con RLS activado (sección 7).
3. **Cada texto visible va en los archivos de traducción** desde el primer commit. No se acepta texto en duro en los componentes (sección 6).
4. **Haz tests de toda la lógica de ELO y de las políticas RLS** antes de construir la UI que depende de ellas.
5. **Guarda los mínimos datos posibles** (sección 8). Antes de añadir un campo nuevo a la base de datos, justifícalo en el PR.
6. Haz commits pequeños por funcionalidad, con la fase en el mensaje (`F2: confirmar partido + recálculo ELO`).
7. Crea un `CLAUDE.md` en la raíz con el resumen de las secciones 0, 3.1, 6 y 7 para que las sesiones futuras lo respeten.
8. **Usa el kit de diseño incluido (sección 0.1).** Los SVG, el generador del emblema y los tokens ya existen. Cópialos al proyecto en lugar de recrearlos.

### 0.1 Kit de diseño incluido (carpeta `design/`, junto a este plan)

| Archivo | Qué es | A dónde va en el proyecto |
|---|---|---|
| `design/tokens.css` | Tokens de color, radios, fuentes y foco (sección 3.1) | `app/styles/tokens.css`, mapeado en el `@theme` de Tailwind v4 |
| `design/emblem/emblem.js` | Generador del emblema cuervo contra serpiente: `pfEmblem`, `pfColors`, `pfRivalryState`, `pfBadges` y `pfEmblemSVG` (sección 3.6) | Pórtalo a `lib/emblem/` en TypeScript, añadiendo solo los tipos, sin cambiar la lógica |
| `design/emblem/preview-7-estados.png` y `design/emblem/ejemplos/estado_±N.svg` | Cómo debe verse cada estado con la semilla 7 | Úsalos como **snapshots de test**: la salida de `pfEmblemSVG(state, 7, 'AN', 'MA', 400)` debe coincidir con estos archivos |
| `design/svg/mesa-hero.svg` | Mesa del hero con la pelota y las palas animadas | Componente `<HeroTable />`, inline para poder animarlo |
| `design/svg/subrayado.svg` | Subrayado a mano bajo "Pong" | Inline en el hero |
| `design/svg/tres-botes.svg` | Trayectoria de "Del partido al ELO en tres botes" | Inline en la home |
| `design/svg/pelota-loader.svg` | Loader con la pelota botando | `<Loader />` y `loading.tsx` |
| `design/svg/oveja-pingpong.svg` y `favicon-oveja.svg` | Logo de la oveja Pepe Flock: Pingpong, con y sin letras | `public/brand/` y `app/icon.svg` |
| `design/logo/logo_pmd.py` | Script de la marca para regenerar la oveja (requiere `glyphs_spacegrotesk_bold.json` solo para la versión horizontal) | `design/` (no se despliega) |
| `design/reference/*.dc.html` | Maquetas del lienzo aprobado: Main (home), Rivalidad, Apuntar, Emblemas y Emblema | Solo referencia visual de medidas, textos y estructura. **No es código de producción** |

---

## 1. Stack

| Capa | Elección | Motivo |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript estricto** | SSR para que el ranking público sea rápido e indexable |
| UI | **Tailwind CSS v4** con los tokens propios de la sección 3; **shadcn/ui solo como base de accesibilidad** (Dialog, Popover, Tabs), restilado entero | Evitar el aspecto de plantilla |
| Base de datos, auth y realtime | **Supabase** (Postgres, Auth con enlace mágico, Realtime, pg_cron), **región UE (Frankfurt)** | RLS, funciones SQL y tiempo real para el chat |
| i18n | **next-intl** | Rutas por idioma y mensajes ICU |
| Validación | **zod** compartido entre cliente y servidor | Una sola fuente de verdad |
| Emails | **Solo el de login**, enviado por Supabase Auth (plantilla en los 5 idiomas). **No hay emails de aviso**: los avisos son dentro de la web (5.3). Resend queda como mejora futura (sección 15) | Sin dominio propio ni servicios extra |
| Anti-bots | **Cloudflare Turnstile** en el registro y en el envío de reportes | Sin seguimiento de Google |
| Rate limiting | Tablas y funciones de Postgres (sección 9.3) y middleware de Next | Sin servicios extra al principio |
| Gráficos | SVG propio. **Rough.js** opcional para el gráfico de ELO con trazo a mano | Coherencia con el estilo |
| Tests | **Vitest** (lógica), **pgTAP** o SQL de prueba (RLS y RPC), **Playwright** (e2e) | |
| Hosting | **Vercel** (región `fra1`) | |

---

## 2. Mapa de la web

| Ruta (`/[locale]/…`) | Acceso | Contenido |
|---|---|---|
| `/` | Público | Hero, cifras, ranking resumido, rivalidad de la semana, "Del partido al ELO en tres botes", acceso a la normativa |
| `/ranking` | Público | Ranking completo. Filtros 1v1/2v2 y Activos/Histórico. Búsqueda por alias |
| `/jugador/[alias]` | Público | Perfil: ELO, gráfico de ELO, V-D, rachas, rivales distintos, rivalidades, últimos partidos y botón Retar |
| `/rivalidad/[aliasA]/[aliasB]` | Público | Emblema, cara a cara, desglose por formato, últimos partidos |
| `/normativa` | Público | Reglas oficiales en versión de bolsillo |
| `/entrar` | Público | Login con enlace mágico al email de la uni |
| `/apuntar` | Usuario | Formulario para registrar un partido |
| `/pendientes` | Usuario | Partidos que tienes que aceptar o rechazar, y los que has enviado |
| `/retos` y `/retos/[id]` | Usuario | Retos y chat de cada reto |
| `/ajustes` | Usuario | Alias, icono, idioma, exportar datos, borrar cuenta |
| `/legal/terminos`, `/legal/privacidad`, `/legal/cookies` | Público | Textos legales |
| `/admin` | Moderador o admin | Reportes, anular partidos, limitar o bloquear cuentas, registro de auditoría |

Navegación principal: Ranking · Rivalidades · Retos · Normativa · botón **Entrar** o avatar. Selector de idioma en la cabecera y en el pie.

---

## 3. Sistema de diseño (fijado por el artefacto aprobado)

### 3.1 Tokens

```css
:root {
  /* Fondo y superficies */
  --pf-bg: #0A1020;          /* fondo general: "mesa de noche" */
  --pf-surface: #0D1628;     /* tarjetas, tabla, bandas */
  --pf-surface-2: #121D33;   /* pills, chips, campos */
  --pf-line: #1C2A44;        /* bordes y separadores */
  --pf-line-strong: #2E4366; /* bordes de botón secundario */
  --pf-table: #0F2A4A;       /* azul mesa (banda de normativa) */
  --pf-table-hi: #174A82;    /* degradado de la mesa del hero */
  --pf-chalk: #E8EEF7;       /* líneas de la mesa y la red */

  /* Texto */
  --pf-text: #F2F5FA;
  --pf-text-2: #C9D3E3;
  --pf-muted: #9AA8BD;       /* cumple 4.5:1 sobre --pf-bg */
  --pf-faint: #7D8BA1;       /* solo texto ≥12px secundario */

  /* Acentos */
  --pf-ball: #FF7A1A;        /* naranja pelota: CTA y acento principal */
  --pf-ball-hi: #FF8A33;     /* enlaces y etiquetas */
  --pf-red: #E5383B;         /* goma roja: jugador A (marcadores y palas) */
  --pf-red-dark: #9E1F24;
  --pf-red-text: #FF6B6E;
  --pf-blue: #2F80ED;        /* goma azul: jugador B */
  --pf-blue-dark: #1D5BB0;
  --pf-blue-text: #5AA2FF;
  --pf-win: #3DDC84;         /* subidas de ELO */
  --pf-gold: #FFC24B; --pf-silver: #D7DEE8; --pf-bronze: #E39A5F;

  /* Marca Pepe Flock: Pingpong (oveja) */
  --pf-sheep-wool: #F2B705;
  --pf-sheep-head: #FFE38A;  /* también color de las notas a mano */

  /* Forma */
  --pf-radius-pill: 999px;
  --pf-radius-card: 20px;
  --pf-radius-lg: 28px;
  --pf-radius-field: 14px;
}
```

El tema es **solo oscuro** y forma parte de la identidad. Si algún día se añade un tema claro, se hará con los mismos nombres de token.

### 3.2 Tipografía

| Uso | Fuente | Pesos |
|---|---|---|
| Titulares, logotipo textual, números grandes en contorno | **Bricolage Grotesque** | 500, 800 |
| Texto de interfaz | **Manrope** | 400, 600, 700, 800 |
| ELO, marcadores, deltas, etiquetas en mayúscula | **JetBrains Mono** | 500, 700 |
| Notas a mano (tiza) | **Caveat** | 700 |
| Chino (todas las anteriores) | **Noto Sans SC** como alternativa. Para las notas a mano, **Ma Shan Zheng** | |

- Hero: `clamp(52px, 8vw, 112px)`, `line-height .9`, `letter-spacing -3px`, con el texto partido en tres líneas: **Ping- / Nord- / Pong**. Los guiones van en `--pf-ball`.
- Hay un **subrayado a mano** naranja bajo "Pong" (SVG de la sección 3.6).
- Las etiquetas de sección van en JetBrains Mono, 13px, mayúsculas, `letter-spacing 1.5px` y color `--pf-ball-hi`.
- Carga las fuentes con `next/font`, con subsets por idioma (latin, latin-ext para catalán y alemán, chinese-simplified).

### 3.3 Logo y marca

- **Logo:** la oveja Pepe Flock. Ya está generada en `design/svg/oveja-pingpong.svg` y `design/svg/favicon-oveja.svg`. Para regenerarla, usa `design/logo/logo_pmd.py`:

```bash
python3 logo_pmd.py --wool "#F2B705" --head "#FFE38A" --bg "#0A1020" --paper "#0A1020" \
  --slot-ink "#0A1020" \
  --icon-svg "<circle cx='15' cy='16' r='8'/><path d='M20.7 21.7 L27 28'/><circle cx='27.5' cy='9.5' r='2.2' fill='#0A1020'/>" \
  --size 64 -o public/brand/oveja-pingpong.svg
python3 logo_pmd.py ... --no-letters --size 32 -o public/brand/favicon.svg
```

- **Cabecera:** oveja de 44px y el texto **Ping-Nord-Pong** en Bricolage 800, con los guiones en naranja.
- **Pepe Flock aparece poco:** solo en el pie, como "un proyecto de Pepe Flock" en 12px y `--pf-faint`, y en los metadatos.
- **"UPC" y "Campus Nord"** se usan solo como referencia de lugar. No uses el logo de la UPC. Añade un aviso en el pie: *"Proyecto de estudiantes, no oficial de la UPC."* (ver 8.4).

### 3.4 Componentes

| Componente | Especificación |
|---|---|
| Botón primario | Pill, fondo `--pf-ball`, texto `--pf-bg` 700, padding `16px 26px`, altura mínima 44px |
| Botón secundario | Pill, borde 1.5px `--pf-line-strong`, texto `--pf-text` |
| Segmentado (1v1/2v2, Activos/Histórico) | Contenedor pill `--pf-surface-2` con padding 4px. La opción activa lleva fondo naranja. `aria-pressed` |
| Pills de formato (a 5/7/11/21, 1 set/Bo3/Bo5/Bo7) | Rejilla de 4 columnas, radio 14px, altura 48px. Activa en naranja, inactiva con borde |
| Tabla de ranking | Fondo `--pf-surface`, radio 20px y `overflow-x:auto`. Columnas: #, Jugador (avatar de iniciales + alias + chip "provisional"), ELO (mono 18px), Últ. 7 días (verde, rojo o gris), V–D, Racha y botón Retar |
| Avatar | Círculo con iniciales sobre un color de la paleta de avatar (abajo). Sin fotos |
| Chips | Pill de 12–13px y 700. Variantes: neutro (`--pf-surface-2`) y némesis (fondo `#2A1416`, texto `#FF9EA0`) |
| Notas a mano | Caveat 700, 26–28px, `--pf-sheep-head`, `rotate(-2deg…-4deg)`. Máximo una por sección |
| Números de pasos | Bricolage 800, 64px, `color: transparent` y `-webkit-text-stroke: 2px var(--pf-ball)`, con alturas escalonadas (0, 28, 56px) |
| Marcador | Mono 700. Rojo para A, azul para B y un guion en `#4A5B78` |

Paleta de avatar: `#FF6B6E #5AA2FF #FFC24B #3DDC84 #C18CFF #FF9A5A #7D8BA1`. Asigna el color por hash del id, no al azar en cada render.

### 3.5 Pantallas aprobadas (artefacto)

1. **Home + ranking** (escritorio, fluida, contenedor de 1200px como máximo). En orden:
   - Navegación.
   - Hero: texto a la izquierda y mesa animada a la derecha, con la nota "aquí se resuelven las rivalidades ↑".
   - Banda de cifras (datos reales de la BD, nunca inventados).
   - Ranking con filtros.
   - Rivalidad de la semana: emblema y stats.
   - "Del partido al ELO en tres botes": trayectoria de la pelota con botes sobre dos redes y pasos **Juega / Apunta / El otro confirma**.
   - Banda azul de normativa.
   - Pie.
2. **Rivalidad (móvil 390px):** volver, marca, emblema grande, marcador `9 – 6` con alias y ELO, chips, "Por formato" (a 5/7/11/21), "Últimos partidos" y el CTA fijo abajo "X, pide la revancha".
3. **Apuntar partido (móvil):** modalidad, rival (autocompletar por alias), puntos por set, sets, editor de sets, "Peso del formato m = 0,58" en directo y el CTA "Enviar a X para confirmar", con la nota "Sin su confirmación en 48 h, el partido caduca."
4. **Emblemas:** cuervo contra serpiente en 7 estados, con colores y papeles aleatorios (sección 3.6).

### 3.6 SVG y animaciones

**Mesa del hero** (`viewBox 0 0 560 360`, ya hecha en `design/svg/mesa-hero.svg`):
- Polígono de mesa en perspectiva `70,250 490,250 440,150 120,150`, con degradado de `--pf-table-hi` a `--pf-table` y borde `--pf-chalk` de 4px.
- Red, patas y sombra.
- Pelota con dos grupos anidados: `translateX` de 0 a 330px (1.1s, alterno) y bote `translateY` de 0 a −120px (0.55s).
- Palas roja y azul que giran ±24° con desfase.

**Emblema de rivalidad: cuervo contra serpiente.** El código está hecho y probado en `design/emblem/emblem.js`: es un generador puro, sin dependencias. **No lo redibujes: pórtalo tal cual a TypeScript** (solo tipos) en `lib/emblem/`.

- **Papeles y colores aleatorios.**
  - Al crearse una rivalidad (al llegar a 5 partidos) se sortea quién es el **cuervo** y quién la **serpiente**, y una semilla `seed`.
  - `pfColors(seed)` genera dos tonos bien separados: el cuervo en un tono y la serpiente en otro, cada uno con sombra, base y brillo.
  - Los colores salen en **hex** a propósito, para que funcionen también en emails y en imágenes OG.
  - Papel y semilla se guardan en `rivalry_meta` (sección 4) y **no cambian nunca**.
- **7 estados.** `pfRivalryState(victoriasCuervo, victoriasSerpiente)` devuelve un valor de −3 a +3, visto desde el cuervo:

| Diferencia en el cara a cara | Estado | Escena |
|---|---|---|
| 0–1 | `0` central | El cuervo picotea el cuello de la serpiente mientras ella se le enrosca. Los dos con la boca abierta |
| 2–3 | `±1` gana uno | Cuervo: la agarra con las garras. Serpiente: le da una vuelta y le muerde |
| 4–6 | `±2` gana bastante más | Cuervo: la levanta mientras se retuerce y sisea. Serpiente: lo envuelve y lo tumba de lado |
| ≥7 **y** ≥70 % de victorias del que gana | `±3` dominio absoluto | Cuervo: enorme, ocupa casi todo el emblema con las alas desplegadas en abanico, el pico abierto graznando y las garras clavadas en la serpiente, que queda aplastada abajo, con los ojos cerrados y apagada (opacidad 0,72). Serpiente: el cuervo cuelga boca abajo, enroscado, con las alas caídas |

En `±3`, el icono del que manda es más grande (radio 22 en lugar de 17) y el del perdedor casi desaparece (opacidad 0,35). Así el dominio absoluto se distingue de un vistazo del `±2`.

- Si la diferencia es de 7 o más pero no llega al 70 %, el estado se queda en ±2.
- **Render:**
  - `pfEmblem(state, colors)` devuelve `shapes` (paths ya ordenados: el orden del array es el z-index), `crowHead` y `snakeHead`.
  - El `viewBox` es fijo, `-10 -50 420 560`, con proporción 3:4.
  - `pfBadges()` coloca las **iniciales del que manda en su cabeza**: un círculo grande y nítido para el que manda, y uno pequeño y apagado para el otro. En el estado central, los dos son iguales.
  - `pfEmblemSVG()` devuelve el SVG entero como texto, para OG images, emails y tests de snapshot.
- **Componente `<RivalryEmblem crowIni snakeIni state seed size />`:**
  - Usa `useMemo` sobre `(state, seed)`, porque el cálculo genera unos 300 paths.
  - Animación de "respiración": `translateY` 0→4px, 3.2s.
  - **Cambio de estado:** cuando un partido confirmado cambia el estado, se hace un *crossfade* con escala (0.96→1) de 600ms. Si cambia de signo (vuelco del dominio), se añade un destello naranja de 300ms.
  - Respeta `prefers-reduced-motion`.
- **Tamaños:**
  - 400px en escritorio, 226–320px en tarjetas y en la ficha móvil.
  - Por debajo de 120px no uses el emblema completo: en listas, muestra un mini icono (cabeza de cuervo o de serpiente con el color de la pareja).
- **Accesibilidad:** `role="img"` con una etiqueta tipo "Cuervo (AN) contra serpiente (MA): el cuervo va por delante".
- **Referencia visual:**
  - `design/emblem/preview-7-estados.png` y `design/emblem/ejemplos/estado_*.svg`.
  - Versión interactiva en `design/reference/Emblemas.dc.html` y componente `design/reference/Emblema.dc.html`. Son maquetas del lienzo: úsalas solo como referencia, no como código de producción.
- Inspirado en fotos reales, pero el dibujo es propio. No copies obras ajenas.

**Otras animaciones SVG:**
- Loader: pelota botando.
- Al confirmar un partido: la pala golpea y el delta de ELO sube flotando (`+18`).
- Subrayado a mano del hero: `M4 14 C40 6 70 20 104 11 C136 3 170 19 216 8`, con trazo de 6px redondeado.
- Trayectoria de los tres botes: `M30 100 Q215 -30 400 100 Q600 -30 800 100 Q985 -30 1170 100`, con `stroke-dasharray 2 10`.

**Respeta `prefers-reduced-motion`:** todas las animaciones se detienen.

### 3.7 Accesibilidad

- Contraste AA en todo, verificado con los tokens de arriba.
- Botones reales, `aria-pressed` en los segmentados y `aria-label` en los botones de solo icono.
- Los SVG decorativos llevan `aria-hidden`. Los emblemas llevan `role="img"` y una etiqueta, por ejemplo "Ana domina a Marc 9–6".
- Foco visible: anillo de 2px en `--pf-ball`. **Nunca `outline: none` sin alternativa.**
- Objetivos táctiles de 44px como mínimo. Los formularios llevan `<label>` real.

### 3.8 Anti "hecho por IA" (obligatorio)

Pasa la UI por la checklist de [avoid-ai-design](https://github.com/funboy322/avoid-ai-design) y el skill *no-slop* de [zero-slop](https://github.com/eid0lon/zero-slop) al final de cada fase de UI. El objetivo es **cero señales P0**. En concreto:

- Nada de degradados morados o azules, glassmorphism, iconos de stock tipo Sparkles o Rocket, emojis como viñetas ni textos tipo "Potencia tu experiencia".
- Nada de cuadrículas de tres tarjetas idénticas, `hover:scale` en todas las tarjetas ni fade-in idéntico en cada sección.
- **No inventes cifras.** Si no hay datos, muestra un estado vacío con personalidad, por ejemplo "Todavía nadie ha pisado la mesa. ¿Serás el primero?".
- Los textos se escriben en tono de pasillo de facultad, no de SaaS.
- Rough.js o [wired-elements](https://github.com/rough-stuff/wired-elements) solo para detalles (gráfico de ELO, normativa), nunca en toda la UI.

---

## 4. Modelo de datos (Supabase / Postgres)

```sql
-- Enums
create type match_mode   as enum ('1v1','2v2');
create type match_status as enum ('pending','confirmed','rejected','expired','voided');
create type user_role    as enum ('user','mod','admin');
create type user_status  as enum ('active','limited','banned');
create type challenge_status as enum ('open','accepted','declined','cancelled','done');
create type report_status as enum ('open','resolved','dismissed');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  alias citext unique not null check (alias ~ '^[A-Za-z0-9._-]{3,20}$'),
  avatar_color smallint not null default 0,
  locale text not null default 'es' check (locale in ('es','ca','en','zh','de')),
  elo_single int not null default 1000,
  elo_double int not null default 1000,
  games_single int not null default 0,
  games_double int not null default 0,
  last_played_at timestamptz,
  role user_role not null default 'user',
  status user_status not null default 'active',
  limited_until timestamptz,
  terms_version text not null,          -- versión de términos aceptada
  terms_accepted_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  mode match_mode not null,
  points_target smallint not null check (points_target in (5,7,11,21)),
  best_of smallint not null check (best_of in (1,3,5,7)),
  win_by_two boolean not null default true,
  winner_team char(1) check (winner_team in ('A','B')),
  status match_status not null default 'pending',
  created_by uuid not null references profiles,
  played_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '48 hours',
  confirmed_at timestamptz,
  confirmed_by uuid references profiles,
  reject_reason text check (char_length(reject_reason) <= 200),
  challenge_id uuid,                     -- opcional: si viene de un reto
  created_at timestamptz not null default now()
);

create table match_players (
  match_id uuid references matches on delete cascade,
  profile_id uuid references profiles on delete set null,
  team char(1) not null check (team in ('A','B')),
  elo_before int, elo_after int, delta int,
  weight_w numeric(4,3), weight_m numeric(4,3), k smallint,  -- para auditoría y transparencia
  primary key (match_id, profile_id)
);

create table match_sets (
  match_id uuid references matches on delete cascade,
  set_no smallint not null check (set_no between 1 and 7),
  score_a smallint not null check (score_a between 0 and 99),
  score_b smallint not null check (score_b between 0 and 99),
  primary key (match_id, set_no)
);

create table challenges (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references profiles on delete cascade,
  to_id uuid not null references profiles on delete cascade,
  mode match_mode not null default '1v1',
  proposed_at timestamptz,
  place text check (char_length(place) <= 80),
  status challenge_status not null default 'open',
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);

create table messages (
  id bigserial primary key,
  challenge_id uuid not null references challenges on delete cascade,
  sender_id uuid references profiles on delete set null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create table blocks (blocker uuid references profiles on delete cascade,
                     blocked uuid references profiles on delete cascade,
                     primary key (blocker, blocked));

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles on delete set null,
  target_profile uuid references profiles on delete cascade,
  target_match uuid references matches on delete cascade,
  target_message bigint references messages on delete cascade,
  reason text not null check (reason in ('fake_result','harassment','spam','impersonation','offensive_alias','other')),
  details text check (char_length(details) <= 500),
  status report_status not null default 'open',
  resolved_by uuid references profiles, resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Emblema de rivalidad: papel (cuervo/serpiente) y semilla de color sorteados una vez
create table rivalry_meta (
  player_low  uuid not null references profiles on delete cascade,   -- el menor de los dos ids
  player_high uuid not null references profiles on delete cascade,
  crow_id     uuid not null,                                         -- uno de los dos, sorteado
  seed        int  not null default floor(random() * 2147483647)::int,
  prev_state  smallint,                                              -- para animar el cambio de estado
  created_at  timestamptz not null default now(),
  primary key (player_low, player_high),
  check (player_low < player_high),
  check (crow_id in (player_low, player_high))
);

create table notifications (            -- avisos dentro de la web (5.3.1)
  id bigserial primary key,
  profile_id uuid not null references profiles on delete cascade,
  kind text not null check (kind in ('match_pending','match_confirmed','match_rejected','challenge_new','challenge_accepted')),
  ref_id uuid, read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (profile_id, read_at, created_at desc);

create table audit_log (
  id bigserial primary key,
  actor_id uuid, action text not null, target text, meta jsonb,
  created_at timestamptz not null default now()
);

create table rate_events (               -- para límites por usuario (sección 9.3)
  profile_id uuid not null, kind text not null, created_at timestamptz not null default now()
);
create index on rate_events (profile_id, kind, created_at desc);
```

**Vistas públicas** (solo lectura, sin emails):
- `public_profiles`: alias, color, ELOs, partidos, V-D, racha, `is_provisional` (menos de 10 partidos en esa modalidad) e `is_active` (jugó en los últimos 30 días).
- `public_matches`: solo los confirmados.
- `rivalries`: pares 1v1 con 5 o más partidos confirmados. Incluye victorias de cada uno, diferencia, `crow_id`, `seed` y `emblem_state` (−3 a +3, sección 5.4), racha, último partido y desglose por `points_target`. La lectura pública de `rivalry_meta` se hace solo a través de esta vista; en la tabla, RLS sin políticas para clientes.
- `elo_history`: serie por jugador a partir de `match_players`.

---

## 5. Lógica de juego

### 5.1 ELO

Para cada jugador, dentro de la función `confirm_match`:

```
E  = 1 / (1 + 10^((R_rival − R_propio) / 400))      # en 2v2, R = media del equipo
S  = 1 si gana, 0 si pierde
K  = 32 si partidos_en_esa_modalidad < 20, si no 20
n  = partidos CONFIRMADOS entre los mismos jugadores (mismo conjunto de 4 en 2v2)
     en los 7 días anteriores a played_at
w  = max(0.2, 1 / (1 + 0.5·n))                       # anti-farmeo con el mismo rival
P  = points_target × ceil(best_of / 2)
m  = min(1, sqrt(P / 33))                            # partido corto = menos peso
ΔR = round(K · w · m · (S − E))
```

- En 2v2, cada jugador del equipo recibe la ΔR de su equipo, calculada con su propia K.
- El 1v1 y el 2v2 tienen ELO **separados**.
- Guarda `k`, `w`, `m`, `elo_before`, `elo_after` y `delta` en `match_players`. El perfil muestra "por qué subí 9 y no 18".
- **Tests (Vitest y SQL) con casos fijos:**
  - Rivales con el mismo ELO.
  - 400 puntos de diferencia.
  - n = 0, 1, 2, 10.
  - Todos los formatos de la tabla de m.
  - 2v2.
  - Jugador nuevo (K = 32) contra veterano.

| Formato | P | m |
|---|---|---|
| 1 set a 5 | 5 | 0,39 |
| 1 set a 7 | 7 | 0,46 |
| 1 set a 11 | 11 | 0,58 |
| 1 set a 21 | 21 | 0,80 |
| Bo3 a 11 | 22 | 0,82 |
| Bo5 a 11 o más | ≥33 | 1 |

### 5.2 Validación del resultado

La validación se hace con zod en el cliente **y** se repite en SQL:

- El número de sets está entre `ceil(best_of/2)` y `best_of`. El partido acaba en cuanto un equipo llega a `ceil(best_of/2)` sets, así que no puede haber sets después.
- Cada set lo gana quien llega a `points_target`. Si `win_by_two` está activo, al llegar a `points_target−1` iguales se sigue hasta sacar 2 de diferencia, y el set ganado acaba exactamente con esa diferencia (11-9, 12-10, pero no 13-9). Sin `win_by_two`, el ganador termina exactamente en `points_target`.
- No hay empates.
- En 1v1, los jugadores son distintos. En 2v2 hay 4 jugadores distintos.
- El creador tiene que ser uno de los jugadores.
- Nadie puede estar bloqueado por otro jugador del partido.

### 5.3 Flujo de un partido

1. **Apuntar:** `create_match(...)` RPC. Crea el partido en `pending` con `expires_at = now() + 48h`. Avisa al rival (o a los dos rivales en 2v2) por notificación en la app (contador en la navegación y banner al entrar, ver 5.3.1).
2. **Confirmar:** `confirm_match(id)` RPC. Solo puede llamarla un jugador del **equipo contrario** al creador (en 2v2 basta uno). La función:
   - Bloquea las filas con `select … for update` de los perfiles implicados, ordenadas por id para evitar deadlocks.
   - Calcula el ELO, escribe `match_players` y actualiza `profiles`.
   - Pasa el partido a `confirmed` y registra en `audit_log`.
   - Todo ocurre en una sola transacción.
3. **Rechazar:** `reject_match(id, reason)`. Las razones son *resultado incorrecto*, *no jugamos* u *otro*. Con "resultado incorrecto", el rival puede enviar **una única contrapropuesta**, que crea un partido nuevo en `pending` en dirección contraria.
4. **Caducar:** un trabajo de **pg_cron** cada 15 minutos pasa a `expired` los partidos pendientes vencidos. No cuentan.
5. **Anular (moderación):** `void_match(id, motivo)` y luego `recompute_elo_from(timestamp)`, que vuelve a calcular la historia confirmada en orden desde esa fecha. Es idempotente y se registra en `audit_log`.

#### 5.3.1 Avisos dentro de la web (sustituyen a los emails)

- Contador rojo en la navegación con los partidos que tienes que confirmar y los retos nuevos (`/pendientes`, `/retos`). Se actualiza con Supabase Realtime.
- Banner al entrar: "Tienes 2 partidos por confirmar. Caducan en 31 h", con un botón directo.
- En cada partido pendiente se muestra el tiempo que queda hasta que caduca.
- Botón **Copiar enlace** en el partido enviado, para que quien lo apunta se lo pase al rival por WhatsApp o en persona.
- Tabla `notifications` (id, profile_id, kind, ref_id, read_at, created_at) con RLS: solo el dueño lee y marca como leído. Se borra a los 30 días.

**El reto no es obligatorio.** Se puede apuntar un partido sin reto previo. Si viene de un reto, se guarda `challenge_id` y el reto pasa a `done`.

### 5.4 Rivalidades y etiquetas

- Hay rivalidad cuando una pareja suma **5 o más** partidos 1v1 confirmados (constante configurable).
- **Al nacer la rivalidad**, el trigger que la detecta inserta una fila en `rivalry_meta`. Ahí se sortea, con `gen_random_uuid()` o `random()`, quién es el cuervo, y se guarda una `seed` aleatoria. No cambian nunca, ni siquiera si se recalcula el ELO.
- **Estado del emblema** (−3 a +3, visto desde el cuervo), con `pfRivalryState(victoriasCuervo, victoriasSerpiente)`:
  - Diferencia 0–1: central (0).
  - 2–3: ±1.
  - 4–6: ±2.
  - 7 o más y ≥70 % de victorias del que gana: ±3.
- La vista `rivalries` debe devolver `crow_id`, `seed`, las victorias de cada uno y `emblem_state`, calculado también en SQL con la misma regla. Haz un test que compare el resultado de TS y SQL.
- Cada partido cuenta 1, sea cual sea el formato. El desglose por formato es solo informativo.
- **Etiquetas por jugador:**
  - *Némesis:* el rival con peor balance para ti (mínimo 5 partidos).
  - *Víctima favorita:* el rival con mejor balance para ti.
  - *Rivalidad igualada:* diferencia ±1 con 8 o más partidos.
- **"Rivalidad de la semana"** en la home: la rivalidad con más partidos confirmados en los últimos 7 días. En caso de empate, la de menor diferencia.
- Cuando un partido cambia el `emblem_state`, guarda el estado anterior en `rivalry_meta.prev_state` para animar la transición (3.6) la próxima vez que alguno de los dos abra la rivalidad.

### 5.5 Ranking

- **Pestañas:** 1v1 y 2v2. **Filtros:** *Activos* (jugaron en los últimos 30 días y no son provisionales) e *Histórico* (todos, incluidos inactivos).
- Los jugadores provisionales (menos de 10 partidos) aparecen con su chip, pero no entran en el top 3 ni en las medallas.
- "Últ. 7 días" es la suma de deltas de los partidos confirmados en los últimos 7 días.

### 5.6 Retos y chat

- Desde un perfil se puede retar indicando día y hora (opcional), lugar (opcional, texto) y modalidad.
- El chat solo existe dentro de un reto. Usa Supabase Realtime con RLS, de modo que solo los dos participantes lo leen.
- Texto plano sin enlaces: las URL se muestran sin hacerlas clicables. Máximo 500 caracteres por mensaje.
- El chat se cierra 7 días después de cerrarse el reto. Los mensajes se borran a los 90 días (ver 8.3).
- Bloquear a alguien cierra los retos abiertos con esa persona y le impide retarte, escribirte o apuntar partidos contigo.

### 5.7 Normativa (`/normativa`)

Resumen de las reglas ITTF, traducido a los 5 idiomas:
- Sets a 11, ganando por 2.
- El saque cambia cada 2 puntos, y desde 10-10 en cada punto.
- La pelota se lanza desde la palma abierta y sube al menos 16 cm.
- En dobles el saque va en diagonal, de la mitad derecha a la mitad derecha, y los jugadores golpean alternos.
- *Let* en el saque que toca la red.

Añade una sección **"Reglas de la casa Ping-Nord-Pong"**: formatos permitidos, la confirmación obligatoria y el juego limpio. Incluye un **enlace a la fuente oficial (ITTF Handbook)** y la fecha de revisión. Muestra una tarjeta de recordatorio compacta en `/apuntar`.

---

## 6. Internacionalización (es · ca · en · zh · de)

- **next-intl** con rutas `/es`, `/ca`, `/en`, `/zh`, `/de`. El idioma por defecto es `es`.
- Detección inicial por `Accept-Language`. Después manda la elección guardada en `profiles.locale` (o en una cookie si el usuario no ha entrado).
- Mensajes en `messages/{es,ca,en,zh,de}.json`, organizados por espacios de nombres (`nav`, `home`, `ranking`, `match`, `rivalry`, `rules`, `legal`, `errors`, `email`).
- Usa **ICU** para plurales y variables: `{count, plural, one {# partido} other {# partidos}}`.
- Fechas, números y horas con `Intl` según el locale. ELO sin separador de miles.
- **CI con un script que falla** si falta una clave en algún idioma o si hay claves sobrantes.
- **Chino:** `lang="zh-Hans"`, fuentes alternativas Noto Sans SC y Ma Shan Zheng. Revisa los cortes de línea del hero, porque en chino el título sigue siendo "Ping-Nord-Pong", pero las frases de apoyo cambian de longitud.
- **Alemán:** las palabras largas pueden romper pills y botones. Usa `hyphens: auto` y comprueba la UI a 390px.
- Atributos `hreflang` en el `<head>` y sitemap por idioma.
- El email de login (plantilla de Supabase Auth) en los 5 idiomas, con el idioma elegido en el momento de pedir el enlace.
- **Textos legales** en los 5 idiomas, con una nota: *"En caso de discrepancia, prevalece la versión en español."*
- Las traducciones iniciales las puede hacer Claude, pero marca `ca`, `zh` y `de` con `// TODO: revisión nativa` en un `TRANSLATIONS.md` hasta que las revise un hablante nativo.

---

## 7. Seguridad

### 7.1 Autenticación

- **Enlace mágico por email**, sin contraseñas.
- **Lista de dominios permitidos** configurable por variable de entorno (`ALLOWED_EMAIL_DOMAINS`), con los dominios de la UPC. ⚠️ Verifica cuáles son los dominios reales de estudiantes y personal antes de lanzar.
- Comprueba el dominio en el servidor, con un hook de Supabase Auth o una edge function de signup. No basta con el cliente.
- Turnstile en el formulario de entrada.
- Mensaje neutro tras pedir el enlace ("Si el email es válido, te llegará un enlace") para no revelar qué cuentas existen.
- Sesiones en cookies `httpOnly`, `Secure` y `SameSite=Lax` mediante `@supabase/ssr`. Renovación automática y cierre de sesión en todos los dispositivos desde Ajustes.
- La primera vez, onboarding obligatorio: elegir alias y aceptar los términos (se guardan versión y fecha).

### 7.2 Base de datos (RLS)

- **RLS activado en todas las tablas.** Por defecto, todo denegado.
- `profiles`: el dueño puede leer y actualizar solo `alias`, `avatar_color` y `locale`, con una política que restringe columnas. Los demás campos solo cambian vía RPC con `security definer`. El público lee únicamente la vista `public_profiles`.
- `matches`, `match_players` y `match_sets`: el público solo ve los `confirmed`. Los jugadores ven también sus `pending`, `rejected` y `expired`. **No hay insert ni update directos.** Todo pasa por `create_match`, `confirm_match`, `reject_match` y `void_match`.
- `challenges` y `messages`: solo los dos participantes. Insert de mensajes solo si el reto está abierto y no hay bloqueo.
- `notifications`: cada usuario lee y marca como leídos solo los suyos. Las filas se crean únicamente desde las RPC.
- `reports`: insert para cualquier usuario autenticado. Lectura solo para el autor del reporte y para moderadores.
- `audit_log` y `rate_events`: solo moderación y admin, y las funciones internas.
- **Cada RPC `security definer`:** fija `search_path = public, pg_temp`, comprueba `auth.uid()`, el estado `active` o `limited` y los límites. **Escribe tests de RLS** que intenten saltárselas: otro usuario confirmando, auto-confirmación, editar ELO o leer el chat ajeno.

### 7.3 Aplicación web

- Valida todas las entradas con zod en el servidor, aunque ya se validen en el cliente.
- **Evita XSS:** nunca uses `dangerouslySetInnerHTML` con contenido de usuario. Alias y chat siempre como texto. Normaliza los alias con NFKC y rechaza caracteres invisibles o confundibles.
- **Cabeceras:**
  - CSP estricta con nonce. Orígenes permitidos: el propio, Supabase, Turnstile y las fuentes autoalojadas por `next/font`.
  - `X-Frame-Options: DENY` (o `frame-ancestors 'none'`).
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Permissions-Policy` restrictiva.
  - HSTS.
- Protección CSRF: server actions de Next con comprobación de origen. Las RPC van con el JWT de la sesión.
- Secretos solo en variables de entorno del servidor. La `service_role` **nunca** llega al cliente.
- `npm audit` y Dependabot en CI. Bloquea versiones con lockfile.
- Logs sin datos personales: usa ids, nunca emails.
- Backups diarios de Supabase y un procedimiento de restauración probado una vez.

### 7.4 Checklist de seguridad antes de lanzar

- [ ] Tests de RLS en verde (sección 10).
- [ ] Sin `service_role` en el bundle (comprobado con un grep en el build).
- [ ] CSP sin `unsafe-inline` en scripts.
- [ ] Dominio de email validado en el servidor.
- [ ] Límites de la sección 9.3 activos.
- [ ] Panel de admin accesible solo con `role` mod o admin (comprobación en el servidor).
- [ ] Revisión con la checklist del OWASP Top 10.

---

## 8. Privacidad, términos y cumplimiento (RGPD / LOPDGDD)

> ⚠️ Los textos legales los redacta Claude como **borrador**. Antes de abrir la web al público, que los revise alguien con conocimientos legales (por ejemplo, el servicio jurídico o la delegación de estudiantes). No es asesoramiento legal.

### 8.1 Datos que se guardan (minimización)

| Dato | Para qué | Público |
|---|---|---|
| Email de la uni | Login y avisos | ❌ Nunca |
| Alias y color de avatar | Identidad en el ranking | ✅ |
| ELO, partidos, sets y fechas | El servicio en sí | ✅ (solo los confirmados) |
| Retos y mensajes | Quedar para jugar | ❌ Solo los dos participantes |
| Reportes y bloqueos | Moderación | ❌ |
| Idioma y preferencias de aviso | Funcionamiento | ❌ |

**No se guardan** nombre real, foto, teléfono, ubicación, IP en la base de datos (solo en los logs técnicos del proveedor, con retención corta) ni analítica de terceros.

### 8.2 Política de privacidad (`/legal/privacidad`)

Debe incluir:
- Responsable y contacto: Pepe Flock y un email de contacto del proyecto.
- Finalidades y bases jurídicas:
  - Ejecución del servicio, aceptado al registrarse: cuenta, ranking y partidos.
  - Interés legítimo: seguridad y moderación.
- **Qué es público:** alias, ELO, estadísticas, partidos confirmados y rivalidades.
- Encargados del tratamiento: Supabase (UE) y Vercel. Indica las transferencias y garantías aplicables (cláusulas contractuales tipo o marco UE-EE. UU.).
- Plazos de conservación (8.3).
- Derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad, y cómo ejercerlos desde Ajustes o por email. Derecho a reclamar ante la **AEPD**.
- Edad mínima: **14 años** (LOPDGDD).

### 8.3 Conservación y derechos en la app

- **Exportar mis datos:** botón en Ajustes que descarga un JSON con el perfil, los partidos, los retos y los mensajes propios.
- **Borrar mi cuenta:**
  - Se borra el email y el perfil.
  - En los partidos confirmados, el jugador pasa a mostrarse como "Jugador eliminado", sin alias. Así se conserva la historia de sus rivales sin datos identificables.
  - Se borran sus mensajes.
  - El borrado es efectivo al momento, con un aviso de confirmación antes.
- Mensajes de chat: se borran a los 90 días (pg_cron).
- Partidos `pending`, `rejected` y `expired`: se borran a los 30 días.
- Cuentas inactivas durante 2 años: se borran automáticamente. Se informa de ello en la política de privacidad y en los términos (no se envía aviso por email).
- `rate_events`: 30 días. `notifications`: 30 días. `audit_log`: 1 año.

### 8.4 Términos y condiciones (`/legal/terminos`)

- Qué es el servicio: un proyecto de estudiantes **no oficial y sin afiliación con la UPC**, gratuito y sin garantías de disponibilidad.
- Requisitos: tener un email de la UPC y la edad mínima. Una cuenta por persona.
- **Normas de conducta:** no apuntar resultados falsos, no amañar partidos ni pactar resultados para inflar el ELO, no hacer cuentas múltiples, no acosar ni insultar en el chat o el alias, y no suplantar a otros.
- Moderación: se pueden anular partidos, recalcular el ELO, cambiar alias ofensivos, limitar o cerrar cuentas, siempre con aviso y una vía para recurrir por email.
- Contenido público: al usar el servicio, el alias y las estadísticas son visibles para cualquiera.
- Cambios en los términos: se avisa en la app y se pide aceptar la nueva versión (`terms_version`).
- Ley aplicable: la española.

### 8.5 Cookies (`/legal/cookies`)

- Solo cookies técnicas: sesión y preferencia de idioma. **Sin analítica ni publicidad, así que no hace falta banner de consentimiento.** Sí hace falta la página informativa y un enlace en el pie.
- Si en el futuro se añade analítica, que sea una sin cookies (por ejemplo Plausible o Umami) o, si no, un banner con rechazo tan fácil como la aceptación.

---

## 9. Anti-trolls y juego limpio

### 9.1 Barreras de entrada

- Solo emails de dominios de la UPC, con enlace mágico y Turnstile.
- Alias validados: lista de palabras prohibidas en los 5 idiomas, normalización NFKC y bloqueo de nombres reservados (`admin`, `mod`, `ping-nord-pong`, `pepe-flock`…).
- Cuentas nuevas en modo provisional: no entran en el top y su primer partido necesita confirmación como cualquier otro.

### 9.2 Confirmación obligatoria

- **Ningún partido cuenta sin la confirmación del equipo contrario.** Es el filtro principal.
- No puedes confirmar un partido que has creado tú. En 2v2 tampoco puede confirmarlo tu compañero.
- Caducidad a las 48 h.
- Contrapropuesta única tras un rechazo por "resultado incorrecto".

### 9.3 Límites (en las RPC, con `rate_events`)

| Acción | Límite |
|---|---|
| Partidos pendientes creados por ti a la vez | 3 |
| Partidos apuntados por día | 15 |
| Partidos confirmados contra el mismo rival en un día | 5 (además del peso *w* del ELO) |
| Retos abiertos enviados a la vez | 5 |
| Mensajes de chat | 20 por minuto y 300 por día |
| Reportes enviados | 10 por día |
| Peticiones de enlace mágico | 5 por hora y email, y límites por IP en el middleware |

### 9.4 Reputación automática

- **Ratio de rechazos:** si en 7 días un usuario tiene 3 o más partidos rechazados por "resultado incorrecto" o "no jugamos" y suponen más del 50% de los que ha creado, pasa a `limited` durante 7 días. En ese estado puede confirmar, pero no crear partidos ni retos. Se le avisa con el motivo.
- **Detección de amaños** (trabajo diario que solo **marca** para revisión, nunca castiga solo):
  - Una pareja con más de 10 partidos en 7 días.
  - Una pareja con resultados que se alternan de forma sistemática.
  - Una cuenta cuyo ELO viene en más de un 60% de un único rival.
  - Partidos con marcadores idénticos repetidos.
  - Varias cuentas nuevas que solo juegan entre sí.
- Las marcas aparecen en `/admin` con el contexto: historial de la pareja y deltas.

### 9.5 Reportes, bloqueos y moderación

- Botón **Reportar** en perfiles, partidos y mensajes, con motivos predefinidos y Turnstile.
- Botón **Bloquear** en perfiles y chats. Es inmediato y el bloqueado no recibe aviso.
- **Panel `/admin`:**
  - Cola de reportes y marcas automáticas.
  - Acciones: anular partido (con recálculo de ELO), forzar el cambio de un alias, limitar N días, banear y desbanear.
  - Cada acción exige un motivo y queda en `audit_log`.
- Los usuarios afectados reciben un aviso en la app con el motivo y el email de contacto para recurrir.
- Chat: filtro básico de insultos y spam en los 5 idiomas. Cuando salta, el mensaje se marca y se oculta tras un "Mostrar", no se borra en silencio. Los enlaces no son clicables.

---

## 10. Tests y calidad

- **Vitest:**
  - Funciones puras de ELO, validación de sets y cálculo de *m* y *w*, espejadas en TS para la UI y en SQL para la verdad.
  - Un test que compruebe que **TS y SQL dan el mismo resultado** en 50 casos.
- **Tests SQL o pgTAP:**
  - Cada política RLS: positiva y negativa.
  - Cada RPC: casos válidos, intentos de abuso y concurrencia (dos confirmaciones a la vez).
  - `recompute_elo_from` idempotente.
- **Playwright (e2e):**
  - Registro con dominio válido e inválido.
  - Apuntar, confirmar y ver el ranking actualizado.
  - Apuntar, rechazar, contrapropuesta y confirmar.
  - Caducidad.
  - Reto con chat.
  - Bloqueo.
  - Borrar cuenta.
  - Exportar datos.
  - Cambiar a cada uno de los 5 idiomas.
  - Vista móvil a 390px.
- **Accesibilidad:** axe en Playwright para las páginas principales, sin violaciones serias.
- **Rendimiento:** Lighthouse ≥ 90 en Performance y Accessibility en `/` y `/ranking`.
- **CI** (GitHub Actions): lint, typecheck, tests, comprobación de i18n, `npm audit` y build.

---

## 11. Fases

### F0 · Base del proyecto
- Next.js, TypeScript, Tailwind con los tokens de la sección 3.1, fuentes, next-intl con 5 idiomas vacíos, Supabase local (CLI), ESLint/Prettier, CI y `CLAUDE.md`.
- Logo de la oveja generado (sección 3.3), favicon y metadatos.
- **Criterio:** la página base renderiza en los 5 idiomas con la paleta y las fuentes correctas, y la CI está en verde.

### F1 · Auth y perfiles
- Enlace mágico, dominios permitidos, Turnstile, onboarding (alias y términos), Ajustes (alias, color, idioma, avisos).
- Tablas `profiles` y `audit_log` con RLS y tests.
- **Criterio:** un email que no es de la UPC no puede registrarse, y un usuario no puede modificar su ELO ni su rol desde el cliente (test).

### F2 · Partidos y ELO (el núcleo)
- Esquema de partidos, RPC de crear, confirmar, rechazar y anular, pg_cron de caducidad, validación de sets y ELO con *K*, *w* y *m*.
- Páginas `/apuntar` (diseño de la sección 3.5.3) y `/pendientes`, y avisos dentro de la app (sección 5.3.1).
- **Criterio:** todos los tests de 5.1 y 5.2 en verde, el flujo e2e de apuntar y confirmar funciona y no se puede auto-confirmar.

### F3 · Ranking y perfiles públicos
- Vistas públicas, `/ranking` con sus filtros, `/jugador/[alias]` con el gráfico de ELO y el desglose de *K·w·m* por partido.
- Home completa (sección 3.5.1) con datos reales y estados vacíos.
- **Criterio:** el diseño coincide con el artefacto, no hay cifras inventadas y Lighthouse da ≥90.

### F4 · Rivalidades y emblemas
- Tabla `rivalry_meta`, vista `rivalries` y port a TS de `design/emblem/emblem.js`.
- Componente `<RivalryEmblem>` con los 7 estados, mini icono para listas, transición de cambio de estado, etiquetas y página de rivalidad (móvil, sección 3.5.2).
- Imagen OG por rivalidad con `pfEmblemSVG`.
- **Criterio:**
  - Los snapshots de `design/emblem/ejemplos/` coinciden.
  - El estado pasa de 0 a ±1, ±2 y ±3 al confirmar los partidos correspondientes.
  - Papel y colores no cambian tras recalcular el ELO.
  - Se respeta el movimiento reducido.

### F5 · Retos y chat
- Retos, chat con Realtime, bloqueos y cierre automático.
- **Criterio:** los tests de RLS demuestran que un tercero no puede leer el chat, y un bloqueado no puede escribir ni retar.

### F6 · Anti-trolls y moderación
- Límites de 9.3, reputación automática de 9.4, reportes, panel `/admin`, recálculo de ELO y filtro del chat.
- **Criterio:** se superan los tests de abuso: spam de partidos, rechazos en masa y farmeo con el mismo rival.

### F7 · Legal y privacidad
- Páginas de términos, privacidad y cookies en los 5 idiomas, exportar datos, borrar cuenta con anonimización y trabajos de retención.
- **Criterio:** se pueden ejercer desde la app el acceso, la portabilidad y la supresión, y los textos están enlazados en el pie y en el onboarding.

### F8 · Normativa, i18n final y pulido
- `/normativa` en los 5 idiomas, revisión de traducciones (`TRANSLATIONS.md`), animaciones SVG restantes (loader, pala y delta) y checklist anti-IA (3.8).
- **Criterio:** cero claves de traducción faltantes, cero señales P0 de avoid-ai-design y la UI en alemán y chino revisada a 390px.

### F9 · Lanzamiento
- Checklist de seguridad 7.4, revisión legal humana, dominio y HTTPS, backups probados, cuenta de admin creada y email de contacto activo.
- Despliegue gratuito con doble ping anti-pausa (sección 14) funcionando: los dos pings han quedado registrados en `keepalive` al menos un día.
- **Criterio:** todas las casillas marcadas.

---

## 12. Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # solo servidor
ALLOWED_EMAIL_DOMAINS=              # p. ej. "upc.edu,<dominio estudiantes>" — VERIFICAR
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=               # solo servidor
CONTACT_EMAIL=
TERMS_VERSION=2026-11-01
RIVALRY_MIN_MATCHES=5
CRON_SECRET=                        # solo servidor; Vercel lo envía en el ping (sección 14)
```

En GitHub (Settings → Secrets → Actions) van `SUPABASE_URL` y `SUPABASE_ANON_KEY`, para el ping de respaldo.

---

## 13. Referencias

- Base de componentes: [shadcn/ui](https://ui.shadcn.com), solo para comportamiento y accesibilidad, siempre restilado.
- Aspecto humano: [avoid-ai-design](https://github.com/funboy322/avoid-ai-design), [zero-slop](https://github.com/eid0lon/zero-slop), [Rough.js](https://roughjs.com/) y [wired-elements](https://github.com/rough-stuff/wired-elements).
- Reglas oficiales: ITTF Handbook (enlazar la edición vigente en `/normativa`).
- Diseño aprobado: lienzo "Pepe Flock: pingpong" (Home + ranking, Rivalidad, Apuntar partido, Cuervo contra serpiente y Componente emblema). Sus maquetas están en `design/reference/`. Si hay dudas visuales, pide capturas al usuario.

---

## 14. Despliegue gratuito y anti-pausa (0 €)

**Objetivo:** que todo funcione gratis y que **Supabase no se pause nunca**, aunque pasen semanas sin que nadie juegue.

### 14.1 Dónde vive cada cosa

| Pieza | Servicio | Plan |
|---|---|---|
| Web (Next.js) | Vercel, región `fra1`, dominio `*.vercel.app` al principio | Hobby (gratis) |
| Base de datos, auth y realtime | Supabase, región UE (Frankfurt) | Free |
| Ping principal | Vercel Cron | Incluido en Hobby |
| Ping de respaldo | GitHub Actions | Gratis |
| Email de login | Supabase Auth (SMTP integrado). Sin avisos por email. Límite bajo de envíos por hora: vale para empezar y se amplía con Resend (sección 15) | Free |

### 14.2 Por qué hace falta el doble ping

- Supabase Free pausa los proyectos con poca actividad durante 7 días. Avisa por email una semana antes y permite restaurarlos hasta 1 año después, con los datos.
- **Vercel Cron (Hobby)** solo puede ejecutarse **una vez al día**, con una precisión de ±59 min. Es suficiente y no caduca por inactividad, pero depende de que la web esté desplegada.
- **GitHub Actions** desactiva los workflows programados en repos públicos tras **60 días sin actividad en el repo**. Por eso el respaldo incluye un commit automático mensual.
- Con los dos, si uno falla el otro mantiene la actividad, y cualquier fallo se nota (14.6).

### 14.3 Tabla y función de ping (migración SQL)

```sql
create table keepalive (
  source text primary key check (source in ('vercel','github')),
  last_ping timestamptz not null default now(),
  count bigint not null default 0
);
insert into keepalive (source) values ('vercel'), ('github');
alter table keepalive enable row level security;   -- sin políticas: nadie la lee ni escribe directamente

-- Escritura real en la BD (cuenta como actividad). Solo actualiza su propia fila.
create or replace function keepalive_ping(p_source text)
returns timestamptz
language plpgsql security definer set search_path = public, pg_temp as $$
declare t timestamptz;
begin
  if p_source not in ('vercel','github') then raise exception 'bad source'; end if;
  update keepalive set last_ping = now(), count = count + 1
   where source = p_source
     and last_ping < now() - interval '1 hour'      -- anti-abuso: máx. 1 escritura/hora por fuente
  returning last_ping into t;
  return coalesce(t, (select last_ping from keepalive where source = p_source));
end $$;

revoke all on function keepalive_ping(text) from public;
grant execute on function keepalive_ping(text) to anon, authenticated, service_role;

-- Solo lectura, sin datos personales: horas desde el último ping de Vercel (lo usa el job de GitHub)
create or replace function keepalive_vercel_age_hours()
returns int
language sql security definer set search_path = public, pg_temp as $$
  select floor(extract(epoch from now() - last_ping) / 3600)::int from keepalive where source = 'vercel';
$$;
revoke all on function keepalive_vercel_age_hours() from public;
grant execute on function keepalive_vercel_age_hours() to anon, authenticated, service_role;
```

La función solo toca su propia fila y como mucho una vez por hora, así que exponerla a `anon` no permite hacer daño.

### 14.4 Ping principal: Vercel Cron

`vercel.json`:
```json
{ "crons": [ { "path": "/api/keepalive", "schedule": "17 6 * * *" } ] }
```

`app/api/keepalive/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  // 1) escritura real   2) lectura real de una tabla de la app
  const { data, error } = await sb.rpc('keepalive_ping', { p_source: 'vercel' });
  const { error: e2 } = await sb.from('profiles').select('id', { head: true, count: 'exact' }).limit(1);
  if (error || e2) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true, last_ping: data });
}
```

Vercel envía `Authorization: Bearer <CRON_SECRET>` a los cron jobs cuando la variable `CRON_SECRET` está definida en el proyecto.

### 14.5 Ping de respaldo: GitHub Actions

`.github/workflows/keepalive.yml`:
```yaml
name: keepalive
on:
  schedule:
    - cron: '41 18 * * *'        # diario, a otra hora que Vercel
  workflow_dispatch: {}
permissions:
  contents: write                # para el commit mensual
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase (escritura real)
        run: |
          set -e
          code=$(curl -s -o /tmp/out -w '%{http_code}' -X POST \
            "${{ secrets.SUPABASE_URL }}/rest/v1/rpc/keepalive_ping" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"p_source":"github"}')
          cat /tmp/out; echo
          test "$code" = "200"      # si falla, el workflow falla y GitHub te avisa por email

      - name: Comprobar que el ping de Vercel sigue vivo (falla si tiene > 3 días)
        run: |
          set -e
          age=$(curl -s -X POST \
            "${{ secrets.SUPABASE_URL }}/rest/v1/rpc/keepalive_vercel_age_hours" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" -d '{}')
          echo "Último ping de Vercel hace ${age} h"
          test "${age%.*}" -lt 72

  keep-repo-active:
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule'
    steps:
      - uses: actions/checkout@v4
      - name: Commit mensual para que GitHub no desactive el workflow (regla de 60 días)
        run: |
          last=$(git log -1 --format=%ct)
          now=$(date +%s)
          if [ $(( (now - last) / 86400 )) -ge 30 ]; then
            date -u +%FT%TZ > .github/keepalive.txt
            git config user.name  "keepalive-bot"
            git config user.email "keepalive-bot@users.noreply.github.com"
            git add .github/keepalive.txt
            git commit -m "chore: keepalive [skip ci]"
            git push
          fi
```

### 14.6 Vigilancia: enterarse si algo falla

- El job de GitHub llama a `keepalive_vercel_age_hours()` (14.3) y **falla si el ping de Vercel tiene más de 3 días**. Así, un fallo de Vercel te llega como email de GitHub.
- GitHub envía por defecto un email al dueño del repo cuando falla un workflow programado. Comprueba que esas notificaciones están activadas en *Settings → Notifications → Actions*.
- En `/admin`, una tarjeta "Salud" con el último ping de cada fuente: verde si es de menos de 36 h, rojo si no.
- **Último recurso:** si llega el email de aviso de pausa de Supabase, entra en el panel del proyecto. Visitarlo ya evita la pausa.

### 14.7 Pasos de despliegue (los hace el usuario, guiado por Claude Code)

1. Crear el proyecto en Supabase (región Frankfurt) y aplicar las migraciones con `supabase db push`.
2. En Supabase Auth: activar el enlace mágico, configurar la plantilla de email en los 5 idiomas y poner la URL de la web en *Site URL* y *Redirect URLs*.
3. Crear el proyecto en Vercel desde el repo de GitHub, región `fra1`, y cargar las variables de la sección 12, incluido `CRON_SECRET`.
4. Desplegar y comprobar en *Vercel → Settings → Cron Jobs* que aparece `/api/keepalive`. Lanzarlo una vez a mano.
5. Añadir `SUPABASE_URL` y `SUPABASE_ANON_KEY` en los secretos de GitHub Actions y ejecutar `keepalive` con *Run workflow*.
6. Verificar en la tabla `keepalive` que las dos filas tienen `last_ping` reciente.
7. Activar los backups y probar una restauración (plan Free: hacer también un `pg_dump` semanal con otro workflow de GitHub Actions y guardarlo como artefacto privado o en un repo privado).

**Criterio de aceptación:** tras 2 días sin ninguna visita, la tabla `keepalive` muestra pings diarios de las dos fuentes y el proyecto de Supabase sigue activo.

---

## 15. Mejora futura: avisos por email (no se hace en el lanzamiento)

Solo si se ve que caducan muchos partidos sin confirmar o que el límite de emails de login de Supabase se queda corto.

- Comprar un dominio (unos 10 €/año), verificarlo en **Resend** (plan gratis: 3.000 emails al mes y 100 al día) y añadir `RESEND_API_KEY`.
- Pasar el login a SMTP de Resend en Supabase Auth.
- Añadir `email_notifications boolean not null default true` a `profiles` y el ajuste en `/ajustes`.
- Enviar avisos de partido pendiente y de reto, en el idioma del destinatario, con enlace de baja.
- Actualizar la política de privacidad: añadir Resend como encargado del tratamiento y el consentimiento para los avisos.
