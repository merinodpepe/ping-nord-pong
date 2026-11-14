-- Alias con código tipo Discord: Furu#xyzj. El alias deja de ser único; lo es el par (alias, tag).
-- El tag lo asigna siempre el servidor (no es dato personal) y no lo elige el cliente.

alter table profiles add column if not exists tag text;

create or replace function gen_tag(p_alias text) returns text
language plpgsql volatile set search_path = public, pg_temp as $$
declare chars constant text := 'abcdefghjkmnpqrstuvwxyz23456789'; t text; i int;
begin
  for attempt in 1..200 loop
    t := '';
    for i in 1..4 loop t := t || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
    if not exists (select 1 from profiles where alias = p_alias::citext and tag = t) then return t; end if;
  end loop;
  raise exception 'tag_exhausted';
end $$;

do $$
declare r record;
begin
  for r in select id, alias::text as alias from profiles where tag is null loop
    update profiles set tag = gen_tag(r.alias) where id = r.id;
  end loop;
end $$;

create or replace function profiles_set_tag() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.tag is null then new.tag := gen_tag(new.alias::text); end if;
  return new;
end $$;
create trigger profiles_set_tag before insert on profiles for each row execute function profiles_set_tag();

alter table profiles alter column tag set not null;
alter table profiles add constraint profiles_tag_format check (tag ~ '^[a-z0-9]{4}$');
alter table profiles drop constraint if exists profiles_alias_key;
alter table profiles add constraint profiles_alias_tag_key unique (alias, tag);
create index if not exists profiles_alias_prefix_idx on profiles (lower(alias::text) text_pattern_ops);

create or replace function complete_onboarding(p_alias text, p_locale text, p_terms_version text, p_avatar_color int default null)
returns profiles
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); p profiles; col int; a text := normalize(p_alias, NFKC);
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if exists (select 1 from profiles where id = uid) then raise exception 'already_onboarded'; end if;
  if p_locale not in ('es','ca','en','zh','de') then raise exception 'bad_locale'; end if;
  if p_terms_version is distinct from cfg('terms_version') then raise exception 'bad_terms_version'; end if;
  perform check_alias(p_alias);
  col := coalesce(p_avatar_color, abs(hashtext(uid::text)) % 7);
  insert into profiles (id, alias, tag, avatar_color, locale, terms_version, terms_accepted_at)
  values (uid, a, gen_tag(a), col, p_locale, p_terms_version, now())
  returning * into p;
  return p;
exception when unique_violation then
  raise exception 'alias_taken';
end $$;

create or replace function update_profile(p_alias text default null, p_avatar_color int default null, p_locale text default null)
returns profiles
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false); p profiles; a text := normalize(p_alias, NFKC); newtag text;
begin
  if p_alias is not null and p_alias <> me.alias::text then
    perform rate_hit(me.id, 'alias_change', 3, interval '30 days');
    perform check_alias(p_alias);
  end if;
  if p_locale is not null and p_locale not in ('es','ca','en','zh','de') then raise exception 'bad_locale'; end if;
  if p_avatar_color is not null and p_avatar_color not between 0 and 6 then raise exception 'bad_color'; end if;
  newtag := me.tag;
  if a is not null and a::citext <> me.alias then
    newtag := case when exists (select 1 from profiles where alias = a::citext and tag = me.tag) then gen_tag(a) else me.tag end;
  end if;
  update profiles set alias = coalesce(a, alias), tag = newtag,
         avatar_color = coalesce(p_avatar_color, avatar_color), locale = coalesce(p_locale, locale)
   where id = me.id returning * into p;
  return p;
exception when unique_violation then
  raise exception 'alias_taken';
end $$;

create or replace function admin_force_alias(p_profile uuid, p_alias text, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false); old text; a text := normalize(p_alias, NFKC);
begin
  if not is_mod() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_reason is null or char_length(btrim(p_reason)) = 0 then raise exception 'reason_required'; end if;
  perform check_alias(p_alias);
  select alias::text into old from profiles where id = p_profile for update;
  if not found then raise exception 'not_found'; end if;
  update profiles set alias = a, tag = gen_tag(a) where id = p_profile;
  perform notify(p_profile, 'alias_changed', null, p_reason);
  perform log_audit(me.id, 'force_alias', p_profile::text, jsonb_build_object('old', old, 'new', p_alias, 'reason', p_reason));
exception when unique_violation then
  raise exception 'alias_taken';
end $$;

