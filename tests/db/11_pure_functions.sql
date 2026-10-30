begin;
\i tests/db/elo_cases.sql
do $$ declare bad int; begin
  select count(*) into bad from t_elo_cases c
   where elo_delta(c.own, c.opp, c.k, c.n, c.pt, c.bo, c.won) <> c.delta;
  perform t.eq(bad, 0, 'ELO: SQL coincide con los ' || (select count(*) from t_elo_cases) || ' casos de TS');
  perform t.eq(elo_round(2.5), 3, 'elo_round(2.5)');
  perform t.eq(elo_round(-2.5), -3, 'elo_round(-2.5)');
  perform t.ok(abs(elo_weight_m(5,1) - 0.389) < 0.001 and elo_weight_m(11,5) = 1, 'm de la tabla');
  perform t.eq(elo_weight_w(10)::numeric, 0.2::numeric, 'w mínimo 0,2');
  perform t.eq(elo_k(19), 32, 'K nuevo'); perform t.eq(elo_k(20), 20, 'K veterano');
end $$;

do $$ begin
  perform t.eq(validate_sets(11,1,true,'[[11,7]]'), 'A'::char, 'set simple A');
  perform t.eq(validate_sets(11,1,true,'[[12,14]]'), 'B'::char, 'set con prórroga B');
  perform t.eq(validate_sets(11,3,true,'[[11,5],[6,11],[11,9]]'), 'A'::char, 'Bo3 2-1');
  perform t.fails($q$select validate_sets(11,1,true,'[[13,9]]')$q$, 'invalid_score', '13-9 no vale');
  perform t.fails($q$select validate_sets(11,1,true,'[[11,10]]')$q$, 'invalid_score', '11-10 no vale con ganar por 2');
  perform t.fails($q$select validate_sets(11,1,true,'[[11,11]]')$q$, 'invalid_score', 'empate imposible');
  perform t.fails($q$select validate_sets(11,3,true,'[[11,5],[11,6],[11,2]]')$q$, 'invalid_score', 'set tras acabar');
  perform t.fails($q$select validate_sets(11,3,true,'[[11,5]]')$q$, 'invalid_score', 'faltan sets');
  perform t.eq(validate_sets(11,1,false,'[[11,10]]'), 'A'::char, 'sin ganar por 2: 11-10');
  perform t.fails($q$select validate_sets(11,1,false,'[[12,10]]')$q$, 'invalid_score', 'sin ganar por 2: 12-10 no');
  perform t.eq(rivalry_state(2,2), 0, 'estado 0'); perform t.eq(rivalry_state(3,1), 1, 'estado +1');
  perform t.eq(rivalry_state(1,3), -1, 'estado -1'); perform t.eq(rivalry_state(5,1), 2, 'estado +2');
  perform t.eq(rivalry_state(8,0), 3, 'estado +3'); perform t.eq(rivalry_state(0,8), -3, 'estado -3');
  perform t.eq(rivalry_state(20,12), 2, '7+ pero <70% se queda en 2');
  perform t.eq(rivalry_state(7,0), 3, '7-0 es dominio absoluto');
end $$;
rollback;
