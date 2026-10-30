begin;
do $$ declare
  a uuid := t.mkuser('ana'); b uuid := t.mkuser('marc'); c uuid := t.mkuser('lia'); mod_ uuid := t.mkuser('mod1', 'mod');
  m1 uuid; m_pending uuid; ch uuid;
begin
  m1 := t.play(a, b);
  perform t.as_user(a); m_pending := create_match('1v1', 11, 1, true, array[a], array[c], '[[11,3]]'); perform t.su();
  perform t.as_user(a); ch := create_challenge(b); perform send_message(ch, 'hola, jugamos?'); perform t.su();

  -- anónimo
  perform t.as_anon();
  perform t.fails('select * from profiles', '42501', 'anon no lee profiles');
  perform t.fails('select * from audit_log', '42501', 'anon no lee audit_log');
  perform t.fails('select * from rivalry_meta', '42501', 'anon no lee rivalry_meta');
  perform t.fails('select * from keepalive', '42501', 'anon no lee keepalive');
  perform t.fails('select * from messages', '42501', 'anon no lee el chat');
  perform t.eq((select count(*) from matches where status = 'pending')::int, 0, 'anon no ve partidos pendientes');
  perform t.eq((select count(*) from matches where status = 'confirmed')::int, 1, 'anon ve los confirmados');
  perform t.eq((select count(*) from public_profiles)::int, 3 + 1, 'anon lee public_profiles');
  perform t.fails('select create_match(''1v1'',11,1,true,array[gen_random_uuid()],array[gen_random_uuid()],''[[11,5]]'')', 'permission denied', 'anon no crea partidos');
  perform t.fails('select complete_onboarding(''hola'',''es'',''2026-11-01'')', 'permission denied', 'anon no hace onboarding');
  perform t.su();

  -- usuario normal
  perform t.as_user(b);
  perform t.eq((select count(*) from profiles)::int, 1, 'usuario solo ve su fila de profiles');
  perform t.eq((select count(*) from matches where status = 'pending')::int, 0, 'tercero no ve el pendiente ajeno');
  perform t.fails('update profiles set elo_single = 3000', '42501', 'no se edita el ELO');
  perform t.fails('update profiles set role = ''admin''', '42501', 'no se auto-asciende');
  perform t.fails('update profiles set alias = ''hacker''', '42501', 'el alias va por RPC');
  perform t.fails('insert into matches (mode, points_target, best_of) values (''1v1'',11,1)', '42501', 'sin insert directo en matches');
  perform t.fails('update matches set status = ''confirmed''', '42501', 'sin update directo en matches');
  perform t.fails('delete from matches', '42501', 'sin delete directo en matches');
  perform t.fails('insert into match_players (match_id, team, slot) values (gen_random_uuid(),''A'',1)', '42501', 'sin insert en match_players');
  perform t.fails('update match_players set delta = 99', '42501', 'sin update en match_players');
  perform t.fails('insert into messages (challenge_id, sender_id, body) select id, auth.uid(), ''x'' from challenges', '42501', 'sin insert directo de mensajes');
  perform t.fails('insert into notifications (profile_id, kind) values (auth.uid(), ''match_pending'')', '42501', 'sin crear avisos');
  perform t.fails('select * from rivalry_meta', '42501', 'usuario no lee rivalry_meta');
  perform t.fails('select * from wordlist', '42501', 'usuario no lee wordlist');
  perform t.fails('select * from app_config', '42501', 'usuario no lee app_config');
  perform t.eq((select count(*) from audit_log)::int, 0, 'usuario no ve audit_log');
  perform t.fails('select apply_match_elo(gen_random_uuid())', '42501', 'RPC interna apply_match_elo cerrada');
  perform t.fails('select recompute_elo_from(now())', '42501', 'RPC interna recompute cerrada');
  perform t.fails('select throttle_hit(''k'', 1, interval ''1 hour'')', '42501', 'throttle solo para el servidor');
  perform t.fails(format('select void_match(%L, ''x'')', m1), 'forbidden', 'usuario no anula partidos');
  perform t.fails(format('select admin_set_role(%L, ''admin'')', b), 'forbidden', 'usuario no se hace admin');
  perform t.fails(format('select admin_set_status(%L, ''banned'', 0, ''x'')', a), 'forbidden', 'usuario no banea');
  -- el chat de otros es ilegible
  perform t.su(); perform t.as_user(c);
  perform t.eq((select count(*) from messages)::int, 0, 'tercero no lee el chat ajeno');
  perform t.eq((select count(*) from challenges)::int, 0, 'tercero no ve el reto ajeno');
  perform t.fails(format('select send_message(%L, ''intruso'')', ch), 'not_found', 'tercero no escribe en el chat');
  perform t.eq((select count(*) from matches where id = m_pending)::int, 1, 'el rival sí ve su pendiente');
  perform t.su(); perform t.as_user(a);
  perform t.eq((select count(*) from messages)::int, 1, 'participante lee el chat');
  perform t.su();

  -- avisos: cada uno los suyos
  perform t.as_user(b);
  perform t.ok((select count(*) from notifications) >= 1 and (select bool_and(profile_id = b) from notifications), 'avisos solo propios');
  perform t.zero_rows(format('update notifications set read_at = now() where profile_id = %L', a), 'no marca avisos ajenos');
  perform t.su();

  -- moderación sí puede leer
  perform t.as_user(mod_);
  perform t.ok((select count(*) from audit_log) >= 1, 'moderación lee audit_log');
  perform t.ok((select count(*) from profiles) = 4, 'moderación ve perfiles');
  perform t.eq((select count(*) from messages)::int, 0, 'ni moderación lee chats sin reporte');
  perform t.su();
end $$;
rollback;
