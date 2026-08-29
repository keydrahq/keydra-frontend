/** Wire types for the keyspace report, mirroring io.keydra.analysis.dto. */

import type { KeySize } from '@app/Monitoring/types';

export interface NamespaceUsage {
  prefix: string;
  keys: number;
  bytes: number;
  /** How many of them have no expiry, which is where memory creep comes from. */
  neverExpires: number;
}

export interface TypeUsage {
  type: string;
  keys: number;
  bytes: number;
}

export interface ExpiryBand {
  /** never | hour | day | week | longer */
  band: string;
  keys: number;
  bytes: number;
}

export interface KeyspaceReport {
  sampled: number;
  keysInDatabase: number;
  bytesSampled: number;
  namespaces: NamespaceUsage[];
  types: TypeUsage[];
  expiry: ExpiryBand[];
  largest: KeySize[];
}
