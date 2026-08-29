import { describe, expect, it } from 'vitest';
import { completionsFor } from '@app/Console/commandTable';

describe('completionsFor', () => {
  it('suggests nothing until something is typed', () => {
    expect(completionsFor('')).toHaveLength(0);
    expect(completionsFor('   ')).toHaveLength(0);
  });

  it('matches on the prefix regardless of case', () => {
    expect(completionsFor('hg').map((hint) => hint.name)).toEqual(['HGET', 'HGETALL']);
    expect(completionsFor('HG').map((hint) => hint.name)).toEqual(['HGET', 'HGETALL']);
  });

  it('matches the start of the name, not the middle', () => {
    // "range" appears inside LRANGE, XRANGE and ZRANGE, none of which start with it.
    expect(completionsFor('range')).toHaveLength(0);
  });

  it('carries the argument shape, which is the point of suggesting at all', () => {
    const [set] = completionsFor('SET');

    expect(set.arguments).toContain('key value');
    expect(set.summary).not.toBe('');
  });
});
