import { describe, expect, it } from 'vitest';
import { IncompleteValueError, toJson, toRedisCli } from '@app/KeyBrowser/copyAs';
import type { ValuePage } from '@app/KeyBrowser/valueTypes';

const value = (text: string, truncated = false) => ({
  text,
  encoding: 'plain',
  size: text.length,
  truncated,
});

describe('toRedisCli', () => {
  it('renders a string as SET', () => {
    const pages: ValuePage[] = [{ type: 'string', cursor: null, total: null, value: value('hi') }];

    expect(toRedisCli('greeting', pages)).toBe('SET "greeting" "hi"');
  });

  it('quotes values that would otherwise split into separate arguments', () => {
    const pages: ValuePage[] = [
      { type: 'string', cursor: null, total: null, value: value('two words') },
    ];

    expect(toRedisCli('k', pages)).toBe('SET "k" "two words"');
  });

  it('escapes quotes and newlines so the command survives a paste', () => {
    const pages: ValuePage[] = [
      { type: 'string', cursor: null, total: null, value: value('say "hi"\nagain') },
    ];

    expect(toRedisCli('k', pages)).toBe('SET "k" "say \\"hi\\"\\nagain"');
  });

  it('joins every page of a hash into one HSET', () => {
    const pages: ValuePage[] = [
      { type: 'hash', cursor: '12', total: 3, fields: [{ name: 'a', value: value('1') }] },
      {
        type: 'hash',
        cursor: null,
        total: 3,
        fields: [
          { name: 'b', value: value('2') },
          { name: 'c', value: value('3') },
        ],
      },
    ];

    expect(toRedisCli('h', pages)).toBe('HSET "h" "a" "1" "b" "2" "c" "3"');
  });

  it('puts a sorted set back in score-then-member order', () => {
    const pages: ValuePage[] = [
      {
        type: 'zset',
        cursor: null,
        total: 1,
        members: [{ value: value('alice'), score: 10.5 }],
      },
    ];

    expect(toRedisCli('board', pages)).toBe('ZADD "board" 10.5 "alice"');
  });

  it('keeps stream ids, since they are part of what a stream means', () => {
    const pages: ValuePage[] = [
      {
        type: 'stream',
        cursor: null,
        total: 1,
        entries: [{ id: '1-0', fields: [{ name: 'kind', value: value('created') }] }],
      },
    ];

    expect(toRedisCli('events', pages)).toBe('XADD "events" 1-0 "kind" "created"');
  });

  it('refuses a truncated value rather than writing a shorter one', () => {
    const pages: ValuePage[] = [
      { type: 'string', cursor: null, total: null, value: value('begin', true) },
    ];

    expect(() => toRedisCli('k', pages)).toThrow(IncompleteValueError);
  });

  it('refuses when any one element of a collection was truncated', () => {
    const pages: ValuePage[] = [
      {
        type: 'hash',
        cursor: null,
        total: 2,
        fields: [
          { name: 'ok', value: value('short') },
          { name: 'big', value: value('begin', true) },
        ],
      },
    ];

    expect(() => toRedisCli('h', pages)).toThrow(IncompleteValueError);
  });
});

describe('toJson', () => {
  it('renders a hash as an object', () => {
    const pages: ValuePage[] = [
      { type: 'hash', cursor: null, total: 1, fields: [{ name: 'a', value: value('1') }] },
    ];

    expect(JSON.parse(toJson(pages))).toEqual({ a: '1' });
  });

  it('renders a list as an array in index order', () => {
    const pages: ValuePage[] = [
      {
        type: 'list',
        cursor: null,
        total: 2,
        elements: [
          { index: 0, value: value('first') },
          { index: 1, value: value('second') },
        ],
      },
    ];

    expect(JSON.parse(toJson(pages))).toEqual(['first', 'second']);
  });

  it('keeps scores alongside members for a sorted set', () => {
    const pages: ValuePage[] = [
      { type: 'zset', cursor: null, total: 1, members: [{ value: value('a'), score: 3 }] },
    ];

    expect(JSON.parse(toJson(pages))).toEqual([{ member: 'a', score: 3 }]);
  });
});
