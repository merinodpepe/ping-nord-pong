-- Vistas públicas (solo lectura, sin emails). Pertenecen al propietario de la tabla, así que leen sin pasar por RLS.

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
       coalesce(p.last_played_at > now() - interval '30 days', false) as is_active
  from profiles p
  cross join (values ('1v1'::match_mode), ('2v2'::match_mode)) as md(mode)
  left join agg a on a.profile_id = p.id and a.mode = md.mode
  left join streak s on s.profile_id = p.id and s.mode = md.mode
 where p.status <> 'banned';

create or replace view public_profiles as
select p.id, p.alias::text as alias, p.avatar_color, p.elo_single, p.elo_double, p.games_single, p.games_double,
       p.games_single < 10 as is_provisional_single, p.games_double < 10 as is_provisional_double,
       coalesce(p.last_played_at > now() - interval '30 days', false) as is_active,
       p.last_played_at, p.created_at
  from profiles p where p.status <> 'banned';

create or replace view public_matches as
select m.id, m.mode, m.points_target, m.best_of, m.win_by_two, m.winner_team, m.played_at, m.confirmed_at,
       (select coalesce(jsonb_agg(jsonb_build_array(s.score_a, s.score_b) order by s.set_no), '[]'::jsonb)
          from match_sets s where s.match_id = m.id) as sets
  from matches m where m.status = 'confirmed';

create or replace view public_match_players as
select mp.match_id, mp.team, mp.slot, mp.profile_id, p.alias::text as alias, p.avatar_color,
       mp.elo_before, mp.elo_after, mp.delta, mp.weight_w, mp.weight_m, mp.k
  from match_players mp
  join matches m on m.id = mp.match_id and m.status = 'confirmed'
  left join profiles p on p.id = mp.profile_id;

create or replace view elo_history as
select mp.profile_id, m.mode, m.id as match_id, m.confirmed_at, mp.elo_before, mp.elo_after, mp.delta
  from match_players mp join matches m on m.id = mp.match_id
 where m.status = 'confirmed' and mp.profile_id is not null;

create or replace view head_to_head as
select pa.profile_id as player_id, pb.profile_id as rival_id,
       count(*)::int as total,
       (count(*) filter (where m.winner_team = pa.team))::int as wins,
       (count(*) filter (where m.winner_team <> pa.team))::int as losses,
       max(m.confirmed_at) as last_at
  from matches m
  join match_players pa on pa.match_id = m.id
  join match_players pb on pb.match_id = m.id and pb.team <> pa.team
 where m.mode = '1v1' and m.status = 'confirmed' and pa.profile_id is not null and pb.profile_id is not null
 group by pa.profile_id, pb.profile_id;

-- Racha vigente de una pareja: quién gana seguido y cuántas veces
create or replace function rivalry_streak(a uuid, b uuid, out owner uuid, out len int)
language sql stable security definer set search_path = public, pg_temp as $$
  with g as (
    select m.id, m.confirmed_at,
           case when m.winner_team = pa.team then a else b end as winner,
           row_number() over (order by m.confirmed_at desc, m.id desc) as rn
      from matches m
      join match_players pa on pa.match_id = m.id and pa.profile_id = a
      join match_players pb on pb.match_id = m.id and pb.profile_id = b
     where m.mode = '1v1' and m.status = 'confirmed'
  ), f as (select winner from g where rn = 1)
  select (select winner from f),
         (coalesce((select min(rn) from g where winner <> (select winner from f)), (select count(*) + 1 from g)) - 1)::int
$$;

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
                 where m.mode = '1v1' and m.status = 'confirmed' group by m.points_target) f) as by_format
  from rivalry_meta rm
  join head_to_head h on h.player_id = rm.player_low and h.rival_id = rm.player_high
  join profiles pl on pl.id = rm.player_low and pl.status <> 'banned'
  join profiles ph on ph.id = rm.player_high and ph.status <> 'banned'
 where h.total >= cfg('rivalry_min_matches')::int;
