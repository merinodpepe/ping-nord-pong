begin;
-- Anular + recalcular: idempotente y equivale a que el partido nunca hubiera existido
do $$ declare
  a uuid := t.mkuser('ana'); b uuid := t.mkuser('marc'); c uuid := t.mkuser('lia');
  a2 uuid := t.mkuser('ana2'); b2 uuid := t.mkuser('marc2'); c2 uuid := t.mkuser('lia2');
  mod_ uuid := t.mkuser('mod1', 'mod'); m2 uuid; s1 text; s2 text;
begin
  perform t.play(a, b, '[[11,5]]');
  m2 := t.play(b, c, '[[11,9]]');
  perform t.play(c, a, '[[12,10]]');
  perform t.play(a, c, '[[21,15]]', 21, 1);
  -- mundo paralelo sin el partido 2
  perform t.play(a2, b2, '[[11,5]]');
  perform t.play(c2, a2, '[[12,10]]');
  perform t.play(a2, c2, '[[21,15]]', 21, 1);
  perform t.as_user(mod_);
  perform t.fails(format('select void_match(%L, '''')', m2), 'reason_required', 'anular exige motivo');
  perform void_match(m2, 'resultado falso');
  perform t.su();
  perform t.eq((select status from matches where id = m2), 'voided'::match_status, 'partido anulado');
  perform t.eq((select elo_single from profiles where id = a), (select elo_single from profiles where id = a2), 'ELO de Ana = mundo sin el partido');
  perform t.eq((select elo_single from profiles where id = b), (select elo_single from profiles where id = b2), 'ELO de Marc = mundo sin el partido');
  perform t.eq((select elo_single from profiles where id = c), (select elo_single from profiles where id = c2), 'ELO de Lia = mundo sin el partido');
  perform t.eq((select games_single from profiles where id = c), 2, 'partidos recontados');
  perform t.ok((select count(*) from audit_log where action = 'void_match') = 1, 'queda en audit_log');
  perform t.ok((select count(*) from notifications where kind = 'match_voided') = 2, 'se avisa a los jugadores');
  select string_agg(id::text || elo_single || elo_double || games_single, ',' order by id) into s1 from profiles;
  perform recompute_elo_from('-infinity'); perform recompute_elo_from('-infinity');
  select string_agg(id::text || elo_single || elo_double || games_single, ',' order by id) into s2 from profiles;
  perform t.eq(s2, s1, 'recompute_elo_from idempotente');
  perform t.eq((select count(*) from public_matches)::int, 6, 'los anulados salen de las vistas públicas');
  perform t.eq((select sum(elo_single) from profiles where id in (a,b,c)), 3000::bigint, 'ELO conservado entre jugadores');
end $$;

-- Rivalidades: nacen a los 5 partidos, papel y semilla fijos, el estado sube y guarda prev_state
do $$ declare
  x uuid := t.mkuser('xavi'); y uuid := t.mkuser('yara'); mids uuid[] := '{}'; mid uuid; i int;
  crow uuid; sd int; rv rivalries;
begin
  for i in 1 .. 4 loop
    mid := t.play(x, y); perform t.backdate(mid, make_interval(hours => 80 - i));
  end loop;
  perform t.eq((select count(*) from rivalries)::int, 0, 'con 4 partidos aún no hay rivalidad');
  perform t.eq((select count(*) from rivalry_meta)::int, 0, 'ni emblema sorteado');
  mid := t.play(x, y); perform t.backdate(mid, make_interval(hours => 70));
  perform t.eq((select count(*) from rivalries)::int, 1, 'al 5º partido nace la rivalidad');
  select * into rv from rivalries;
  perform t.ok(rv.crow_id in (x, y) and rv.snake_id in (x, y) and rv.crow_id <> rv.snake_id, 'cuervo y serpiente sorteados');
  perform t.eq(rv.emblem_state, case when rv.crow_id = x then 2 else -2 end, '5-0: estado ±2 visto desde el cuervo');
  perform t.eq(rv.total, 5, 'total 5');
  crow := rv.crow_id; sd := rv.seed;
  for i in 1 .. 3 loop
    mid := t.play(x, y); perform t.backdate(mid, make_interval(hours => 60 - i));
  end loop;
  select * into rv from rivalries;
  perform t.eq(rv.emblem_state, case when rv.crow_id = x then 3 else -3 end, '8-0: dominio absoluto ±3');
  perform t.eq(rv.prev_state, (case when rv.crow_id = x then 2 else -2 end)::smallint, 'prev_state guarda el estado anterior');
  perform t.eq(rv.streak_len, 8, 'racha de 8');
  perform t.ok(rv.by_format ? '11', 'desglose por formato');
  perform recompute_elo_from('-infinity');
  select * into rv from rivalries;
  perform t.ok(rv.crow_id = crow and rv.seed = sd, 'papel y semilla no cambian al recalcular');
  perform t.ok((select count(*) from rivalry_meta) = 1, 'una sola fila de rivalry_meta');
end $$;

-- Tope diario contra el mismo rival: 5
do $$ declare p uuid := t.mkuser('pala'); q uuid := t.mkuser('quim'); i int;
begin
  for i in 1 .. 5 loop perform t.play(p, q); end loop;
  perform t.fails(format($q$select t.play(%L, %L)$q$, p, q), 'rate_limited', 'tope de 5 partidos al día contra el mismo rival');
end $$;

-- Límites y reputación automática
do $$ declare
  u uuid := t.mkuser('spammy'); r1 uuid := t.mkuser('rival1'); r2 uuid := t.mkuser('rival2'); r3 uuid := t.mkuser('rival3'); r4 uuid := t.mkuser('rival4');
  m uuid; ids uuid[] := '{}'; r uuid;
begin
  perform t.as_user(u);
  ids := ids || create_match('1v1', 11, 1, true, array[u], array[r1], '[[11,5]]');
  ids := ids || create_match('1v1', 11, 1, true, array[u], array[r2], '[[11,5]]');
  ids := ids || create_match('1v1', 11, 1, true, array[u], array[r3], '[[11,5]]');
  perform t.fails(format($q$select create_match('1v1', 11, 1, true, array[%L::uuid], array[%L::uuid], '[[11,5]]')$q$, u, r4),
                  'rate_limited', 'máximo 3 pendientes a la vez');
  perform t.su();
  -- los tres rivales rechazan: "no jugamos"
  perform t.as_user(r1); perform reject_match(ids[1], 'not_played'); perform t.su();
  perform t.as_user(r2); perform reject_match(ids[2], 'not_played'); perform t.su();
  perform t.as_user(r3); perform reject_match(ids[3], 'wrong_result'); perform t.su();
  perform t.eq(apply_reputation_rules(), 1, 'reputación limita al spammer');
  perform t.eq((select status from profiles where id = u), 'limited'::user_status, 'queda limitado');
  perform t.ok((select count(*) from notifications where profile_id = u and kind = 'account_limited') = 1, 'se le avisa en la app');
  perform t.as_user(u);
  perform t.fails(format($q$select create_match('1v1', 11, 1, true, array[%L::uuid], array[%L::uuid], '[[11,5]]')$q$, u, r4),
                  'limited', 'limitado no puede crear partidos');
  perform t.fails(format($q$select create_challenge(%L)$q$, r4), 'limited', 'limitado no puede retar');
  perform t.su();
  -- pero sí puede confirmar lo que le envíen
  perform t.as_user(r4); m := create_match('1v1', 11, 1, true, array[r4], array[u], '[[11,3]]'); perform t.su();
  perform t.as_user(u); perform confirm_match(m); perform t.su();
  perform t.eq((select status from matches where id = m), 'confirmed'::match_status, 'limitado sí confirma');
  update profiles set limited_until = now() - interval '1 minute' where id = u;
  perform apply_reputation_rules();
  perform t.eq((select status from profiles where id = u), 'active'::user_status, 'la limitación vence sola');
end $$;
rollback;
