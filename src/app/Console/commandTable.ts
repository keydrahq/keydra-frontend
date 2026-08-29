/**
 * Commands offered for completion.
 *
 * <p>Bundled rather than read from the server's own COMMAND table: completion has to be instant on
 * every keystroke, and the list a person actually types is short and stable. A command missing from
 * here still runs — this only decides what is suggested.
 */
export interface CommandHint {
  name: string;
  /** Argument shape, in the notation redis.io uses. */
  arguments: string;
  summary: string;
}

export const COMMAND_TABLE: CommandHint[] = [
  { name: 'GET', arguments: 'key', summary: 'Get a string value' },
  { name: 'SET', arguments: 'key value [EX seconds] [NX|XX]', summary: 'Set a string value' },
  { name: 'DEL', arguments: 'key [key ...]', summary: 'Delete keys' },
  { name: 'EXISTS', arguments: 'key [key ...]', summary: 'Count which of these keys exist' },
  { name: 'EXPIRE', arguments: 'key seconds', summary: 'Set a key’s time to live' },
  { name: 'TTL', arguments: 'key', summary: 'Seconds until a key expires' },
  { name: 'PERSIST', arguments: 'key', summary: 'Remove a key’s expiry' },
  { name: 'TYPE', arguments: 'key', summary: 'What a key holds' },
  { name: 'RENAME', arguments: 'key newkey', summary: 'Rename a key' },
  { name: 'COPY', arguments: 'source destination [REPLACE]', summary: 'Copy a key' },
  { name: 'SCAN', arguments: 'cursor [MATCH pattern] [COUNT n]', summary: 'Walk the keyspace' },
  { name: 'INCR', arguments: 'key', summary: 'Add one to a number' },
  { name: 'DECR', arguments: 'key', summary: 'Subtract one from a number' },
  { name: 'INCRBY', arguments: 'key increment', summary: 'Add to a number' },
  { name: 'HGET', arguments: 'key field', summary: 'Get one hash field' },
  { name: 'HSET', arguments: 'key field value [field value ...]', summary: 'Set hash fields' },
  { name: 'HDEL', arguments: 'key field [field ...]', summary: 'Delete hash fields' },
  { name: 'HGETALL', arguments: 'key', summary: 'Every field and value of a hash' },
  { name: 'HSCAN', arguments: 'key cursor [MATCH pattern]', summary: 'Walk a hash' },
  { name: 'LPUSH', arguments: 'key element [element ...]', summary: 'Prepend to a list' },
  { name: 'RPUSH', arguments: 'key element [element ...]', summary: 'Append to a list' },
  { name: 'LRANGE', arguments: 'key start stop', summary: 'A range of list elements' },
  { name: 'LLEN', arguments: 'key', summary: 'How long a list is' },
  { name: 'LREM', arguments: 'key count element', summary: 'Remove list elements by value' },
  { name: 'SADD', arguments: 'key member [member ...]', summary: 'Add set members' },
  { name: 'SREM', arguments: 'key member [member ...]', summary: 'Remove set members' },
  { name: 'SMEMBERS', arguments: 'key', summary: 'Every member of a set' },
  { name: 'SCARD', arguments: 'key', summary: 'How many members a set has' },
  { name: 'ZADD', arguments: 'key score member [score member ...]', summary: 'Add scored members' },
  { name: 'ZRANGE', arguments: 'key start stop [WITHSCORES]', summary: 'A range of a sorted set' },
  { name: 'ZSCORE', arguments: 'key member', summary: 'One member’s score' },
  { name: 'ZREM', arguments: 'key member [member ...]', summary: 'Remove sorted-set members' },
  {
    name: 'XADD',
    arguments: 'key * field value [field value ...]',
    summary: 'Append a stream entry',
  },
  { name: 'XRANGE', arguments: 'key start end [COUNT n]', summary: 'A range of stream entries' },
  { name: 'XLEN', arguments: 'key', summary: 'How many entries a stream has' },
  { name: 'PUBLISH', arguments: 'channel message', summary: 'Publish a message' },
  { name: 'INFO', arguments: '[section]', summary: 'Server statistics' },
  { name: 'DBSIZE', arguments: '', summary: 'How many keys the database holds' },
  { name: 'PING', arguments: '[message]', summary: 'Check the connection' },
  { name: 'MEMORY', arguments: 'USAGE key', summary: 'How much memory a key uses' },
  { name: 'OBJECT', arguments: 'ENCODING key', summary: 'How a value is stored' },
  { name: 'CONFIG', arguments: 'GET parameter', summary: 'Read a server setting' },
  { name: 'CLIENT', arguments: 'LIST', summary: 'Connected clients' },
  { name: 'SLOWLOG', arguments: 'GET [count]', summary: 'Recent slow commands' },
];

/** Hints whose name starts with what has been typed, best match first. */
export const completionsFor = (prefix: string): CommandHint[] => {
  const needle = prefix.trim().toUpperCase();
  if (needle === '') {
    return [];
  }
  return COMMAND_TABLE.filter((hint) => hint.name.startsWith(needle));
};
