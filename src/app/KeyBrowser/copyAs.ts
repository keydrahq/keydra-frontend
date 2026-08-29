import type { ValuePage } from './valueTypes';

/**
 * Quotes an argument the way redis-cli reads one.
 *
 * <p>Everything is quoted, including values that would not need it: a value containing a space, a
 * quote or a newline must be, and deciding case by case is how a pasted command ends up writing
 * something other than what was on screen.
 */
const quote = (value: string): string =>
  `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')}"`;

/** Raised when a value cannot be reproduced faithfully, rather than reproducing it wrongly. */
export class IncompleteValueError extends Error {
  constructor() {
    super('The value was truncated, so it cannot be copied in full');
    this.name = 'IncompleteValueError';
  }
}

const assertComplete = (truncated: boolean): void => {
  if (truncated) {
    throw new IncompleteValueError();
  }
};

/**
 * Renders the value as the redis-cli commands that would recreate it.
 *
 * <p>Refuses a truncated value outright. A command built from a visible prefix looks correct and
 * would silently write a shorter value than the one it was copied from.
 */
export const toRedisCli = (keyName: string, pages: ValuePage[]): string => {
  const key = quote(keyName);
  const first = pages[0];

  switch (first.type) {
    case 'string': {
      assertComplete(first.value.truncated);
      return `SET ${key} ${quote(first.value.text)}`;
    }
    case 'hash': {
      const fields = pages.flatMap((page) => (page.type === 'hash' ? page.fields : []));
      fields.forEach((field) => assertComplete(field.value.truncated));
      return `HSET ${key} ${fields
        .map((field) => `${quote(field.name)} ${quote(field.value.text)}`)
        .join(' ')}`;
    }
    case 'list': {
      const elements = pages.flatMap((page) => (page.type === 'list' ? page.elements : []));
      elements.forEach((element) => assertComplete(element.value.truncated));
      return `RPUSH ${key} ${elements.map((element) => quote(element.value.text)).join(' ')}`;
    }
    case 'set': {
      const members = pages.flatMap((page) => (page.type === 'set' ? page.members : []));
      members.forEach((member) => assertComplete(member.truncated));
      return `SADD ${key} ${members.map((member) => quote(member.text)).join(' ')}`;
    }
    case 'zset': {
      const members = pages.flatMap((page) => (page.type === 'zset' ? page.members : []));
      members.forEach((member) => assertComplete(member.value.truncated));
      return `ZADD ${key} ${members
        .map((member) => `${member.score} ${quote(member.value.text)}`)
        .join(' ')}`;
    }
    case 'stream': {
      const entries = pages.flatMap((page) => (page.type === 'stream' ? page.entries : []));
      entries.forEach((entry) => entry.fields.forEach((f) => assertComplete(f.value.truncated)));
      // Ids are kept: a stream's ids are part of its meaning, and XADD accepts an
      // explicit one as long as it is greater than the last.
      return entries
        .map(
          (entry) =>
            `XADD ${key} ${entry.id} ${entry.fields
              .map((field) => `${quote(field.name)} ${quote(field.value.text)}`)
              .join(' ')}`,
        )
        .join('\n');
    }
    default:
      throw new IncompleteValueError();
  }
};

/** Renders the value as JSON, shaped by type rather than as the wire envelope. */
export const toJson = (pages: ValuePage[]): string => {
  const first = pages[0];

  const plain = (): unknown => {
    switch (first.type) {
      case 'string':
        return first.value.text;
      case 'hash':
        return Object.fromEntries(
          pages
            .flatMap((page) => (page.type === 'hash' ? page.fields : []))
            .map((field) => [field.name, field.value.text]),
        );
      case 'list':
        return pages
          .flatMap((page) => (page.type === 'list' ? page.elements : []))
          .map((element) => element.value.text);
      case 'set':
        return pages
          .flatMap((page) => (page.type === 'set' ? page.members : []))
          .map((member) => member.text);
      case 'zset':
        return pages
          .flatMap((page) => (page.type === 'zset' ? page.members : []))
          .map((member) => ({ member: member.value.text, score: member.score }));
      case 'stream':
        return pages
          .flatMap((page) => (page.type === 'stream' ? page.entries : []))
          .map((entry) => ({
            id: entry.id,
            fields: Object.fromEntries(entry.fields.map((field) => [field.name, field.value.text])),
          }));
      default:
        return null;
    }
  };

  return JSON.stringify(plain(), null, 2);
};
