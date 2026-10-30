-- Perfil, onboarding, retos, chat, bloqueos, reportes y avisos.

create or replace function complete_onboarding(p_alias text, p_locale text, p_terms_version text, p_avatar_color int default null)
returns profiles
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); p profiles; col int;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if exists (select 1 from profiles where id = uid) then raise exception 'already_onboarded'; end if;
  if p_locale not in ('es','ca','en','zh','de') then raise exception 'bad_locale'; end if;
  if p_terms_version is distinct from cfg('terms_version') then raise exception 'bad_terms_version'; end if;
  perform check_alias(p_alias);
  -- color por hash del id (determinista) si no se elige
  col := coalesce(p_avatar_color, abs(hashtext(uid::text)) % 7);
  insert into profiles (id, alias, avatar_color, locale, terms_version, terms_accepted_at)
  values (uid, normalize(p_alias, NFKC), col, p_locale, p_terms_version, now())
  returning * into p;
  return p;
exception when unique_violation then
  raise exception 'alias_taken';
end $$;

create or replace function update_profile(p_alias text default null, p_avatar_color int default null, p_locale text default null)
returns profiles
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false); p profiles;
begin
  if p_alias is not null and p_alias <> me.alias::text then
    perform rate_hit(me.id, 'alias_change', 3, interval '30 days');
    perform check_alias(p_alias);
  end if;
  if p_locale is not null and p_locale not in ('es','ca','en','zh','de') then raise exception 'bad_locale'; end if;
  if p_avatar_color is not null and p_avatar_color not between 0 and 6 then raise exception 'bad_color'; end if;
  update profiles set alias = coalesce(normalize(p_alias, NFKC), alias),
         avatar_color = coalesce(p_avatar_color, avatar_color), locale = coalesce(p_locale, locale)
   where id = me.id returning * into p;
  return p;
exception when unique_violation then
  raise exception 'alias_taken';
end $$;

-- Aceptar una nueva versión de los términos
create or replace function accept_terms(p_version text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false);
begin
  if p_version is distinct from cfg('terms_version') then raise exception 'bad_terms_version'; end if;
  update profiles set terms_version = p_version, terms_accepted_at = now() where id = me.id;
end $$;

-- ---------- bloqueos ----------
create or replace function block_user(p_target uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false);
begin
  if p_target = me.id then raise exception 'cannot_block_self'; end if;
  if not exists (select 1 from profiles where id = p_target) then raise exception 'not_found'; end if;
  insert into blocks (blocker, blocked) values (me.id, p_target) on conflict do nothing;
  update challenges set status = 'cancelled', closed_at = now()
   where status in ('open','accepted')
     and ((from_id = me.id and to_id = p_target) or (from_id = p_target and to_id = me.id));
  -- los partidos pendientes entre los dos dejan de ser confirmables
  update matches set status = 'rejected', reject_reason = 'other', rejected_by = me.id
   where status = 'pending' and id in (
     select a.match_id from match_players a join match_players b on a.match_id = b.match_id
      where a.profile_id = me.id and b.profile_id = p_target);
end $$;

create or replace function unblock_user(p_target uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false);
begin
  delete from blocks where blocker = me.id and blocked = p_target;
end $$;

