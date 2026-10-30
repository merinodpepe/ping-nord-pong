// Falla si falta una clave en algún idioma o sobra alguna (referencia: es.json). Plan, sección 6.
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../messages/', import.meta.url);
const flat = (v, p = '', out = new Map()) => {
  if (Array.isArray(v)) { out.set(p, `array:${v.length}`); v.forEach((x, i) => typeof x === 'object' && flat(x, `${p}[${i}]`, out)); }
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) flat(x, p ? `${p}.${k}` : k, out);
  else out.set(p, 'string');
  return out;
};
const load = (f) => flat(JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
const ref = load('es.json');
let bad = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'es.json')) {
  const m = load(f);
  for (const [k, t] of ref) if (!m.has(k)) { console.error(`${f}: falta ${k}`); bad++; } else if (m.get(k) !== t) { console.error(`${f}: ${k} distinto tipo/longitud (${m.get(k)} vs ${t})`); bad++; }
  for (const k of m.keys()) if (!ref.has(k)) { console.error(`${f}: sobra ${k}`); bad++; }
}
if (bad) { console.error(`\n${bad} problema(s) de i18n`); process.exit(1); }
console.log(`i18n OK (${ref.size} claves × ${readdirSync(dir).filter((x) => x.endsWith('.json')).length} idiomas)`);
