-- Anti-pausa de Supabase Free (plan, sección 14.3)

create table keepalive (
  source text primary key check (source in ('vercel','github')),
  last_ping timestamptz not null default now(),
  count bigint not null default 0
);
insert into keepalive (source) values ('vercel'), ('github');
alter table keepalive enable row level security;   -- sin políticas: nadie la lee ni escribe directamente

create or replace function keepalive_ping(p_source text)
returns timestamptz
language plpgsql security definer set search_path = public, pg_temp as $$
declare t timestamptz;
begin
  if p_source not in ('vercel','github') then raise exception 'bad source'; end if;
  update keepalive set last_ping = now(), count = count + 1
   where source = p_source
     and last_ping < now() - interval '1 hour'
  returning last_ping into t;
  return coalesce(t, (select last_ping from keepalive where source = p_source));
end $$;

revoke all on function keepalive_ping(text) from public;
grant execute on function keepalive_ping(text) to anon, authenticated, service_role;

create or replace function keepalive_vercel_age_hours()
returns int
language sql security definer set search_path = public, pg_temp as $$
  select floor(extract(epoch from now() - last_ping) / 3600)::int from keepalive where source = 'vercel';
$$;
revoke all on function keepalive_vercel_age_hours() from public;
grant execute on function keepalive_vercel_age_hours() to anon, authenticated, service_role;
