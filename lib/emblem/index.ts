// API tipada del generador del emblema cuervo contra serpiente.
// La implementación (emblem.impl.ts) es el port literal de design/emblem/emblem.js: no se modifica la lógica.
import * as impl from './emblem.impl';

export type Pt = [number, number];
export type Shape = { d: string; fill: string; stroke: string; sw: number; op: number };
export type Colors = {
  c0: string; c1: string; c2: string; c3: string; eye: string;
  s0: string; s2: string; s3: string; eye2: string; ring1: string; ring2: string;
};
export type EmblemState = -3 | -2 | -1 | 0 | 1 | 2 | 3;
export type Emblem = { shapes: Shape[]; crowHead: Pt; snakeHead: Pt };
export type Badge = { x: number; y: number; ty: number; r: number; fs: number; ini: string; ring: string; op: number };

export const EMBLEM_VIEWBOX = '-10 -50 420 560';

export const pfColors = impl.pfColors as (seed: number) => Colors;
export const pfEmblem = impl.pfEmblem as (state: number, colors: Colors) => Emblem;
export const pfRivalryState = impl.pfRivalryState as (crowWins: number, snakeWins: number) => EmblemState;
export const pfBadges = impl.pfBadges as (state: number, em: Emblem, crowIni: string, snakeIni: string, colors: Colors) => Badge[];
export const pfEmblemSVG = impl.pfEmblemSVG as (state: number, seed: number, crowIni: string, snakeIni: string, size?: number) => string;
