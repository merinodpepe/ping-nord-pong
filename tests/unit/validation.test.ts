import { describe, expect, it } from 'vitest';
import { validateSets, createMatchSchema } from '@/lib/match-validation';

const ok = (t: number, b: number, w: boolean, s: [number, number][]) => validateSets(t, b, w, s);

describe('validateSets', () => {
  it('un set a 11 simple', () => {
    expect(ok(11, 1, true, [[11, 7]])).toMatchObject({ ok: true, winner: 'A' });
    expect(ok(11, 1, true, [[3, 11]])).toMatchObject({ ok: true, winner: 'B' });
  });
  it('gana por dos: 11-9, 12-10 sí; 13-9 y 11-10 no', () => {
    expect(ok(11, 1, true, [[11, 9]]).ok).toBe(true);
    expect(ok(11, 1, true, [[12, 10]]).ok).toBe(true);
    expect(ok(11, 1, true, [[13, 9]]).ok).toBe(false);
    expect(ok(11, 1, true, [[11, 10]]).ok).toBe(false);
    expect(ok(11, 1, true, [[10, 12]]).ok).toBe(true);
  });
  it('sin ganar por dos: el ganador termina exactamente en la meta', () => {
    expect(ok(11, 1, false, [[11, 10]]).ok).toBe(true);
    expect(ok(11, 1, false, [[12, 10]]).ok).toBe(false);
  });
  it('empates imposibles', () => {
    expect(ok(11, 1, true, [[11, 11]]).ok).toBe(false);
    expect(ok(11, 1, false, [[11, 11]]).ok).toBe(false);
  });
  it('Bo3: 2-0 y 2-1 válidos, 1-0 y 3 sets con 2-0 previo no', () => {
    expect(ok(11, 3, true, [[11, 5], [11, 6]])).toMatchObject({ ok: true, winner: 'A' });
    expect(ok(11, 3, true, [[11, 5], [6, 11], [11, 9]])).toMatchObject({ ok: true, winner: 'A' });
    expect(ok(11, 3, true, [[11, 5]]).ok).toBe(false);
    expect(ok(11, 3, true, [[11, 5], [11, 6], [11, 2]])).toMatchObject({ ok: false, error: 'set_after_end' });
  });
  it('Bo5 necesita 3 sets ganados', () => {
    expect(ok(11, 5, true, [[11, 1], [11, 2], [3, 11], [11, 4]])).toMatchObject({ ok: true, winner: 'A' });
    expect(ok(11, 5, true, [[11, 1], [11, 2], [3, 11]]).ok).toBe(false);
  });
  it('números fuera de rango o no enteros', () => {
    expect(ok(11, 1, true, [[100, 98]]).ok).toBe(false);
    expect(ok(11, 1, true, [[11.5, 3]]).ok).toBe(false);
    expect(ok(11, 1, true, [[-1, 11]]).ok).toBe(false);
  });
});

describe('createMatchSchema', () => {
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const base = { mode: '1v1', pointsTarget: 11, bestOf: 1, winByTwo: true, teamA: [id(1)], teamB: [id(2)], sets: [[11, 7]] };
  it('acepta un 1v1 válido', () => expect(createMatchSchema.safeParse(base).success).toBe(true));
  it('rechaza el mismo jugador en los dos equipos', () =>
    expect(createMatchSchema.safeParse({ ...base, teamB: [id(1)] }).success).toBe(false));
  it('2v2 necesita 4 jugadores distintos', () => {
    expect(createMatchSchema.safeParse({ ...base, mode: '2v2' }).success).toBe(false);
    expect(createMatchSchema.safeParse({ ...base, mode: '2v2', teamA: [id(1), id(2)], teamB: [id(3), id(4)] }).success).toBe(true);
    expect(createMatchSchema.safeParse({ ...base, mode: '2v2', teamA: [id(1), id(2)], teamB: [id(3), id(2)] }).success).toBe(false);
  });
  it('rechaza un resultado inválido', () =>
    expect(createMatchSchema.safeParse({ ...base, sets: [[13, 9]] }).success).toBe(false));
});
