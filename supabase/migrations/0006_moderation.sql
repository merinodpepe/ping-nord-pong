-- Moderación (9.4, 9.5): acciones de panel, reputación automática y detección de amaños.

create or replace function admin_set_status(p_profile uuid, p_status user_status, p_days int, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false); target profiles;
begin
  if not is_mod() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_reason is null or char_length(btrim(p_reason)) = 0 or char_length(p_reason) > 300 then raise exception 'reason_required'; end if;
  select * into target from profiles where id = p_profile for update;
  if not found then raise exception 'not_found'; end if;
  if target.role <> 'user' and me.role <> 'admin' then raise exception 'forbidden' using errcode = '42501'; end if;
  if target.id = me.id then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status = 'limited' and coalesce(p_days, 0) < 1 then raise exception 'days_required'; end if;
  update profiles set status = p_status,
         limited_until = case when p_status = 'limited' then now() + make_interval(days => p_days) else null end
   where id = p_profile;
  if p_status = 'limited' then perform notify(p_profile, 'account_limited', null, p_reason);
  elsif p_status = 'banned' then perform notify(p_profile, 'account_banned', null, p_reason);
  end if;
  perform log_audit(me.id, 'set_status', p_profile::text, jsonb_build_object('status', p_status, 'days', p_days, 'reason', p_reason));
end $$;

create or replace function admin_force_alias(p_profile uuid, p_alias text, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false); old text;
begin
  if not is_mod() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_reason is null or char_length(btrim(p_reason)) = 0 then raise exception 'reason_required'; end if;
  perform check_alias(p_alias);
  select alias::text into old from profiles where id = p_profile for update;
  if not found then raise exception 'not_found'; end if;
  update profiles set alias = normalize(p_alias, NFKC) where id = p_profile;
  perform notify(p_profile, 'alias_changed', null, p_reason);
  perform log_audit(me.id, 'force_alias', p_profile::text, jsonb_build_object('old', old, 'new', p_alias, 'reason', p_reason));
exception when unique_violation then
  raise exception 'alias_taken';
end $$;

create or replace function admin_resolve_report(p_id uuid, p_status report_status, p_note text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false);
begin
  if not is_mod() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status = 'open' then raise exception 'bad_status'; end if;
  if p_note is null or char_length(btrim(p_note)) = 0 then raise exception 'reason_required'; end if;
  update reports set status = p_status, resolved_by = me.id, resolved_at = now() where id = p_id and status = 'open';
  if not found then raise exception 'not_found'; end if;
  perform log_audit(me.id, 'resolve_report', p_id::text, jsonb_build_object('status', p_status, 'note', p_note));
end $$;

create or replace function admin_review_flag(p_id bigint, p_status text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false);
begin
  if not is_mod() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('reviewed','dismissed') then raise exception 'bad_status'; end if;
  update auto_flags set status = p_status where id = p_id;
  perform log_audit(me.id, 'review_flag', p_id::text, jsonb_build_object('status', p_status));
end $$;

create or replace function admin_set_role(p_profile uuid, p_role user_role) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false);
begin
  if me.role <> 'admin' then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_profile = me.id then raise exception 'forbidden' using errcode = '42501'; end if;
  update profiles set role = p_role where id = p_profile;
  perform log_audit(me.id, 'set_role', p_profile::text, jsonb_build_object('role', p_role));
end $$;

create or replace function admin_recompute(p_from timestamptz) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false);
begin
  if not is_mod() then raise exception 'forbidden' using errcode = '42501'; end if;
  perform recompute_elo_from(p_from);
  perform log_audit(me.id, 'admin_recompute', p_from::text);
end $$;

