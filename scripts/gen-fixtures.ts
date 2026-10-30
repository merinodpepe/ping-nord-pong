// Genera los casos fijos de ELO desde la implementación TS. Los usan Vitest (congela el TS) y los tests SQL (comparan la verdad).
// Uso: npx tsx scripts/gen-fixtures.ts
import { writeFileSync } from 'node:fs';
import { eloDelta, weightM, weightW, kFactor } from '../lib/elo';

type Fmt = { pointsTarget: 5 | 7 | 11 | 21; bestOf: 1 | 3 | 5 | 7 };
const formats: Fmt[] = [
  { pointsTarget: 5, bestOf: 1 }, { pointsTarget: 7, bestOf: 1 }, { pointsTarget: 11, bestOf: 1 },
  { pointsTarget: 21, bestOf: 1 }, { pointsTarget: 11, bestOf: 3 }, { pointsTarget: 11, bestOf: 5 },
  { pointsTarget: 21, bestOf: 3 }, { pointsTarget: 7, bestOf: 7 },
];
const pairs: [number, number][] = [[1000, 1000], [1400, 1000], [1000, 1400], [1237, 1189], [1500, 1475], [900, 1612], [1050.5, 987.25]];
const ns = [0, 1, 2, 10];
const games = [0, 19, 20, 100];

// Selección determinista de 60 combinaciones (xorshift), sin dependencias
let s = 123456789;
const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;

const cases = [] as { own: number; opp: number; k: number; n: number; pointsTarget: number; bestOf: number; won: boolean; delta: number; w: number; m: number }[];
for (const f of formats) {
  cases.push(mk(1000, 1000, 32, 0, f, true));
  cases.push(mk(1000, 1400, 32, 0, f, false));
}
for (const n of ns) cases.push(mk(1100, 1100, 20, n, formats[2]!, true));
for (let i = 0; i < 60; i++) {
  const [own, opp] = pick(pairs);
  cases.push(mk(own, opp, kFactor(pick(games)), pick(ns), pick(formats), rnd() < 0.5));
}
function mk(own: number, opp: number, k: number, n: number, f: Fmt, won: boolean) {
  return { own, opp, k, n, pointsTarget: f.pointsTarget, bestOf: f.bestOf, won,
    delta: eloDelta({ own, opp, k, n, won, ...f }), w: weightW(n), m: weightM(f) };
}

writeFileSync('tests/fixtures/elo-cases.json', JSON.stringify(cases, null, 1) + '\n');
const rows = cases.map((c) => `  (${c.own}, ${c.opp}, ${c.k}, ${c.n}, ${c.pointsTarget}, ${c.bestOf}, ${c.won}, ${c.delta})`).join(',\n');
writeFileSync('tests/db/elo_cases.sql',
  `-- generado por scripts/gen-fixtures.ts: no editar\ncreate table t_elo_cases (own double precision, opp double precision, k int, n int, pt int, bo int, won boolean, delta int);\ninsert into t_elo_cases values\n${rows};\n`);
console.log(cases.length, 'casos');