-- El panel de moderación distingue homónimos: devuelve "alias#tag" en la columna alias (misma firma)
create or replace function admin_find_profiles(p_q text) returns table(id uuid, alias text, role user_role, status user_status, limited_until timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not is_mod() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query select p.id, p.alias::text || '#' || p.tag, p.role, p.status, p.limited_until, p.created_at
    from profiles p where p.alias ilike '%' || replace(replace(p_q, '%', ''), '_', '') || '%' order by p.alias, p.tag limit 30;
end $$;

-- Vistas: se añade `tag` al final de cada una
create or replace view player_mode_stats as
with res as (
  select mp.profile_id, m.mode, (mp.team = m.winner_team) as won, m.confirmed_at, mp.delta,
         row_number() over (partition by mp.profile_id, m.mode order by m.confirmed_at desc, m.id desc) as rn
    from match_players mp join matches m on m.id = mp.match_id
   where m.status = 'confirmed' and mp.profile_id is not null
), agg as (
  select profile_id, mode, count(*) filter (where won) as wins, count(*) filter (where not won) as losses,
         coalesce(sum(delta) filter (where confirmed_at > now() - interval '7 days'), 0)::int as delta7
    from res group by profile_id, mode
), first as (select profile_id, mode, won from res where rn = 1),
streak as (
  select r.profile_id, r.mode,
         (case when bool_and(f.won) then 1 else -1 end) * (coalesce(min(r.rn) filter (where r.won <> f.won), count(*) + 1) - 1)::int as streak
    from res r join first f using (profile_id, mode) group by r.profile_id, r.mode
)
select p.id as profile_id, md.mode, p.alias::text as alias, p.avatar_color,
       case when md.mode = '1v1' then p.elo_single else p.elo_double end as elo,
       case when md.mode = '1v1' then p.games_single else p.games_double end as games,
       coalesce(a.wins, 0)::int as wins, coalesce(a.losses, 0)::int as losses,
       coalesce(s.streak, 0)::int as streak, coalesce(a.delta7, 0) as delta7,
       p.last_played_at,
       (case when md.mode = '1v1' then p.games_single else p.games_double end) < 10 as is_provisional,
       coalesce(p.last_played_at > now() - interval '30 days', false) as is_active,
       p.tag
  from profiles p
  cross join (values ('1v1'::match_mode), ('2v2'::match_mode)) as md(mode)
  left join agg a on a.profile_id = p.id and a.mode = md.mode
  left join streak s on s.profile_id = p.id and s.mode = md.mode
 where p.status <> 'banned';

create or replace view public_profiles as
select p.id, p.alias::text as alias, p.avatar_color, p.elo_single, p.elo_double, p.games_single, p.games_double,
       p.games_single < 10 as is_provisional_single, p.games_double < 10 as is_provisional_double,
       coalesce(p.last_played_at > now() - interval '30 days', false) as is_active,
       p.last_played_at, p.created_at, p.tag
  from profiles p where p.status <> 'banned';

create or replace view public_match_players as
select mp.match_id, mp.team, mp.slot, mp.profile_id, p.alias::text as alias, p.avatar_color,
       mp.elo_before, mp.elo_after, mp.delta, mp.weight_w, mp.weight_m, mp.k, p.tag
  from match_players mp
  join matches m on m.id = mp.match_id and m.status = 'confirmed'
  left join profiles p on p.id = mp.profile_id;

create or replace view rivalries as
select rm.player_low, rm.player_high, pl.alias::text as alias_low, ph.alias::text as alias_high,
       h.wins as wins_low, h.losses as wins_high, h.total,
       rm.crow_id, case when rm.crow_id = rm.player_low then rm.player_high else rm.player_low end as snake_id,
       rm.seed,
       case when rm.crow_id = rm.player_low then h.wins else h.losses end as crow_wins,
       case when rm.crow_id = rm.player_low then h.losses else h.wins end as snake_wins,
       rivalry_state(case when rm.crow_id = rm.player_low then h.wins else h.losses end,
                     case when rm.crow_id = rm.player_low then h.losses else h.wins end) as emblem_state,
       rm.prev_state,
       h.last_at as last_match_at,
       (select count(*)::int from matches m
          join match_players x on x.match_id = m.id and x.profile_id = rm.player_low
          join match_players y on y.match_id = m.id and y.profile_id = rm.player_high
         where m.mode = '1v1' and m.status = 'confirmed' and m.confirmed_at > now() - interval '7 days') as matches_7d,
       (select owner from rivalry_streak(rm.player_low, rm.player_high)) as streak_owner,
       (select len from rivalry_streak(rm.player_low, rm.player_high)) as streak_len,
       (select coalesce(jsonb_object_agg(f.pt::text, jsonb_build_object('low', f.low_w, 'high', f.high_w)), '{}'::jsonb)
          from (select m.points_target as pt,
                       count(*) filter (where m.winner_team = x.team) as low_w,
                       count(*) filter (where m.winner_team <> x.team) as high_w
                  from matches m
                  join match_players x on x.match_id = m.id and x.profile_id = rm.player_low
                  join match_players y on y.match_id = m.id and y.profile_id = rm.player_high
                 where m.mode = '1v1' and m.status = 'confirmed' group by m.points_target) f) as by_format,
       pl.tag as tag_low, ph.tag as tag_high
  from rivalry_meta rm
  join head_to_head h on h.player_id = rm.player_low and h.rival_id = rm.player_high
  join profiles pl on pl.id = rm.player_low and pl.status <> 'banned'
  join profiles ph on ph.id = rm.player_high and ph.status <> 'banned'
 where h.total >= cfg('rivalry_min_matches')::int;
