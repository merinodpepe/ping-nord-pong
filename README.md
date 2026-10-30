# Ping-Nord-Pong

Ranking ELO público de ping-pong del Campus Nord (UPC, Barcelona). Proyecto de Pepe Flock. Plan en [`PLAN.md`](PLAN.md).

```bash
cp .env.example .env.local   # rellena las claves de Supabase
npm install
npm run dev                  # http://localhost:3000
npm test                     # lógica de ELO, validación y emblema
npm run db:test              # migraciones + RLS + RPC en un Postgres de Docker
npm run i18n:check
```

Despliegue y anti-pausa: ver `DEPLOY.md`.
