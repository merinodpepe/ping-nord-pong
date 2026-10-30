-- Trabajos programados (pg_cron) y listas de palabras iniciales.

do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('expire-matches',  '*/15 * * * *', 'select public.expire_pending_matches()');
    perform cron.schedule('purge-old-data',  '23 3 * * *',  'select public.purge_old_data()');
    perform cron.schedule('reputation',      '41 3 * * *',  'select public.apply_reputation_rules()');
    perform cron.schedule('detect-collusion','57 3 * * *',  'select public.detect_collusion()');
  else
    raise notice 'pg_cron no disponible: programa estos trabajos desde Supabase';
  end if;
end $$;

insert into wordlist (kind, word) values
  ('reserved','admin'),('reserved','administrador'),('reserved','administrator'),('reserved','mod'),('reserved','moderador'),
  ('reserved','moderator'),('reserved','pingnordpong'),('reserved','pepeflock'),('reserved','root'),('reserved','support'),
  ('reserved','soporte'),('reserved','staff'),('reserved','upc'),('reserved','system'),('reserved','sistema'),
  ('reserved','null'),('reserved','undefined'),('reserved','jugadoreliminado'),('reserved','deletedplayer')
on conflict do nothing;

-- Listas mínimas de partida (es, ca, en, de, zh). Se amplían con inserts, sin tocar código.
insert into wordlist (kind, word) values
  ('alias','puta'),('alias','puto'),('alias','mierda'),('alias','cabron'),('alias','gilipollas'),('alias','pendejo'),
  ('alias','maricon'),('alias','zorra'),('alias','joputa'),
  ('alias','fuck'),('alias','shit'),('alias','bitch'),('alias','nigger'),('alias','nigga'),('alias','faggot'),
  ('alias','cunt'),('alias','whore'),('alias','nazi'),('alias','hitler'),
  ('alias','scheisse'),('alias','arschloch'),('alias','hurensohn'),('alias','wichser'),('alias','schlampe'),
  ('alias','傻逼'),('alias','他妈的'),('alias','操你'),('alias','草泥马'),
  ('chat','puta'),('chat','hijoputa'),('chat','gilipollas'),('chat','mierda'),('chat','cabron'),('chat','capullo'),('chat','imbecil'),
  ('chat','collons'),
  ('chat','fuck'),('chat','shit'),('chat','bitch'),('chat','asshole'),('chat','nigger'),('chat','faggot'),('chat','retard'),
  ('chat','scheisse'),('chat','arschloch'),('chat','hurensohn'),('chat','wichser'),('chat','schlampe'),
  ('chat','傻逼'),('chat','他妈的'),('chat','操你'),('chat','草泥马'),
  ('chat','viagra')
on conflict do nothing;
