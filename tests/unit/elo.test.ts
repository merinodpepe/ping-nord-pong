import { describe, expect, it } from 'vitest';
import cases from '../fixtures/elo-cases.json';
import { eloDelta, eloRound, expected, kFactor, weightM, weightW } from '@/lib/elo';

describe('ELO', () => {
  it('rivales con el mismo ELO: esperado 0,5', () => expect(expected(1000, 1000)).toBe(0.5));

  it('400 puntos de diferencia: esperado ≈ 0,909', () => {
    expect(expected(1400, 1000)).toBeCloseTo(0.9091, 4);
    expect(expected(1000, 1400)).toBeCloseTo(0.0909, 4);
  });

  it('K = 32 con menos de 20 partidos y 20 después', () => {
    expect(kFactor(0)).toBe(32);
    expect(kFactor(19)).toBe(32);
    expect(kFactor(20)).toBe(20);
  });

  it('peso anti-farmeo w para n = 0, 1, 2, 10', () => {
    expect(weightW(0)).toBe(1);
    expect(weightW(1)).toBeCloseTo(1 / 1.5, 10);
    expect(weightW(2)).toBe(0.5);
    expect(weightW(10)).toBe(0.2);
  });

  it('tabla de m (sección 5.1)', () => {
    const m = (pointsTarget: 5 | 7 | 11 | 21, bestOf: 1 | 3 | 5 | 7) => weightM({ pointsTarget, bestOf });
    expect(m(5, 1)).toBeCloseTo(0.39, 2);
    expect(m(7, 1)).toBeCloseTo(0.46, 2);
    expect(m(11, 1)).toBeCloseTo(0.58, 2);
    expect(m(21, 1)).toBeCloseTo(0.8, 2);
    expect(m(11, 3)).toBeCloseTo(0.82, 2);
    expect(m(11, 5)).toBe(1);
    expect(m(21, 7)).toBe(1);
  });

  it('1000 vs 1000, 1 set a 11: ganar da +9 (K32 · 0,58 · 0,5)', () => {
    expect(eloDelta({ own: 1000, opp: 1000, k: 32, n: 0, pointsTarget: 11, bestOf: 1, won: true })).toBe(9);
  });

  it('Bo5 a 11 entre iguales, jugador nuevo: ±16', () => {
    const win = eloDelta({ own: 1000, opp: 1000, k: 32, n: 0, pointsTarget: 11, bestOf: 5, won: true });
    const lose = eloDelta({ own: 1000, opp: 1000, k: 32, n: 0, pointsTarget: 11, bestOf: 5, won: false });
    expect(win).toBe(16);
    expect(lose).toBe(-16);
  });

  it('jugador nuevo (K32) contra veterano (K20): el nuevo mueve más', () => {
    const base = { own: 1000, opp: 1000, n: 0, pointsTarget: 11 as const, bestOf: 5 as const };
    const nuevo = eloDelta({ ...base, k: 32, won: true });
    const veterano = eloDelta({ ...base, k: 20, won: false });
    expect(nuevo).toBeGreaterThan(Math.abs(veterano));
  });

  it('repetir rival reduce el cambio (n = 0 → 10)', () => {
    const d = (n: number) => eloDelta({ own: 1000, opp: 1000, k: 32, n, pointsTarget: 11, bestOf: 5, won: true });
    expect(d(0)).toBeGreaterThan(d(1));
    expect(d(1)).toBeGreaterThan(d(2));
    expect(d(10)).toBe(3);
  });

  it('redondea .5 lejos de cero (igual que SQL)', () => {
    expect(eloRound(2.5)).toBe(3);
    expect(eloRound(-2.5)).toBe(-3);
    expect(eloRound(-0.4)).toBe(0);
  });

  it('coincide con los 80 casos congelados (los mismos que comprueba el SQL)', () => {
    for (const c of cases) {
      const d = eloDelta({ own: c.own, opp: c.opp, k: c.k, n: c.n, won: c.won,
        pointsTarget: c.pointsTarget as 5, bestOf: c.bestOf as 1 });
      expect(d).toBe(c.delta);
    }
  });
});
