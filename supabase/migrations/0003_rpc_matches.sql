-- Flujo de partidos (5.3): crear, confirmar, rechazar, anular, caducar y recalcular ELO.

create or replace function match_group(p_match uuid) returns uuid[]
language sql stable as $$
  select coalesce(array_agg(profile_id order by profile_id), '{}') from match_players
   where match_id = p_match and profile_id is not null
$$;

-- ---------- rivalidades ----------
create or replace function refresh_rivalry_pair(a uuid, b uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare lo uuid := least(a, b); hi uuid := greatest(a, b);
        min_n int := cfg('rivalry_min_matches')::int;
        wl int; wh int; meta rivalry_meta; crow uuid; st int;
begin
  select count(*) filter (where m.winner_team = pl.team), count(*) filter (where m.winner_team <> pl.team)
    into wl, wh
    from matches m
    join match_players pl on pl.match_id = m.id and pl.profile_id = lo
    join match_players ph on ph.match_id = m.id and ph.profile_id = hi
   where m.mode = '1v1' and m.status = 'confirmed';
  if wl + wh < min_n then return; end if;
  select * into meta from rivalry_meta where player_low = lo and player_high = hi for update;
  if not found then
    crow := case when random() < 0.5 then lo else hi end;
    insert into rivalry_meta (player_low, player_high, crow_id) values (lo, hi, crow) returning * into meta;
  end if;
  st := case when meta.crow_id = lo then rivalry_state(wl, wh) else rivalry_state(wh, wl) end;
  if st <> meta.cur_state then
    update rivalry_meta set prev_state = cur_state, cur_state = st where player_low = lo and player_high = hi;
  end if;
end $$;

-- ---------- ELO ----------
-- Aplica el ELO de un partido ya confirmado usando el estado actual de los perfiles. Interna.
create or replace function apply_match_elo(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare m matches; n int; grp uuid[]; single boolean; pids uuid[];
begin
  select * into m from matches where id = p_id;
  single := m.mode = '1v1';
  grp := match_group(p_id);
  select count(*) into n from matches o
   where o.id <> m.id and o.mode = m.mode and o.status = 'confirmed'
     and (o.confirmed_at, o.id) < (m.confirmed_at, m.id)
     and o.played_at >= m.played_at - interval '7 days'
     and exists (select 1 from match_players x where x.match_id = o.id and x.profile_id = grp[1])
     and match_group(o.id) = grp;

  with pl as (
    select mp.team, mp.slot,
           coalesce(case when single then p.elo_single else p.elo_double end, mp.elo_before, 1000)::double precision as rating,
           coalesce(case when single then p.games_single else p.games_double end, 0) as games
      from match_players mp left join profiles p on p.id = mp.profile_id
     where mp.match_id = p_id
  ), tm as (select team, avg(rating) as r from pl group by team),
  calc as (
    select pl.team, pl.slot, pl.rating, elo_k(pl.games) as k,
           elo_delta(own.r, opp.r, elo_k(pl.games), n, m.points_target, m.best_of, pl.team = m.winner_team) as d
      from pl join tm own on own.team = pl.team join tm opp on opp.team <> pl.team
  )
  update match_players u
     set elo_before = calc.rating::int, delta = calc.d, elo_after = calc.rating::int + calc.d,
         weight_w = round(elo_weight_w(n)::numeric, 3), weight_m = round(elo_weight_m(m.points_target, m.best_of)::numeric, 3),
         k = calc.k
    from calc
   where u.match_id = p_id and u.team = calc.team and u.slot = calc.slot;

  if single then
    update profiles p set elo_single = mp.elo_after, games_single = p.games_single + 1,
           last_played_at = greatest(coalesce(p.last_played_at, '-infinity'), m.played_at)
      from match_players mp where mp.match_id = p_id and mp.profile_id = p.id;
  else
    update profiles p set elo_double = mp.elo_after, games_double = p.games_double + 1,
           last_played_at = greatest(coalesce(p.last_played_at, '-infinity'), m.played_at)
      from match_players mp where mp.match_id = p_id and mp.profile_id = p.id;
  end if;

  if single then
    select array_agg(profile_id) into pids from match_players where match_id = p_id and profile_id is not null;
    if array_length(pids, 1) = 2 then perform refresh_rivalry_pair(pids[1], pids[2]); end if;
  end if;
end $$;

-- Vuelve a calcular la historia confirmada en orden desde p_from. Idempotente. Interna (la usan void_match y el panel).
create or replace function recompute_elo_from(p_from timestamptz) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare ids uuid[]; r record;
begin
  select array_agg(distinct mp.profile_id) into ids
    from match_players mp join matches x on x.id = mp.match_id
   where x.confirmed_at >= p_from and x.status in ('confirmed','voided') and mp.profile_id is not null;
  if ids is null then return; end if;
  perform 1 from profiles where id = any(ids) order by id for update;

  update profiles p set
    elo_single = coalesce((select mp.elo_after from match_players mp join matches x on x.id = mp.match_id
                            where mp.profile_id = p.id and x.mode = '1v1' and x.status = 'confirmed' and x.confirmed_at < p_from
                            order by x.confirmed_at desc, x.id desc limit 1), 1000),
    elo_double = coalesce((select mp.elo_after from match_players mp join matches x on x.id = mp.match_id
                            where mp.profile_id = p.id and x.mode = '2v2' and x.status = 'confirmed' and x.confirmed_at < p_from
                            order by x.confirmed_at desc, x.id desc limit 1), 1000),
    games_single = (select count(*) from match_players mp join matches x on x.id = mp.match_id
                     where mp.profile_id = p.id and x.mode = '1v1' and x.status = 'confirmed' and x.confirmed_at < p_from),
    games_double = (select count(*) from match_players mp join matches x on x.id = mp.match_id
                     where mp.profile_id = p.id and x.mode = '2v2' and x.status = 'confirmed' and x.confirmed_at < p_from),
    last_played_at = (select max(x.played_at) from match_players mp join matches x on x.id = mp.match_id
                       where mp.profile_id = p.id and x.status = 'confirmed' and x.confirmed_at < p_from)
  where p.id = any(ids);

  for r in select id from matches where status = 'confirmed' and confirmed_at >= p_from order by confirmed_at, id loop
    perform apply_match_elo(r.id);
  end loop;

  update match_players set delta = null, elo_after = null
   where match_id in (select id from matches where status = 'voided');
  perform log_audit(null, 'recompute_elo', p_from::text, jsonb_build_object('players', array_length(ids, 1)));
end $$;

-- ---------- crear ----------
create or replace function create_match(
  p_mode match_mode, p_points_target int, p_best_of int, p_win_by_two boolean,
  p_team_a uuid[], p_team_b uuid[], p_sets jsonb,
  p_counter_of uuid default null, p_challenge uuid default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  me profiles := require_user(true);
  size int := case when p_mode = '1v1' then 1 else 2 end;
  everyone uuid[]; winner char; mid uuid; i int; pid uuid; other uuid;
  orig matches; orig_players uuid[]; recent int; pending_n int; ch challenges;
begin
  if p_team_a is null or p_team_b is null or coalesce(array_length(p_team_a, 1), 0) <> size
     or coalesce(array_length(p_team_b, 1), 0) <> size then
    raise exception 'invalid_players';
  end if;
  everyone := p_team_a || p_team_b;
  if (select count(distinct x) from unnest(everyone) x) <> size * 2 or array_position(everyone, null) is not null then
    raise exception 'invalid_players: duplicates';
  end if;
  if not (me.id = any(everyone)) then raise exception 'creator_not_player' using errcode = '42501'; end if;
  if (select count(*) from profiles where id = any(everyone) and status <> 'banned') <> size * 2 then
    raise exception 'invalid_players: unknown or banned';
  end if;
  foreach pid in array everyone loop
    foreach other in array everyone loop
      if pid < other and is_blocked_between(pid, other) then raise exception 'blocked' using errcode = '42501'; end if;
    end loop;
  end loop;
  winner := validate_sets(p_points_target, p_best_of, p_win_by_two, p_sets);

  if p_counter_of is not null then
    select * into orig from matches where id = p_counter_of for update;
    if not found or orig.status <> 'rejected' or orig.reject_reason <> 'wrong_result' then
      raise exception 'counter_not_allowed';
    end if;
    if orig.rejected_by is distinct from me.id or orig.counter_of is not null
       or exists (select 1 from matches c where c.counter_of = orig.id) then
      raise exception 'counter_not_allowed: only once';
    end if;
    orig_players := match_group(orig.id);
    if (select array_agg(x order by x) from unnest(everyone) x) is distinct from orig_players or orig.mode <> p_mode then
      raise exception 'counter_not_allowed: players';
    end if;
  end if;

  if p_challenge is not null then
    select * into ch from challenges where id = p_challenge;
    if not found or ch.status not in ('open','accepted')
       or not (ch.from_id = any(everyone) and ch.to_id = any(everyone)) then
      raise exception 'invalid_challenge';
    end if;
  end if;

  select count(*) into pending_n from matches where created_by = me.id and status = 'pending';
  if pending_n >= 3 then raise exception 'rate_limited: pending'; end if;
  perform rate_hit(me.id, 'match_create', 15, interval '1 day');
  select count(*) into recent from matches m
   where m.mode = p_mode and m.status in ('pending','confirmed') and m.created_at > now() - interval '1 day'
     and match_group(m.id) = (select array_agg(x order by x) from unnest(everyone) x);
  if recent >= 5 then raise exception 'rate_limited: same_rival'; end if;

  insert into matches (mode, points_target, best_of, win_by_two, winner_team, created_by, counter_of, challenge_id)
  values (p_mode, p_points_target, p_best_of, p_win_by_two, winner, me.id, p_counter_of, p_challenge)
  returning id into mid;
  for i in 1 .. size loop
    insert into match_players (match_id, team, slot, profile_id) values (mid, 'A', i, p_team_a[i]), (mid, 'B', i, p_team_b[i]);
  end loop;
  insert into match_sets (match_id, set_no, score_a, score_b)
  select mid, ord::int, (s ->> 0)::int, (s ->> 1)::int from jsonb_array_elements(p_sets) with ordinality as t(s, ord);

  for pid in select profile_id from match_players
              where match_id = mid and profile_id <> me.id
                and team <> (select team from match_players where match_id = mid and profile_id = me.id) loop
    perform notify(pid, 'match_pending', mid);
  end loop;
  return mid;
end $$;

-- ---------- confirmar ----------
create or replace function confirm_match(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false); m matches; my_team char; creator_team char; recent int;
begin
  select * into m from matches where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if m.status <> 'pending' then raise exception 'not_pending'; end if;
  if m.expires_at <= now() then raise exception 'expired'; end if;
  select team into creator_team from match_players where match_id = p_id and profile_id = m.created_by;
  select team into my_team from match_players where match_id = p_id and profile_id = me.id;
  if my_team is null then raise exception 'not_participant' using errcode = '42501'; end if;
  if creator_team is null or my_team = creator_team then raise exception 'cannot_confirm_own' using errcode = '42501'; end if;

  select count(*) into recent from matches o
   where o.status = 'confirmed' and o.mode = m.mode and o.confirmed_at > now() - interval '1 day'
     and match_group(o.id) = match_group(p_id);
  if recent >= 5 then raise exception 'rate_limited: same_rival'; end if;

  perform 1 from profiles where id in (select profile_id from match_players where match_id = p_id and profile_id is not null)
   order by id for update;
  update matches set status = 'confirmed', confirmed_at = clock_timestamp(), confirmed_by = me.id where id = p_id;
  perform apply_match_elo(p_id);
  if m.challenge_id is not null then
    update challenges set status = 'done', closed_at = now() where id = m.challenge_id and status in ('open','accepted');
  end if;
  perform notify(m.created_by, 'match_confirmed', p_id);
  perform log_audit(me.id, 'confirm_match', p_id::text);
end $$;

-- ---------- rechazar ----------
create or replace function reject_match(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false); m matches; my_team char; creator_team char;
begin
  if p_reason not in ('wrong_result','not_played','other') then raise exception 'bad_reason'; end if;
  select * into m from matches where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if m.status <> 'pending' then raise exception 'not_pending'; end if;
  select team into creator_team from match_players where match_id = p_id and profile_id = m.created_by;
  select team into my_team from match_players where match_id = p_id and profile_id = me.id;
  if my_team is null or creator_team is null or my_team = creator_team then
    raise exception 'cannot_reject' using errcode = '42501';
  end if;
  update matches set status = 'rejected', reject_reason = p_reason, rejected_by = me.id where id = p_id;
  perform notify(m.created_by, 'match_rejected', p_id, p_reason);
  perform log_audit(me.id, 'reject_match', p_id::text, jsonb_build_object('reason', p_reason));
end $$;

-- ---------- caducar (pg_cron cada 15 min) ----------
create or replace function expire_pending_matches() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare c int;
begin
  update matches set status = 'expired' where status = 'pending' and expires_at <= now();
  get diagnostics c = row_count;
  return c;
end $$;

-- ---------- anular (moderación) ----------
create or replace function void_match(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false); m matches; pid uuid;
begin
  if not is_mod() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_reason is null or char_length(btrim(p_reason)) = 0 or char_length(p_reason) > 200 then raise exception 'reason_required'; end if;
  select * into m from matches where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if m.status in ('voided') then return; end if;
  update matches set status = 'voided', void_reason = p_reason where id = p_id;
  if m.status = 'confirmed' then perform recompute_elo_from(m.confirmed_at); end if;
  for pid in select profile_id from match_players where match_id = p_id and profile_id is not null loop
    perform notify(pid, 'match_voided', p_id, p_reason);
  end loop;
  perform log_audit(me.id, 'void_match', p_id::text, jsonb_build_object('reason', p_reason));
end $$;
