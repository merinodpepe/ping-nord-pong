begin;
-- Onboarding y alias
do $$ declare u uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); p profiles;
begin
  insert into auth.users (id, email) values (u, 'cualquiera@gmail.com'), (u2, 'otro@outlook.com');
  perform t.as_user(u);
  perform t.fails($q$select complete_onboarding('admin', 'es', '2026-11-01')$q$, 'bad_alias', 'alias reservado');
  perform t.fails($q$select complete_onboarding('Pingnordpong', 'es', '2026-11-01')$q$, 'bad_alias', 'alias reservado (marca)');
  perform t.fails($q$select complete_onboarding('pu7a', 'es', '2026-11-01')$q$, 'bad_alias', 'alias ofensivo con leet');
  perform t.fails($q$select complete_onboarding('ab', 'es', '2026-11-01')$q$, 'bad_alias', 'alias demasiado corto');
  perform t.fails($q$select complete_onboarding('ana lópez', 'es', '2026-11-01')$q$, 'bad_alias', 'alias con espacios o tildes');
  perform t.fails($q$select complete_onboarding('Ana.99', 'es', '1999-01-01')$q$, 'bad_terms_version', 'versión de términos obligatoria');
  p := complete_onboarding('Ana.99', 'ca', '2026-11-01');
  perform t.eq(p.locale, 'ca', 'onboarding guarda idioma');
  perform t.ok(p.terms_accepted_at is not null, 'guarda aceptación de términos');
  perform t.fails($q$select complete_onboarding('Otra', 'es', '2026-11-01')$q$, 'already_onboarded', 'solo una vez');
  perform t.su(); perform t.as_user(u2);
  perform t.fails($q$select complete_onboarding('ana.99', 'es', '2026-11-01')$q$, 'alias_taken', 'alias único sin mayúsculas');
  perform t.su();
  perform t.as_user(u);
  p := update_profile(p_avatar_color => 3, p_locale => 'de');
  perform t.ok(p.avatar_color = 3 and p.locale = 'de', 'update_profile');
  perform t.fails($q$select update_profile(p_locale => 'fr')$q$, 'bad_locale', 'idioma inválido');
  perform t.su();
end $$;
rollback;
begin;

-- Retos, chat y bloqueos
do $$ declare a uuid := t.mkuser('ana'); b uuid := t.mkuser('marc'); c uuid := t.mkuser('lia'); ch uuid; i int; mid bigint; fl boolean;
begin
  perform t.as_user(a);
  ch := create_challenge(b, '1v1', now() + interval '1 day', 'Mesa del Campus Nord');
  perform t.fails(format('select create_challenge(%L)', b), 'challenge_exists', 'no se duplica el reto');
  perform t.fails(format('select create_challenge(%L)', a), 'invalid_players', 'no te retas a ti');
  perform t.fails(format('select send_message(%L, repeat(''x'', 501))', ch), 'bad_message', 'máximo 500 caracteres');
  mid := send_message(ch, 'mira https://malo.example/promo');
  select flagged into fl from messages where id = mid;
  perform t.ok(fl, 'los enlaces se marcan');
  mid := send_message(ch, 'jugamos a las 5?');
  select flagged into fl from messages where id = mid;
  perform t.ok(not fl, 'mensaje normal sin marca');
  for i in 1 .. 18 loop perform send_message(ch, 'ping ' || i); end loop;
  perform t.fails(format($q$select send_message(%L, 'uno más')$q$, ch), 'rate_limited', '20 mensajes por minuto');
  perform t.su();
  perform t.as_user(b); perform respond_challenge(ch, true); perform t.su();
  perform t.eq((select status from challenges where id = ch), 'accepted'::challenge_status, 'reto aceptado');
  -- partido desde el reto -> el reto pasa a done
  perform t.as_user(a);
  perform create_match('1v1', 11, 1, true, array[a], array[b], '[[11,2]]', null, ch);
  perform t.su();
  perform t.as_user(b); perform confirm_match((select id from matches where challenge_id = ch)); perform t.su();
  perform t.eq((select status from challenges where id = ch), 'done'::challenge_status, 'reto done al confirmar');
  -- bloqueo
  perform t.as_user(c); ch := create_challenge(b); perform t.su();
  perform t.as_user(b); perform block_user(c); perform t.su();
  perform t.eq((select status from challenges where id = ch), 'cancelled'::challenge_status, 'bloquear cierra los retos abiertos');
  perform t.as_user(c);
  perform t.fails(format('select create_challenge(%L)', b), 'blocked', 'bloqueado no puede retar');
  perform t.fails(format($q$select create_match('1v1', 11, 1, true, array[%L::uuid], array[%L::uuid], '[[11,5]]')$q$, c, b), 'blocked', 'bloqueado no apunta partidos');
  perform t.fails(format($q$select send_message(%L, 'hola')$q$, ch), 'chat_closed', 'chat cerrado tras cancelar');
  perform t.su();
