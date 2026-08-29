import type { TranslationKey } from '@i18n/keys';
import { ConnectionType } from '@app/Shared/Services/api.types';

/**
 * Translation key per connection type.
 *
 * <p>Written out rather than derived from the wire value so the keys stay type-checked: adding a
 * topology to {@link ConnectionType} without translating it becomes a compile error instead of a
 * raw "STANDALONE" leaking into the UI.
 */
const TYPE_KEYS: Record<ConnectionType, TranslationKey> = {
  [ConnectionType.Standalone]: 'Connections.TYPE_STANDALONE',
  [ConnectionType.Cluster]: 'Connections.TYPE_CLUSTER',
  [ConnectionType.Sentinel]: 'Connections.TYPE_SENTINEL',
};

export const connectionTypeKey = (type: ConnectionType): TranslationKey => TYPE_KEYS[type];
