import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pfEmblemSVG, pfRivalryState, pfColors } from '@/lib/emblem';

const states = [-3, -2, -1, 0, 1, 2, 3] as const;
const file = (s: number) => `design/emblem/ejemplos/estado_${s > 0 ? '+' + s : s === 0 ? '0' : s}.svg`;

describe('emblema cuervo contra serpiente', () => {
  it.each(states)('estado %i coincide con el snapshot del kit', (s) => {
    const expected = readFileSync(file(s), 'utf8').trim();
    expect(pfEmblemSVG(s, 7, 'AN', 'MA', 400)).toBe(expected);
  });

  it('pfRivalryState sigue la tabla del plan', () => {
    expect(pfRivalryState(3, 3)).toBe(0);
    expect(pfRivalryState(4, 3)).toBe(0);
    expect(pfRivalryState(5, 3)).toBe(1);
    expect(pfRivalryState(3, 6)).toBe(-1);
    expect(pfRivalryState(7, 2)).toBe(2);
    expect(pfRivalryState(8, 1)).toBe(3);
    expect(pfRivalryState(1, 8)).toBe(-3);
    expect(pfRivalryState(20, 12)).toBe(2); // 7+ de diferencia pero <70 %
  });

  it('los colores son deterministas por semilla y hex', () => {
    expect(pfColors(7)).toEqual(pfColors(7));
    expect(pfColors(7).c1).not.toBe(pfColors(8).c1);
    expect(pfColors(7).c1).toMatch(/^#[0-9a-f]{6}$/);
  });
});
