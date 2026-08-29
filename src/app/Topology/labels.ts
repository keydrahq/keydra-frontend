import type { TranslationKey } from '@i18n/keys';
import { Feature } from './types';
import type { ClusterNode } from './types';

/**
 * Translation keys for the features a target may support.
 *
 * <p>A map rather than a template built from the feature name: the key type is checked at compile
 * time, so a feature added to the backend without a translation is a build error rather than a
 * raw identifier appearing in the UI.
 */
const FEATURE_LABELS: Record<string, TranslationKey> = {
  [Feature.CopyKey]: 'Topology.FEATURE.copyKey',
  [Feature.RenameKey]: 'Topology.FEATURE.renameKey',
  [Feature.Expiry]: 'Topology.FEATURE.expiry',
  [Feature.MeasureMemory]: 'Topology.FEATURE.measureMemory',
  [Feature.SlowLog]: 'Topology.FEATURE.slowLog',
  [Feature.ClientList]: 'Topology.FEATURE.clientList',
  [Feature.Streams]: 'Topology.FEATURE.streams',
  [Feature.PubSub]: 'Topology.FEATURE.pubSub',
  [Feature.Cluster]: 'Topology.FEATURE.cluster',
  [Feature.Sentinel]: 'Topology.FEATURE.sentinel',
  [Feature.Metrics]: 'Topology.FEATURE.metrics',
  [Feature.Console]: 'Topology.FEATURE.console',
  [Feature.CommandStream]: 'Topology.FEATURE.commandStream',
  [Feature.AccessControl]: 'Topology.FEATURE.accessControl',
  [Feature.Transfer]: 'Topology.FEATURE.transfer',
  [Feature.Admin]: 'Topology.FEATURE.admin',
  [Feature.Topology]: 'Topology.FEATURE.topology',
};

/** The key for a feature, or undefined for one this build does not know — shown as-is. */
export const featureLabelKey = (feature: string): TranslationKey | undefined =>
  FEATURE_LABELS[feature];

export const roleLabelKey = (role: ClusterNode['role']): TranslationKey =>
  role === 'primary' ? 'Topology.ROLE_PRIMARY' : 'Topology.ROLE_REPLICA';
