-- Funciones puras: ELO (5.1) y validación de resultados (5.2). Espejadas en lib/elo.ts y lib/match-validation.ts.

create or replace function elo_round(x double precision) returns int
language sql immutable as $$
  select (sign(x) * floor(abs(x) + 0.5))::int
$$;

create or replace function elo_expected(r_own double precision, r_opp double precision) returns double precision
language sql immutable as $$
  select 1.0 / (1.0 + power(10.0, (r_opp - r_own) / 400.0))
$$;

create or replace function elo_k(games int) returns int
language sql immutable as $$ select case when games < 20 then 32 else 20 end $$;

create or replace function elo_weight_w(n int) returns double precision
language sql immutable as $$ select greatest(0.2, 1.0 / (1.0 + 0.5 * n)) $$;

create or replace function elo_weight_m(points_target int, best_of int) returns double precision
language sql immutable as $$
  select least(1.0, sqrt((points_target * ((best_of + 1) / 2))::double precision / 33.0))
$$;

create or replace function elo_delta(r_own double precision, r_opp double precision, k int, n int,
                                     points_target int, best_of int, won boolean)
returns int language sql immutable as $$
  select elo_round(k * elo_weight_w(n) * elo_weight_m(points_target, best_of)
                   * ((case when won then 1.0 else 0.0 end) - elo_expected(r_own, r_opp)))
$$;

-- Devuelve 'A' o 'B'. Lanza 'invalid_score' si el resultado no es válido.
create or replace function validate_sets(p_target int, p_best_of int, p_win_by_two boolean, p_sets jsonb)
returns char language plpgsql immutable as $$
declare
  need int := (p_best_of + 1) / 2;
  wa int := 0; wb int := 0; i int; a int; b int; hi int; lo int; n int;
begin
  if jsonb_typeof(p_sets) <> 'array' then raise exception 'invalid_score: sets must be an array'; end if;
  n := jsonb_array_length(p_sets);
  if n < need or n > p_best_of then raise exception 'invalid_score: set count'; end if;
  for i in 0 .. n - 1 loop
    if jsonb_typeof(p_sets -> i) <> 'array' or jsonb_array_length(p_sets -> i) <> 2 then
      raise exception 'invalid_score: set shape';
    end if;
    a := (p_sets -> i ->> 0)::int; b := (p_sets -> i ->> 1)::int;
    if a < 0 or b < 0 or a > 99 or b > 99 then raise exception 'invalid_score: range'; end if;
    hi := greatest(a, b); lo := least(a, b);
    if p_win_by_two then
      if not ((hi = p_target and lo <= p_target - 2) or (hi > p_target and hi - lo = 2)) then
        raise exception 'invalid_score: set % (% - %)', i + 1, a, b;
      end if;
    else
      if not (hi = p_target and lo < p_target) then
        raise exception 'invalid_score: set % (% - %)', i + 1, a, b;
      end if;
    end if;
    -- no puede haber sets después de que alguien llegue a la meta
    if wa = need or wb = need then raise exception 'invalid_score: set after match end'; end if;
    if a > b then wa := wa + 1; else wb := wb + 1; end if;
  end loop;
  if wa <> need and wb <> need then raise exception 'invalid_score: nobody reached % sets', need; end if;
  return case when wa = need then 'A' else 'B' end;
end $$;

-- Estado del emblema (-3..3) desde el cuervo. Misma regla que pfRivalryState en lib/emblem.
create or replace function rivalry_state(crow_wins int, snake_wins int) returns int
language sql immutable as $$
  with x as (
    select crow_wins - snake_wins as d, abs(crow_wins - snake_wins) as ad, crow_wins + snake_wins as total
  ), l as (
    select d, total, ad,
           case when ad <= 1 then 0 when ad <= 3 then 1 when ad <= 6 then 2 else 3 end as lvl,
           greatest(crow_wins, snake_wins) as top
    from x
  )
  select (case when d >= 0 then 1 else -1 end) *
         (case when lvl = 3 and top::numeric / total < 0.7 then 2 else lvl end)
  from l
$$;

-- ---------- helpers de sesión y permisos ----------

create or replace function cfg(p_key text) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select value from app_config where key = p_key
$$;

-- Perfil del llamante; falla si no hay sesión, no hay perfil o está baneado.
-- p_write = true exige además no estar limitado (limitado = solo puede confirmar/rechazar).
create or replace function require_user(p_write boolean default false) returns profiles
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare me profiles;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into me from profiles where id = auth.uid();
  if not found then raise exception 'no_profile' using errcode = '28000'; end if;
  if me.status = 'banned' then raise exception 'banned' using errcode = '42501'; end if;
  if p_write and me.status = 'limited' and (me.limited_until is null or me.limited_until > now()) then
    raise exception 'limited' using errcode = '42501';
  end if;
  return me;
end $$;

create or replace function is_mod() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('mod','admin') and status <> 'banned')
$$;

create or replace function is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a))
$$;

-- Límite por ventana usando rate_events. Registra el evento si pasa.
create or replace function rate_hit(p_profile uuid, p_kind text, p_max int, p_window interval) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare c int;
begin
  select count(*) into c from rate_events
   where profile_id = p_profile and kind = p_kind and created_at > now() - p_window;
  if c >= p_max then raise exception 'rate_limited: %', p_kind using errcode = '53400'; end if;
  insert into rate_events (profile_id, kind) values (p_profile, p_kind);
end $$;

-- Límite para claves anónimas (hash de email/IP). Solo service_role. Devuelve false si se supera.
create or replace function throttle_hit(p_key text, p_max int, p_window interval) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare c int;
begin
  select count(*) into c from auth_throttle where key = p_key and created_at > now() - p_window;
  if c >= p_max then return false; end if;
  insert into auth_throttle (key) values (p_key);
  return true;
end $$;

create or replace function notify(p_profile uuid, p_kind text, p_ref uuid default null, p_detail text default null) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into notifications (profile_id, kind, ref_id, detail) values (p_profile, p_kind, p_ref, p_detail)
$$;

create or replace function log_audit(p_actor uuid, p_action text, p_target text, p_meta jsonb default null) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into audit_log (actor_id, action, target, meta) values (p_actor, p_action, p_target, p_meta)
$$;

-- Texto normalizado para comparar con listas: NFKC, minúsculas, sin separadores ni leet básico.
create or replace function normalize_text(t text) returns text
language sql immutable as $$
  select translate(regexp_replace(lower(normalize(coalesce(t, ''), NFKC)), '[\s._\-]+', '', 'g'), '013457@$', 'oleastas')
$$;

create or replace function wordlist_hit(p_kind text, p_text text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from wordlist w where w.kind = p_kind and position(w.word in normalize_text(p_text)) > 0)
$$;

-- Aliases: formato, reservados y palabras prohibidas (lanza 'bad_alias')
create or replace function check_alias(p_alias text) returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare a text := normalize(p_alias, NFKC);
begin
  if a !~ '^[A-Za-z0-9._-]{3,20}$' then raise exception 'bad_alias: format'; end if;
  if exists (select 1 from wordlist where kind = 'reserved' and word = normalize_text(a)) then
    raise exception 'bad_alias: reserved';
  end if;
  if wordlist_hit('alias', a) then raise exception 'bad_alias: offensive'; end if;
end $$;
