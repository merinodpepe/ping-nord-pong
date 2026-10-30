// Espejo en TS de las funciones SQL de la migración 0002 (la verdad está en SQL). Plan, sección 5.1.

export type MatchFormat = { pointsTarget: 5 | 7 | 11 | 21; bestOf: 1 | 3 | 5 | 7 };

/** Redondeo "lejos de cero", igual que elo_round en SQL (Math.round redondea los .5 negativos hacia arriba). */
export function eloRound(x: number): number {
  return Math.sign(x) * Math.floor(Math.abs(x) + 0.5) || 0;
}

export function expected(own: number, opp: number): number {
  return 1 / (1 + Math.pow(10, (opp - own) / 400));
}

export function kFactor(gamesInMode: number): number {
  return gamesInMode < 20 ? 32 : 20;
}

/** Anti-farmeo: n = partidos confirmados entre los mismos jugadores en los 7 días anteriores. */
export function weightW(n: number): number {
  return Math.max(0.2, 1 / (1 + 0.5 * n));
}

/** Peso del formato: un partido corto cuenta menos. */
export function weightM({ pointsTarget, bestOf }: MatchFormat): number {
  const p = pointsTarget * Math.ceil(bestOf / 2);
  return Math.min(1, Math.sqrt(p / 33));
}

export type DeltaInput = MatchFormat & {
  own: number;
  opp: number;
  k: number;
  n: number;
  won: boolean;
};

export function eloDelta(i: DeltaInput): number {
  return eloRound(i.k * weightW(i.n) * weightM(i) * ((i.won ? 1 : 0) - expected(i.own, i.opp)));
}

/** Rating de un equipo: la media de sus jugadores (en 1v1, el del jugador). */
export function teamRating(ratings: number[]): number {
  return ratings.reduce((a, b) => a + b, 0) / ratings.length;
}
