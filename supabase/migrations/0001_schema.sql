-- Ping-Nord-Pong · esquema base (plan, sección 4)
-- Sin restricción de dominio de email: cualquier email puede registrarse con enlace mágico.

create extension if not exists citext with schema public;
create extension if not exists pgcrypto with schema public;

create type match_mode       as enum ('1v1','2v2');
create type match_status     as enum ('pending','confirmed','rejected','expired','voided');
create type user_role        as enum ('user','mod','admin');
create type user_status      as enum ('active','limited','banned');
create type challenge_status as enum ('open','accepted','declined','cancelled','done');
create type report_status    as enum ('open','resolved','dismissed');

-- Configuración ajustable (solo lectura para funciones internas)
create table app_config (key text primary key, value text not null);
insert into app_config values ('rivalry_min_matches', '5'), ('terms_version', '2026-11-01');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  alias citext unique not null check (alias ~ '^[A-Za-z0-9._-]{3,20}$'),
  avatar_color smallint not null default 0 check (avatar_color between 0 and 6),
  locale text not null default 'es' check (locale in ('es','ca','en','zh','de')),
  elo_single int not null default 1000,
  elo_double int not null default 1000,
  games_single int not null default 0,
  games_double int not null default 0,
  last_played_at timestamptz,
  role user_role not null default 'user',
  status user_status not null default 'active',
  limited_until timestamptz,
  terms_version text not null,
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
  created_by uuid references profiles on delete set null,   -- null = cuenta borrada
  played_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '48 hours',
  confirmed_at timestamptz,
  confirmed_by uuid references profiles on delete set null,
  rejected_by uuid references profiles on delete set null,
  reject_reason text check (reject_reason in ('wrong_result','not_played','other')),
  counter_of uuid references matches on delete set null,    -- contrapropuesta única
  challenge_id uuid,
  void_reason text check (char_length(void_reason) <= 200),
  created_at timestamptz not null default now()
);
create index on matches (status, expires_at);
create index on matches (confirmed_at, id) where status = 'confirmed';
create index on matches (created_by, status);

-- slot en la clave: permite profile_id null cuando se borra una cuenta (se conserva la historia del rival)
create table match_players (
  match_id uuid not null references matches on delete cascade,
  team char(1) not null check (team in ('A','B')),
  slot smallint not null check (slot in (1,2)),
  profile_id uuid references profiles on delete set null,
  elo_before int, elo_after int, delta int,
  weight_w numeric(4,3), weight_m numeric(4,3), k smallint,
  primary key (match_id, team, slot)
);
create unique index on match_players (match_id, profile_id) where profile_id is not null;
create index on match_players (profile_id);

create table match_sets (
  match_id uuid not null references matches on delete cascade,
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
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);
create index on challenges (from_id, status);
create index on challenges (to_id, status);

create table messages (
  id bigserial primary key,
  challenge_id uuid not null references challenges on delete cascade,
  sender_id uuid references profiles on delete set null,
  body text not null check (char_length(body) between 1 and 500),
  flagged boolean not null default false,
  created_at timestamptz not null default now()
);
create index on messages (challenge_id, id);

create table blocks (
  blocker uuid references profiles on delete cascade,
  blocked uuid references profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles on delete set null,
  target_profile uuid references profiles on delete cascade,
  target_match uuid references matches on delete cascade,
  target_message bigint references messages on delete cascade,
  reason text not null check (reason in ('fake_result','harassment','spam','impersonation','offensive_alias','other')),
  details text check (char_length(details) <= 500),
  status report_status not null default 'open',
  resolved_by uuid references profiles on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(target_profile, target_match, target_message) = 1)
);

-- Emblema de rivalidad. cur_state se añade al plan para detectar cambios de estado y rellenar prev_state.
create table rivalry_meta (
  player_low  uuid not null references profiles on delete cascade,
  player_high uuid not null references profiles on delete cascade,
  crow_id     uuid not null,
  seed        int  not null default floor(random() * 2147483647)::int,
  cur_state   smallint not null default 0 check (cur_state between -3 and 3),
  prev_state  smallint check (prev_state between -3 and 3),
  created_at  timestamptz not null default now(),
  primary key (player_low, player_high),
  check (player_low < player_high),
  check (crow_id in (player_low, player_high))
);

-- detail/ampliación de kinds respecto al plan: los avisos de moderación también van dentro de la web (9.5)
create table notifications (
  id bigserial primary key,
  profile_id uuid not null references profiles on delete cascade,
  kind text not null check (kind in ('match_pending','match_confirmed','match_rejected','challenge_new','challenge_accepted',
                                     'account_limited','account_banned','match_voided','alias_changed')),
  ref_id uuid,
  detail text check (char_length(detail) <= 300),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (profile_id, read_at, created_at desc);

create table audit_log (
  id bigserial primary key,
  actor_id uuid, action text not null, target text, meta jsonb,
  created_at timestamptz not null default now()
);

create table rate_events (
  profile_id uuid not null, kind text not null, created_at timestamptz not null default now()
);
create index on rate_events (profile_id, kind, created_at desc);

-- Límite de peticiones de enlace mágico por email/IP. La clave es un hash, nunca el email ni la IP en claro.
create table auth_throttle (
  key text not null, created_at timestamptz not null default now()
);
create index on auth_throttle (key, created_at desc);

-- Marcas automáticas de posible amaño (9.4). Solo marcan, no castigan.
create table auto_flags (
  id bigserial primary key,
  kind text not null check (kind in ('pair_volume','alternating','single_source','repeated_score','new_cluster')),
  profile_a uuid references profiles on delete cascade,
  profile_b uuid references profiles on delete cascade,
  details jsonb,
  status text not null default 'open' check (status in ('open','reviewed','dismissed')),
  day date not null default current_date,
  created_at timestamptz not null default now()
);
create unique index on auto_flags (kind, profile_a, coalesce(profile_b, profile_a), day);

-- Listas de palabras para alias y chat (se amplían sin tocar código)
create table wordlist (
  kind text not null check (kind in ('alias','chat','reserved')),
  word text not null,
  primary key (kind, word)
);
