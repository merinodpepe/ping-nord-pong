-- Privacidad y retención (8.3): exportar, borrar cuenta y purgas.

create or replace function export_my_data() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false);
begin
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) - 'id' from profiles p where p.id = me.id),
    'matches', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'mode', m.mode, 'status', m.status, 'points_target', m.points_target, 'best_of', m.best_of,
        'winner_team', m.winner_team, 'played_at', m.played_at, 'confirmed_at', m.confirmed_at,
        'players', (select jsonb_agg(jsonb_build_object('team', x.team, 'alias', pr.alias, 'elo_before', x.elo_before,
                                                        'elo_after', x.elo_after, 'delta', x.delta, 'me', x.profile_id = me.id))
                      from match_players x left join profiles pr on pr.id = x.profile_id where x.match_id = m.id),
        'sets', (select jsonb_agg(jsonb_build_array(s.score_a, s.score_b) order by s.set_no) from match_sets s where s.match_id = m.id)
      ) order by m.played_at), '[]'::jsonb)
        from matches m where exists (select 1 from match_players where match_id = m.id and profile_id = me.id)),
    'challenges', (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at), '[]'::jsonb)
        from challenges c where me.id in (c.from_id, c.to_id)),
    'messages', (select coalesce(jsonb_agg(jsonb_build_object('challenge_id', ms.challenge_id, 'body', ms.body,
                                                              'sent_by_me', ms.sender_id = me.id, 'created_at', ms.created_at)
                                           order by ms.created_at), '[]'::jsonb)
        from messages ms join challenges c on c.id = ms.challenge_id where me.id in (c.from_id, c.to_id)),
    'blocks', (select coalesce(jsonb_agg(jsonb_build_object('blocked', pr.alias, 'created_at', b.created_at)), '[]'::jsonb)
        from blocks b join profiles pr on pr.id = b.blocked where b.blocker = me.id),
    'reports_sent', (select coalesce(jsonb_agg(jsonb_build_object('reason', r.reason, 'details', r.details, 'status', r.status,
                                                                  'created_at', r.created_at)), '[]'::jsonb)
        from reports r where r.reporter_id = me.id),
    'notifications', (select coalesce(jsonb_agg(jsonb_build_object('kind', n.kind, 'created_at', n.created_at, 'read_at', n.read_at)), '[]'::jsonb)
        from notifications n where n.profile_id = me.id));
end $$;

-- Borrado inmediato. Los partidos confirmados se conservan sin identificar (match_players.profile_id pasa a null).
create or replace function delete_my_account() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false);
begin
  delete from matches m where m.status <> 'confirmed'
    and exists (select 1 from match_players where match_id = m.id and profile_id = me.id);
  delete from messages where sender_id = me.id;
  delete from reports where reporter_id = me.id;
  delete from rate_events where profile_id = me.id;
  delete from notifications where profile_id = me.id;
  delete from auth.users where id = me.id;   -- cascada a profiles, retos, bloqueos y rivalidades
  perform log_audit(null, 'delete_account', null);   -- sin id: no queda rastro identificable
end $$;

-- Purgas de retención (pg_cron, a diario)
create or replace function purge_old_data() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from messages where created_at < now() - interval '90 days';
  delete from matches where status in ('pending','rejected','expired') and created_at < now() - interval '30 days';
  delete from rate_events where created_at < now() - interval '30 days';
  delete from notifications where created_at < now() - interval '30 days';
  delete from auth_throttle where created_at < now() - interval '2 days';
  delete from audit_log where created_at < now() - interval '1 year';
  delete from auto_flags where created_at < now() - interval '90 days';
  delete from reports where status <> 'open' and created_at < now() - interval '1 year';
  -- cuentas inactivas 2 años (sin partidos ni acceso); no se toca a moderación
  delete from auth.users u using profiles p
   where p.id = u.id and p.role = 'user'
     and greatest(coalesce(p.last_played_at, p.created_at), p.created_at, coalesce(u.last_sign_in_at, p.created_at)) < now() - interval '2 years';
end $$;
