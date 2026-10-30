begin;
do $$ declare
  a uuid := t.mkuser('ana'); b uuid := t.mkuser('marc'); c uuid := t.mkuser('lia'); d uuid := t.mkuser('pau');
  mid uuid; mid2 uuid; ra record; rb record; cnt int;
begin
  -- Apuntar como Ana (equipo A) contra Marc
  perform t.as_user(a);
  mid := create_match('1v1', 11, 1, true, array[a], array[b], '[[11,7]]');
  perform t.ok(mid is not null, 'crear partido');
  perform t.eq((select status from matches where id = mid), 'pending'::match_status, 'queda pending');
  perform t.eq((select elo_single from profiles where id = a), 1000, 'sin confirmar no cambia el ELO');
  perform t.fails(format('select confirm_match(%L)', mid), 'cannot_confirm_own', 'no se puede auto-confirmar');
  perform t.su(); perform t.as_user(c);
  perform t.fails(format('select confirm_match(%L)', mid), 'not_participant', 'un tercero no confirma');
  perform t.su(); perform t.as_user(b);
  perform t.eq((my_inbox() ->> 'pending_to_confirm')::int, 1, 'aviso de pendiente para Marc');
  perform confirm_match(mid);
  perform t.su();
  select * into ra from profiles where id = a; select * into rb from profiles where id = b;
  perform t.eq(ra.elo_single, 1009, 'ganador sube 9 (K32·w1·m0,58·0,5)');
  perform t.eq(rb.elo_single, 991, 'perdedor baja 9');
  perform t.eq(ra.games_single, 1, 'cuenta partidos');
  perform t.eq((select weight_m from match_players where match_id = mid and profile_id = a), 0.577::numeric, 'guarda m');
  perform t.eq((select k from match_players where match_id = mid and profile_id = a)::int, 32, 'guarda K');
  perform t.as_user(b); perform t.fails(format('select confirm_match(%L)', mid), 'not_pending', 'no se confirma dos veces'); perform t.su();

  -- anti-farmeo: segundo partido seguido entre los mismos baja el peso
  perform t.as_user(a);
  mid2 := create_match('1v1', 11, 1, true, array[a], array[b], '[[11,5]]');
  perform t.su(); perform t.as_user(b); perform confirm_match(mid2); perform t.su();
  perform t.eq((select weight_w from match_players where match_id = mid2 and profile_id = a), 0.667::numeric, 'w con n=1');

  -- rechazo + contrapropuesta única
  perform t.as_user(a);
  mid := create_match('1v1', 11, 1, true, array[a], array[b], '[[11,2]]');
  perform t.su(); perform t.as_user(b);
  perform reject_match(mid, 'wrong_result');
  perform t.eq((select status from matches where id = mid), 'rejected'::match_status, 'rechazado');
  perform t.fails(format('select confirm_match(%L)', mid), 'not_pending', 'no se confirma un rechazado');
  mid2 := create_match('1v1', 11, 1, true, array[a], array[b], '[[8,11]]', mid);
  perform t.ok(mid2 is not null, 'contrapropuesta creada por quien rechazó');
  perform t.fails(format($q$select create_match('1v1', 11, 1, true, array[%L::uuid], array[%L::uuid], '[[7,11]]', %L)$q$, a, b, mid),
                  'counter_not_allowed', 'solo una contrapropuesta');
  perform t.su(); perform t.as_user(a); perform confirm_match(mid2); perform t.su();

  -- 2v2: el compañero del creador no puede confirmar; uno del equipo contrario sí
  perform t.as_user(a);
  mid := create_match('2v2', 11, 3, true, array[a, c], array[b, d], '[[11,5],[11,9]]');
  perform t.su(); perform t.as_user(c);
  perform t.fails(format('select confirm_match(%L)', mid), 'cannot_confirm_own', '2v2: compañero no confirma');
  perform t.su(); perform t.as_user(d); perform confirm_match(mid); perform t.su();
  perform t.eq((select games_double from profiles where id = c), 1, '2v2 actualiza ELO doble');
  perform t.eq((select games_single from profiles where id = c), 0, '2v2 no toca el ELO simple');
  perform t.ok((select elo_double from profiles where id = c) > 1000, '2v2 ganador sube');

  -- validación y permisos al crear
  perform t.as_user(a);
  perform t.fails(format($q$select create_match('1v1', 11, 1, true, array[%L::uuid], array[%L::uuid], '[[13,9]]')$q$, a, b), 'invalid_score', 'resultado inválido');
  perform t.fails(format($q$select create_match('1v1', 11, 1, true, array[%L::uuid], array[%L::uuid], '[[11,9]]')$q$, b, c), 'creator_not_player', 'el creador debe jugar');
  perform t.fails(format($q$select create_match('1v1', 11, 1, true, array[%L::uuid], array[%L::uuid], '[[11,9]]')$q$, a, a), 'invalid_players', 'rival distinto');
  perform t.su();

  -- caducidad
  perform t.as_user(a);
  mid := create_match('1v1', 7, 1, true, array[a], array[c], '[[7,3]]');
  perform t.su();
  update matches set expires_at = now() - interval '1 minute' where id = mid;
  perform t.as_user(c);
  perform t.fails(format('select confirm_match(%L)', mid), 'expired', 'no se confirma un partido caducado');
  perform t.su();
  perform t.eq(expire_pending_matches(), 1, 'cron de caducidad');
  perform t.eq((select status from matches where id = mid), 'expired'::match_status, 'queda expired');
end $$;
rollback;
