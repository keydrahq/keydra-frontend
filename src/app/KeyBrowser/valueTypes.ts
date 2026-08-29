/** Wire types for value reading and editing, mirroring io.keydra.values.dto. */

/**
 * A value as text, plus how it was read.
 *
 * <p>The server decodes, so the browser never handles raw bytes and a gzipped or msgpack value is
 * readable without the UI shipping a decoder for every format.
 */
export interface EncodedValue {
  text: string;
  encoding: string;
  /** Raw size in bytes, before decoding. */
  size: number;
  truncated: boolean;
}

export interface HashField {
  name: string;
  value: EncodedValue;
}

export interface ListElement {
  index: number;
  value: EncodedValue;
}

export interface ScoredMember {
  value: EncodedValue;
  score: number;
}

export interface StreamEntry {
  id: string;
  fields: HashField[];
}

/** Common to every page: where to resume, and how big the value is in total. */
interface PageBase {
  /** Null once the value has been read to its end. */
  cursor: string | null;
  /** Null when the store cannot say cheaply. */
  total: number | null;
}

export interface StringPage extends PageBase {
  type: 'string';
  value: EncodedValue;
  /** Always null: a string is one value, not a collection. Its size is on the value. */
  total: null;
}

export interface HashPage extends PageBase {
  type: 'hash';
  fields: HashField[];
}

export interface ListPage extends PageBase {
  type: 'list';
  elements: ListElement[];
}

export interface SetPage extends PageBase {
  type: 'set';
  members: EncodedValue[];
}

export interface ZSetPage extends PageBase {
  type: 'zset';
  members: ScoredMember[];
}

export interface StreamPage extends PageBase {
  type: 'stream';
  entries: StreamEntry[];
}

/**
 * One slice of a key's value.
 *
 * <p>Discriminated on `type`, mirroring the backend's sealed interface: TypeScript then refuses an
 * editor that forgets a variant, the same way the Java switch does.
 */
export type ValuePage = StringPage | HashPage | ListPage | SetPage | ZSetPage | StreamPage;

/** A change to one key's value; `operation` is the discriminator the backend reads. */
export type ValueMutation =
  | { operation: 'setString'; key: string; value: string }
  | { operation: 'setHashField'; key: string; field: string; value: string }
  | { operation: 'deleteHashField'; key: string; field: string }
  | { operation: 'setListElement'; key: string; index: number; value: string }
  | { operation: 'pushListElement'; key: string; value: string; toHead: boolean }
  | { operation: 'removeListElement'; key: string; value: string; count: number }
  /** The one element at an index, as opposed to every element equal to a value. */
  | { operation: 'removeListElementAt'; key: string; index: number }
  | { operation: 'addSetMember'; key: string; member: string }
  | { operation: 'removeSetMember'; key: string; member: string }
  | { operation: 'addScoredMember'; key: string; member: string; score: number }
  | { operation: 'removeScoredMember'; key: string; member: string }
  | { operation: 'addStreamEntry'; key: string; id: string | null; fields: Record<string, string> }
  | { operation: 'deleteStreamEntry'; key: string; id: string };

export interface MutationResult {
  affected: number;
}

/** Encoding the server picks on its own; anything else is an explicit request. */
export const AUTO_ENCODING = 'auto';
