import { z } from 'zod';

// Espejo de validate_sets (SQL, 0002). Plan, sección 5.2.

export const POINTS_TARGETS = [5, 7, 11, 21] as const;
export const BEST_OF = [1, 3, 5, 7] as const;

export type SetScore = readonly [number, number];
export type ValidationError =
  | 'set_count'
  | 'set_range'
  | 'set_invalid'
  | 'set_after_end'
  | 'no_winner';

export type ValidationResult =
  | { ok: true; winner: 'A' | 'B'; setsA: number; setsB: number }
  | { ok: false; error: ValidationError; setIndex?: number };

export function setsNeeded(bestOf: number): number {
  return Math.ceil(bestOf / 2);
}

export function validateSets(
  pointsTarget: number,
  bestOf: number,
  winByTwo: boolean,
  sets: readonly SetScore[],
): ValidationResult {
  const need = setsNeeded(bestOf);
  if (sets.length < need || sets.length > bestOf) return { ok: false, error: 'set_count' };
  let wa = 0;
  let wb = 0;
  for (let i = 0; i < sets.length; i++) {
    const [a, b] = sets[i]!;
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > 99 || b > 99) {
      return { ok: false, error: 'set_range', setIndex: i };
    }
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    const valid = winByTwo
      ? (hi === pointsTarget && lo <= pointsTarget - 2) || (hi > pointsTarget && hi - lo === 2)
      : hi === pointsTarget && lo < pointsTarget;
    if (!valid) return { ok: false, error: 'set_invalid', setIndex: i };
    if (wa === need || wb === need) return { ok: false, error: 'set_after_end', setIndex: i };
    if (a > b) wa++;
    else wb++;
  }
  if (wa !== need && wb !== need) return { ok: false, error: 'no_winner' };
  return { ok: true, winner: wa === need ? 'A' : 'B', setsA: wa, setsB: wb };
}

export const ALIAS_RE = /^[A-Za-z0-9._-]{3,20}$/;

export const aliasSchema = z
  .string()
  .transform((s) => s.normalize('NFKC').trim())
  .pipe(z.string().regex(ALIAS_RE));

export const createMatchSchema = z
  .object({
    mode: z.enum(['1v1', '2v2']),
    pointsTarget: z.union([z.literal(5), z.literal(7), z.literal(11), z.literal(21)]),
    bestOf: z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(7)]),
    winByTwo: z.boolean().default(true),
    teamA: z.array(z.string().uuid()),
    teamB: z.array(z.string().uuid()),
    sets: z.array(z.tuple([z.number().int().min(0).max(99), z.number().int().min(0).max(99)])).max(7),
    counterOf: z.string().uuid().optional(),
    challengeId: z.string().uuid().optional(),
  })
  .superRefine((v, ctx) => {
    const size = v.mode === '1v1' ? 1 : 2;
    if (v.teamA.length !== size || v.teamB.length !== size) {
      ctx.addIssue({ code: 'custom', message: 'players', path: ['teamA'] });
    }
    if (new Set([...v.teamA, ...v.teamB]).size !== size * 2) {
      ctx.addIssue({ code: 'custom', message: 'duplicates', path: ['teamA'] });
    }
    const r = validateSets(v.pointsTarget, v.bestOf, v.winByTwo, v.sets);
    if (!r.ok) ctx.addIssue({ code: 'custom', message: r.error, path: ['sets', r.setIndex ?? 0] });
  });

export type CreateMatchInput = z.infer<typeof createMatchSchema>;