-- ---------- retos ----------
create or replace function create_challenge(p_to uuid, p_mode match_mode default '1v1', p_proposed_at timestamptz default null, p_place text default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(true); cid uuid; open_n int;
begin
  if p_to = me.id then raise exception 'invalid_players'; end if;
  if not exists (select 1 from profiles where id = p_to and status <> 'banned') then raise exception 'not_found'; end if;
  if is_blocked_between(me.id, p_to) then raise exception 'blocked' using errcode = '42501'; end if;
  if p_place is not null and char_length(p_place) > 80 then raise exception 'place_too_long'; end if;
  if p_proposed_at is not null and p_proposed_at < now() - interval '1 hour' then raise exception 'bad_date'; end if;
  select count(*) into open_n from challenges where from_id = me.id and status = 'open';
  if open_n >= 5 then raise exception 'rate_limited: open_challenges'; end if;
  if exists (select 1 from challenges where from_id = me.id and to_id = p_to and status in ('open','accepted')) then
    raise exception 'challenge_exists';
  end if;
  insert into challenges (from_id, to_id, mode, proposed_at, place) values (me.id, p_to, p_mode, p_proposed_at, nullif(btrim(p_place), ''))
  returning id into cid;
  perform notify(p_to, 'challenge_new', cid);
  return cid;
end $$;

create or replace function respond_challenge(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false); c challenges;
begin
  select * into c from challenges where id = p_id for update;
  if not found or c.to_id <> me.id then raise exception 'not_found'; end if;
  if c.status <> 'open' then raise exception 'not_open'; end if;
  if is_blocked_between(c.from_id, c.to_id) then raise exception 'blocked' using errcode = '42501'; end if;
  if p_accept then
    update challenges set status = 'accepted' where id = p_id;
    perform notify(c.from_id, 'challenge_accepted', p_id);
  else
    update challenges set status = 'declined', closed_at = now() where id = p_id;
  end if;
end $$;

create or replace function cancel_challenge(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false); c challenges;
begin
  select * into c from challenges where id = p_id for update;
  if not found or me.id not in (c.from_id, c.to_id) then raise exception 'not_found'; end if;
  if c.status not in ('open','accepted') then raise exception 'not_open'; end if;
  update challenges set status = 'cancelled', closed_at = now() where id = p_id;
end $$;

-- ---------- chat ----------
create or replace function send_message(p_challenge uuid, p_body text) returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(true); c challenges; body text := btrim(p_body); mid bigint; other uuid;
begin
  if body is null or char_length(body) not between 1 and 500 then raise exception 'bad_message'; end if;
  select * into c from challenges where id = p_challenge;
  if not found or me.id not in (c.from_id, c.to_id) then raise exception 'not_found'; end if;
  if not (c.status in ('open','accepted') or (c.status = 'done' and c.closed_at > now() - interval '7 days')) then
    raise exception 'chat_closed';
  end if;
  other := case when c.from_id = me.id then c.to_id else c.from_id end;
  if is_blocked_between(me.id, other) then raise exception 'blocked' using errcode = '42501'; end if;
  perform rate_hit(me.id, 'chat_minute', 20, interval '1 minute');
  perform rate_hit(me.id, 'chat_day', 300, interval '1 day');
  insert into messages (challenge_id, sender_id, body, flagged)
  values (p_challenge, me.id, body, wordlist_hit('chat', body) or body ~* '(https?://|www\.|\.(com|net|org|es|cat|ru|xyz)(\W|$))')
  returning id into mid;
  return mid;
end $$;

-- ---------- reportes ----------
create or replace function create_report(p_reason text, p_details text, p_profile uuid default null, p_match uuid default null, p_message bigint default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false); rid uuid;
begin
  if num_nonnulls(p_profile, p_match, p_message) <> 1 then raise exception 'bad_target'; end if;
  perform rate_hit(me.id, 'report', 10, interval '1 day');
  -- solo se puede reportar lo que se ve: un partido en el que se juega o está confirmado, un mensaje de un chat propio
  if p_match is not null and not exists (
       select 1 from matches m where m.id = p_match and (m.status = 'confirmed'
         or exists (select 1 from match_players where match_id = m.id and profile_id = me.id))) then
    raise exception 'not_found';
  end if;
  if p_message is not null and not exists (
       select 1 from messages ms join challenges c on c.id = ms.challenge_id
        where ms.id = p_message and me.id in (c.from_id, c.to_id)) then
    raise exception 'not_found';
  end if;
  insert into reports (reporter_id, target_profile, target_match, target_message, reason, details)
  values (me.id, p_profile, p_match, p_message, p_reason, nullif(btrim(p_details), '')) returning id into rid;
  return rid;
end $$;

-- ---------- avisos ----------
create or replace function mark_notifications_read(p_ids bigint[] default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false);
begin
  update notifications set read_at = now()
   where profile_id = me.id and read_at is null and (p_ids is null or id = any(p_ids));
end $$;

-- Contadores para la navegación y el banner de caducidad
create or replace function my_inbox() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare me profiles := require_user(false);
begin
  return jsonb_build_object(
    'pending_to_confirm', (select count(*) from matches m
        where m.status = 'pending' and m.expires_at > now() and m.created_by <> me.id
          and exists (select 1 from match_players where match_id = m.id and profile_id = me.id)),
    'next_expiry', (select min(m.expires_at) from matches m
        where m.status = 'pending' and m.expires_at > now() and m.created_by <> me.id
          and exists (select 1 from match_players where match_id = m.id and profile_id = me.id)),
    'new_challenges', (select count(*) from challenges where to_id = me.id and status = 'open'),
    'unread', (select count(*) from notifications where profile_id = me.id and read_at is null));
end $$;
