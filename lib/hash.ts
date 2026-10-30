import 'server-only';
import { createHash } from 'node:crypto';

/** Clave opaca para los límites: nunca se guarda el email ni la IP en claro. */
export function hashKey(kind: string, value: string): string {
  return `${kind}:${createHash('sha256').update(`${kind}|${value.trim().toLowerCase()}|${process.env.CRON_SECRET ?? 'pnp'}`).digest('hex').slice(0, 32)}`;
}