-- Tarjeta "Salud" del panel (14.6)
create or replace function admin_health() returns table(source text, last_ping timestamptz, age_hours numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not is_mod() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query select k.source, k.last_ping, round(extract(epoch from now() - k.last_ping) / 3600, 1) from keepalive k order by k.source;
end $$;

-- Perfiles para el panel (alias + estado + rol), sin emails
create or replace function admin_find_profiles(p_q text) returns table(id uuid, alias text, role user_role, status user_status, limited_until timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not is_mod() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query select p.id, p.alias::text, p.role, p.status, p.limited_until, p.created_at
    from profiles p where p.alias ilike '%' || replace(replace(p_q, '%', ''), '_', '') || '%' order by p.alias limit 30;
end $$;

-- ---------- reputación automática (9.4), a diario ----------
create or replace function apply_reputation_rules() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; c int := 0;
begin
  -- fin de limitaciones vencidas
  update profiles set status = 'active', limited_until = null
   where status = 'limited' and limited_until is not null and limited_until <= now();

  for r in
    select created_by as pid, count(*) as made,
           count(*) filter (where status = 'rejected' and reject_reason in ('wrong_result','not_played')) as bad
      from matches
     where created_at > now() - interval '7 days' and created_by is not null
       -- tras cumplir una limitación, solo cuentan los partidos creados después (si no, se volvería a limitar al instante)
       and created_at > coalesce((select max(a.created_at) from audit_log a
                                   where a.action = 'auto_limit' and a.target = matches.created_by::text), '-infinity')
     group by created_by
    having count(*) filter (where status = 'rejected' and reject_reason in ('wrong_result','not_played')) >= 3
       and count(*) filter (where status = 'rejected' and reject_reason in ('wrong_result','not_played')) * 2 > count(*)
  loop
    update profiles set status = 'limited', limited_until = now() + interval '7 days'
     where id = r.pid and status = 'active' and role = 'user';
    if found then
      perform notify(r.pid, 'account_limited', null, 'rejected_ratio');
      perform log_audit(null, 'auto_limit', r.pid::text, jsonb_build_object('made', r.made, 'bad', r.bad));
      c := c + 1;
    end if;
  end loop;
  return c;
end $$;

-- ---------- detección de amaños (solo marca) ----------
create or replace function detect_collusion() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare total int := 0; c int;
begin
  -- 1) pareja con más de 10 partidos en 7 días
  insert into auto_flags (kind, profile_a, profile_b, details)
  select 'pair_volume', h.a, h.b, jsonb_build_object('matches', h.n)
    from (select least(pa.profile_id, pb.profile_id) a, greatest(pa.profile_id, pb.profile_id) b, count(*) n
            from matches m join match_players pa on pa.match_id = m.id and pa.team = 'A'
            join match_players pb on pb.match_id = m.id and pb.team = 'B'
           where m.status = 'confirmed' and m.confirmed_at > now() - interval '7 days'
             and pa.profile_id is not null and pb.profile_id is not null
           group by 1, 2 having count(*) > 10) h
  on conflict do nothing;
  get diagnostics c = row_count; total := total + c;

  -- 2) resultados que se alternan de forma sistemática (últimos 6 entre la pareja en 14 días)
  total := total + detect_alternating();

  -- 3) cuenta cuyo ELO positivo viene en más de un 60 % de un único rival (mínimo 8 partidos)
  insert into auto_flags (kind, profile_a, profile_b, details)
  select 'single_source', s.pid, s.rid, jsonb_build_object('share', round(s.share, 2), 'matches', s.n)
    from (select pid, rid, n, gain_rival / nullif(gain_total, 0) as share from (
            select pa.profile_id pid, pb.profile_id rid, count(*) n,
                   sum(greatest(pa.delta, 0)) as gain_rival,
                   sum(sum(greatest(pa.delta, 0))) over (partition by pa.profile_id) as gain_total,
                   sum(count(*)) over (partition by pa.profile_id) as n_total
              from matches m join match_players pa on pa.match_id = m.id
              join match_players pb on pb.match_id = m.id and pb.team <> pa.team
             where m.mode = '1v1' and m.status = 'confirmed' and pa.profile_id is not null and pb.profile_id is not null
             group by pa.profile_id, pb.profile_id) g where n_total >= 8) s
   where s.share > 0.6
  on conflict do nothing;
  get diagnostics c = row_count; total := total + c;

  -- 4) marcadores idénticos repetidos (3+ veces en 7 días entre la misma pareja)
  insert into auto_flags (kind, profile_a, profile_b, details)
  select 'repeated_score', r.a, r.b, jsonb_build_object('sets', r.sig, 'times', r.n)
    from (select a, b, sig, count(*) n from (
            select least(pa.profile_id, pb.profile_id) a, greatest(pa.profile_id, pb.profile_id) b,
                   (select string_agg(s.score_a || '-' || s.score_b, ',' order by s.set_no) from match_sets s where s.match_id = m.id)
                     || '|' || m.winner_team || (pa.profile_id = least(pa.profile_id, pb.profile_id))::text as sig
              from matches m join match_players pa on pa.match_id = m.id and pa.team = 'A'
              join match_players pb on pb.match_id = m.id and pb.team = 'B'
             where m.mode = '1v1' and m.status = 'confirmed' and m.confirmed_at > now() - interval '7 days'
               and pa.profile_id is not null and pb.profile_id is not null) q
           group by a, b, sig having count(*) >= 3) r
  on conflict do nothing;
  get diagnostics c = row_count; total := total + c;

  -- 5) cuentas nuevas (< 14 días) que solo juegan entre sí
  insert into auto_flags (kind, profile_a, details)
  select 'new_cluster', p.id, jsonb_build_object('matches', n.cnt)
    from profiles p
    cross join lateral (select count(*) cnt from head_to_head h where h.player_id = p.id) n
   where p.created_at > now() - interval '14 days' and p.role = 'user' and n.cnt >= 1
     and (select coalesce(sum(h.total), 0) from head_to_head h where h.player_id = p.id) >= 3
     and not exists (select 1 from head_to_head h join profiles o on o.id = h.rival_id
                      where h.player_id = p.id and o.created_at <= now() - interval '14 days')
  on conflict do nothing;
  get diagnostics c = row_count; total := total + c;
  return total;
end $$;

create or replace function detect_alternating() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare c int;
begin
  with g as (
    select least(pa.profile_id, pb.profile_id) a, greatest(pa.profile_id, pb.profile_id) b,
           ((m.winner_team = pa.team) = (pa.profile_id < pb.profile_id)) as low_won,
           row_number() over (partition by least(pa.profile_id, pb.profile_id), greatest(pa.profile_id, pb.profile_id)
                              order by m.confirmed_at desc, m.id desc) as rn
      from matches m join match_players pa on pa.match_id = m.id and pa.team = 'A'
      join match_players pb on pb.match_id = m.id and pb.team = 'B'
     where m.mode = '1v1' and m.status = 'confirmed' and m.confirmed_at > now() - interval '14 days'
       and pa.profile_id is not null and pb.profile_id is not null
  ), last6 as (select * from g where rn <= 6)
  insert into auto_flags (kind, profile_a, profile_b, details)
  select 'alternating', a, b, jsonb_build_object('last', 6)
    from last6 l group by a, b
  having count(*) = 6
     and not exists (select 1 from last6 x join last6 y on y.a = x.a and y.b = x.b and y.rn = x.rn + 1
                      where x.a = l.a and x.b = l.b and x.low_won = y.low_won)
  on conflict do nothing;
  get diagnostics c = row_count;
  return c;
end $$;
