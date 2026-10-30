create schema t;   -- helpers de test
grant usage on schema t to anon, authenticated;

-- crea un usuario con perfil (como superusuario)
create function t.mkuser(p_alias text, p_role user_role default 'user') returns uuid language plpgsql as $$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (uid, p_alias || '@example.com');
  insert into profiles (id, alias, role, terms_version, terms_accepted_at) values (uid, p_alias, p_role, '2026-11-01', now());
  return uid;
end $$;
create function t.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
end $$;
create function t.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end $$;
create function t.su() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true); end $$;

create function t.eq(actual anyelement, expected anyelement, label text) returns void language plpgsql as $$
begin
  if actual is distinct from expected then raise exception 'FAIL % : esperado %, obtenido %', label, expected, actual; end if;
  raise notice 'ok   %', label;
end $$;
create function t.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL %', label; end if;
  raise notice 'ok   %', label;
end $$;
-- la sentencia debe fallar y el mensaje (o sqlstate) contener el patrón
create function t.fails(stmt text, pattern text, label text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm ilike '%' || pattern || '%' or sqlstate = pattern then
      raise notice 'ok   % (%)', label, sqlerrm; return;
    end if;
    raise exception 'FAIL % : error inesperado "%" (esperaba "%")', label, sqlerrm, pattern;
  end;
  raise exception 'FAIL % : debía fallar', label;
end $$;
-- para escrituras directas que RLS descarta en silencio: debe afectar 0 filas
create function t.zero_rows(stmt text, label text) returns void language plpgsql as $$
declare c int;
begin
  begin
    execute stmt; get diagnostics c = row_count;
  exception when insufficient_privilege then
    raise notice 'ok   % (denegado por privilegios)', label; return;
  end;
  if c <> 0 then raise exception 'FAIL % : afectó % filas', label, c; end if;
  raise notice 'ok   % (0 filas)', label;
end $$;

-- a apunta (equipo A) y b confirma. Devuelve el id del partido.
create function t.play(a uuid, b uuid, p_sets jsonb default '[[11,5]]', p_target int default 11, p_bo int default 1) returns uuid
language plpgsql as $$
declare mid uuid;
begin
  perform t.as_user(a);
  mid := create_match('1v1', p_target, p_bo, true, array[a], array[b], p_sets);
  perform t.su(); perform t.as_user(b);
  perform confirm_match(mid);
  perform t.su();
  return mid;
end $$;

-- retrasa un partido para esquivar los límites diarios en los tests
create function t.backdate(mid uuid, ago interval) returns void language sql as $$
  update matches set created_at = now() - ago - interval '1 day', played_at = now() - ago,
                     confirmed_at = case when confirmed_at is not null then now() - ago end where id = mid
$$;