end $$;
rollback;
begin;

-- Reportes, moderación y chat reportado
do $$ declare a uuid := t.mkuser('ana'); b uuid := t.mkuser('marc'); c uuid := t.mkuser('lia');
  mod_ uuid := t.mkuser('mod1','mod'); adm uuid := t.mkuser('boss','admin');
  mid uuid; rid uuid; ch uuid; msg bigint; i int;
begin
  mid := t.play(a, b);
  perform t.as_user(b); rid := create_report('fake_result', 'no jugamos', null, mid); perform t.su();
  perform t.as_user(a);
  perform t.eq((select count(*) from reports)::int, 0, 'el reporte ajeno no se ve');
  perform t.fails(format($q$select create_report('fake_result', null, null, %L)$q$, gen_random_uuid()), 'not_found', 'no se reporta lo que no se ve');
  perform t.fails($q$select create_report('fake_result', null, null, null)$q$, 'bad_target', 'un reporte necesita objetivo');
  ch := create_challenge(b); msg := send_message(ch, 'eres malo'); perform t.su();
  perform t.as_user(b); rid := create_report('harassment', null, null, null, msg); perform t.su();
  perform t.as_user(c);
  perform t.fails(format($q$select create_report('harassment', null, null, null, %s)$q$, msg), 'not_found', 'tercero no reporta un chat que no ve');
  for i in 1 .. 10 loop begin perform create_report('spam', null, a); exception when others then null; end; end loop;
  perform t.fails(format($q$select create_report('spam', null, %L)$q$, a), 'rate_limited', '10 reportes al día');
  perform t.su();
  perform t.as_user(mod_);
  perform t.ok((select count(*) from reports) >= 2, 'moderación ve los reportes');
  perform t.ok((select count(*) from admin_report_context((select id from reports where target_message = msg))) >= 1, 'contexto del chat reportado');
  perform admin_resolve_report((select id from reports where target_message = msg), 'resolved', 'avisado');
  perform t.fails(format($q$select admin_set_status(%L, 'limited', 0, 'x')$q$, a), 'days_required', 'limitar exige días');
  perform admin_set_status(a, 'limited', 3, 'insultos en el chat');
  perform t.eq((select status from profiles where id = a), 'limited'::user_status, 'moderación limita');
  perform t.fails(format($q$select admin_set_status(%L, 'banned', null, 'x')$q$, adm), 'forbidden', 'mod no toca a un admin');
  perform admin_force_alias(c, 'Lia.Mod', 'alias ofensivo');
  perform t.eq((select alias::text from profiles where id = c), 'Lia.Mod', 'alias forzado');
  perform t.ok((select count(*) from audit_log where actor_id = mod_) >= 3, 'cada acción queda en audit_log');
  perform t.ok((select count(*) from admin_health()) = 2, 'tarjeta Salud');
  perform t.su();
  perform t.as_user(adm); perform admin_set_status(b, 'banned', null, 'cuentas múltiples'); perform t.su();
  perform t.as_user(b);
  perform t.fails($q$select my_inbox()$q$, 'banned', 'un baneado no puede actuar');
  perform t.su();
  perform t.eq((select count(*) from public_profiles where alias = 'marc')::int, 0, 'baneado fuera del ranking');
end $$;
rollback;
begin;

