-- RLS y privilegios (7.2). Por defecto todo denegado; los clientes escriben solo vía RPC.

create or replace function is_participant(p_match uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from match_players where match_id = p_match and profile_id = auth.uid())
$$;

create or replace function in_challenge(p_challenge uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from challenges where id = p_challenge and auth.uid() in (from_id, to_id))
$$;

-- Contexto de un reporte para moderación: el mensaje reportado y los cercanos (los chats no son legibles de otro modo)
create or replace function admin_report_context(p_report uuid)
returns table(id bigint, sender_alias text, body text, flagged boolean, created_at timestamptz, is_target boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare tm bigint; ch uuid;
begin
  if not is_mod() then raise exception 'forbidden' using errcode = '42501'; end if;
  select r.target_message into tm from reports r where r.id = p_report;
  if tm is null then return; end if;
  select challenge_id into ch from messages where messages.id = tm;
  return query
    select ms.id, p.alias::text, ms.body, ms.flagged, ms.created_at, ms.id = tm
      from messages ms left join profiles p on p.id = ms.sender_id
     where ms.challenge_id = ch and ms.id between tm - 5 and tm + 5 order by ms.id;
end $$;

-- ---------- privilegios base: nada ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

-- ---------- RLS en todas las tablas ----------
alter table app_config      enable row level security;
alter table profiles        enable row level security;
alter table matches         enable row level security;
alter table match_players   enable row level security;
alter table match_sets      enable row level security;
alter table challenges      enable row level security;
alter table messages        enable row level security;
alter table blocks          enable row level security;
alter table reports         enable row level security;
alter table rivalry_meta    enable row level security;   -- sin políticas: se lee solo vía la vista rivalries
alter table notifications   enable row level security;
alter table audit_log       enable row level security;
alter table rate_events     enable row level security;
alter table auth_throttle   enable row level security;
alter table auto_flags      enable row level security;
alter table wordlist        enable row level security;
alter table keepalive       enable row level security;

-- profiles: el dueño (y moderación) lee su fila. El público lee la vista public_profiles. Nadie actualiza directo: update_profile().
grant select on profiles to authenticated;
create policy profiles_select on profiles for select to authenticated using (id = auth.uid() or is_mod());

-- partidos: público solo confirmados; jugadores, además los suyos
grant select on matches, match_players, match_sets to anon, authenticated;
create policy matches_select on matches for select to anon, authenticated
  using (status = 'confirmed' or is_participant(id) or is_mod());
create policy match_players_select on match_players for select to anon, authenticated
  using (exists (select 1 from matches m where m.id = match_id and m.status = 'confirmed') or is_participant(match_id) or is_mod());
create policy match_sets_select on match_sets for select to anon, authenticated
  using (exists (select 1 from matches m where m.id = match_id and m.status = 'confirmed') or is_participant(match_id) or is_mod());

grant select on challenges, messages to authenticated;
create policy challenges_select on challenges for select to authenticated using (auth.uid() in (from_id, to_id));
create policy messages_select on messages for select to authenticated using (in_challenge(challenge_id));

grant select on blocks to authenticated;
create policy blocks_select on blocks for select to authenticated using (blocker = auth.uid());

grant select on reports to authenticated;
create policy reports_select on reports for select to authenticated using (reporter_id = auth.uid() or is_mod());

grant select on notifications to authenticated;
grant update (read_at) on notifications to authenticated;
create policy notifications_select on notifications for select to authenticated using (profile_id = auth.uid());
create policy notifications_update on notifications for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

grant select on audit_log, rate_events, auto_flags to authenticated;
create policy audit_select on audit_log for select to authenticated using (is_mod());
create policy rate_select on rate_events for select to authenticated using (is_mod());
create policy flags_select on auto_flags for select to authenticated using (is_mod());

-- ---------- vistas públicas ----------
grant select on player_mode_stats, public_profiles, public_matches, public_match_players, elo_history, head_to_head, rivalries
  to anon, authenticated;

-- ---------- funciones expuestas ----------
grant execute on function auth.uid() to anon, authenticated;
grant execute on function is_mod(), is_participant(uuid), in_challenge(uuid) to anon, authenticated;
grant execute on function
  complete_onboarding(text, text, text, int), update_profile(text, int, text), accept_terms(text),
  block_user(uuid), unblock_user(uuid),
  create_challenge(uuid, match_mode, timestamptz, text), respond_challenge(uuid, boolean), cancel_challenge(uuid),
  send_message(uuid, text), create_report(text, text, uuid, uuid, bigint),
  mark_notifications_read(bigint[]), my_inbox(),
  create_match(match_mode, int, int, boolean, uuid[], uuid[], jsonb, uuid, uuid),
  confirm_match(uuid), reject_match(uuid, text), void_match(uuid, text),
  export_my_data(), delete_my_account(),
  admin_set_status(uuid, user_status, int, text), admin_force_alias(uuid, text, text),
  admin_resolve_report(uuid, report_status, text), admin_review_flag(bigint, text), admin_set_role(uuid, user_role),
  admin_recompute(timestamptz), admin_health(), admin_find_profiles(text), admin_report_context(uuid)
  to authenticated;

-- solo servidor
grant execute on function throttle_hit(text, int, interval) to service_role;
grant execute on function expire_pending_matches(), purge_old_data(), apply_reputation_rules(), detect_collusion() to service_role;
grant all on all tables in schema public to service_role;

-- keepalive_* conservan los grants de 0008 (re-aplicados porque arriba se revocó a todos)
grant execute on function keepalive_ping(text), keepalive_vercel_age_hours() to anon, authenticated, service_role;

-- Realtime: avisos y chat (RLS aplica también al canal)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table notifications, messages, challenges;
  end if;
end $$;
