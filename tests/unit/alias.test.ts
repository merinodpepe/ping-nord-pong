import { describe, expect, it } from 'vitest';
import { escapeLike, formatHandle, handleSlug, parseHandle } from '@/lib/alias';

describe('alias#tag', () => {
  it('formatea y genera el slug de URL', () => {
    expect(formatHandle('Furu', 'xyzj')).toBe('Furu#xyzj');
    expect(handleSlug('Furu', 'xyzj')).toBe('Furu~xyzj');
    expect(formatHandle('Furu')).toBe('Furu');
  });
  it('parsea ~ y # (también codificado) y alias sueltos', () => {
    expect(parseHandle('Furu~xyzj')).toEqual({ alias: 'Furu', tag: 'xyzj' });
    expect(parseHandle('Furu%23XYZJ')).toEqual({ alias: 'Furu', tag: 'xyzj' });
    expect(parseHandle('a.b-c~k2m9')).toEqual({ alias: 'a.b-c', tag: 'k2m9' });
    expect(parseHandle('Furu')).toEqual({ alias: 'Furu', tag: null });
    expect(parseHandle('Furu#xy')).toEqual({ alias: 'Furu', tag: null });
  });
  it('escapa comodines de LIKE', () => {
    expect(escapeLike('a_b%c\\')).toBe('a\\_b\\%c\\\\');
  });
});