-- Privacidad: exportar y borrar cuenta
do $$ declare a uuid := t.mkuser('ana'); b uuid := t.mkuser('marc'); mid uuid; pend uuid; ex jsonb; ch uuid;
begin
  mid := t.play(a, b);
  perform t.as_user(a);
  pend := create_match('1v1', 11, 1, true, array[a], array[b], '[[11,4]]');
  ch := create_challenge(b); perform send_message(ch, 'hola');
  ex := export_my_data();
  perform t.ok(jsonb_array_length(ex -> 'matches') = 2 and jsonb_array_length(ex -> 'messages') = 1 and ex ->> 'profile' is not null,
               'exportar incluye perfil, partidos y mensajes');
  perform t.ok(position('example.com' in ex::text) = 0, 'la exportación no incluye emails ajenos');
  perform delete_my_account();
  perform t.su();
  perform t.eq((select count(*) from auth.users where id = a)::int, 0, 'borrado el usuario de auth');
  perform t.eq((select count(*) from profiles where id = a)::int, 0, 'borrado el perfil');
  perform t.eq((select count(*) from matches where id = pend)::int, 0, 'borrados los pendientes');
  perform t.eq((select count(*) from messages)::int, 0, 'borrados los mensajes');
  perform t.eq((select status from matches where id = mid), 'confirmed'::match_status, 'el partido confirmado se conserva');
  perform t.ok((select profile_id is null from match_players where match_id = mid and team = 'A'), 'jugador pasa a "eliminado" (profile_id null)');
  perform t.eq((select alias from public_match_players where match_id = mid and team = 'A'), null::text, 'sin alias en la vista pública');
  perform t.eq((select elo_single from profiles where id = b), 991 + 0 * 1, 'el rival conserva su ELO') ;
end $$;
rollback;
begin;

-- Purga de retención
do $$ declare a uuid := t.mkuser('ana'); b uuid := t.mkuser('marc'); old uuid; ch uuid; keep uuid;
begin
  perform t.as_user(a); ch := create_challenge(b); perform send_message(ch, 'viejo'); perform t.su();
  update messages set created_at = now() - interval '91 days';
  perform t.as_user(a); old := create_match('1v1', 11, 1, true, array[a], array[b], '[[11,5]]'); perform t.su();
  update matches set created_at = now() - interval '31 days', status = 'expired' where id = old;
  keep := t.play(a, b);
  insert into rate_events values (a, 'x', now() - interval '31 days');
  insert into audit_log (action, created_at) values ('viejo', now() - interval '2 years');
  update profiles set created_at = now() - interval '3 years' where id = b;
  update auth.users set last_sign_in_at = now() - interval '3 years' where id = b;
  update profiles set last_played_at = null where id = b;
  perform purge_old_data();
  perform t.eq((select count(*) from messages)::int, 0, 'purga mensajes > 90 días');
  perform t.eq((select count(*) from matches where id = old)::int, 0, 'purga partidos expirados > 30 días');
  perform t.eq((select count(*) from matches where id = keep)::int, 1, 'los confirmados no se purgan');
  perform t.eq((select count(*) from rate_events where kind = 'x')::int, 0, 'purga rate_events');
  perform t.eq((select count(*) from audit_log where action = 'viejo')::int, 0, 'purga audit_log > 1 año');
end $$;
rollback;
begin;

-- Keepalive
do $$ declare t1 timestamptz; t2 timestamptz;
begin
  perform t.as_anon();
  t1 := keepalive_ping('github');
  t2 := keepalive_ping('github');
  perform t.eq(t1, t2, 'keepalive: máximo una escritura por hora');
  perform t.fails($q$select keepalive_ping('otro')$q$, 'bad source', 'fuente inválida');
  perform t.ok(keepalive_vercel_age_hours() >= 0, 'edad del ping de Vercel');
  perform t.fails('select * from keepalive', '42501', 'keepalive no se lee directo');
  perform t.su();
  update keepalive set last_ping = now() - interval '2 hours' where source = 'vercel';
  perform t.as_anon(); t1 := keepalive_ping('vercel'); perform t.su();
  perform t.eq((select count from keepalive where source = 'vercel'), 1::bigint, 'ping de Vercel registrado');
end $$;
rollback;
begin;

-- Detección de amaños: solo marca
do $$ declare a uuid := t.mkuser('ana'); b uuid := t.mkuser('marc'); i int; mid uuid; n int;
begin
  for i in 1 .. 6 loop
    mid := case when i % 2 = 1 then t.play(a, b, '[[11,5]]') else t.play(b, a, '[[11,5]]') end;
    update matches set created_at = now() - interval '5 days', confirmed_at = now() - make_interval(hours => 30 - i) where id = mid;
  end loop;
  n := detect_collusion();
  perform t.ok(exists (select 1 from auto_flags where kind = 'alternating'), 'marca resultados alternos');
  perform t.ok(exists (select 1 from auto_flags where kind = 'repeated_score'), 'marca marcadores idénticos repetidos');
  perform t.ok(not exists (select 1 from profiles where status <> 'active'), 'solo marca: nadie castigado');
  perform t.eq(detect_collusion(), 0, 'no duplica marcas el mismo día');
end $$;
rollback;
