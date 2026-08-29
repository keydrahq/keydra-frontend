/** Wire types for topology, mirroring io.keydra.topology.dto and io.keydra.engine. */

import type { ServerInfo } from '@app/Shared/Services/api.types';

/** Features whose absence changes what the UI should offer. Mirrors Capabilities.Feature. */
export const Feature = {
  CopyKey: 'copyKey',
  RenameKey: 'renameKey',
  Expiry: 'expiry',
  MeasureMemory: 'measureMemory',
  SlowLog: 'slowLog',
  ClientList: 'clientList',
  Streams: 'streams',
  PubSub: 'pubSub',
  /** The store announcing its own mutations, and therefore a key list that stays true. */
  KeyspaceEvents: 'keyspaceEvents',
  Cluster: 'cluster',
  Sentinel: 'sentinel',
  Metrics: 'metrics',
  /*
   * The six below are not asked of the server. They are what the engine offers at all — a store
   * either has a command language or it does not — so they are true or false before anything is
   * connected to, and they are what decides which tabs a target is given.
   */
  Console: 'console',
  CommandStream: 'commandStream',
  AccessControl: 'accessControl',
  Transfer: 'transfer',
  Admin: 'admin',
  Topology: 'topology',
} as const;

export type Feature = (typeof Feature)[keyof typeof Feature];

export interface Capabilities {
  features: string[];
  /**
   * False when the target could not be asked, in which case everything is assumed present
   * and an unsupported operation fails where it is used rather than being hidden.
   */
  detected: boolean;
}

export interface SlotRange {
  from: number;
  to: number;
}

/**
 * What a cluster says about itself. Mirrors io.keydra.engine.ClusterHealth.
 *
 * <p>Not the same question the node list answers. Every slot can be assigned while the cluster
 * refuses every request, because the node holding some of them is failing — so a page drawn from
 * the node list alone shows a full bar for a cluster that is down.
 */
export interface ClusterHealth {
  /** What the cluster thinks it is: "ok" when it will serve. */
  state: string;
  serving: boolean;
  /** How many of the 16384 have an owner at all. */
  slotsAssigned: number;
  /** How many of those have an owner that is answering. */
  slotsOk: number;
  slotsPfail: number;
  slotsFail: number;
  /** Every node, including replicas and nodes serving nothing. */
  knownNodes: number;
  /** How many serve slots, which is the number of shards. */
  size: number;
  /** Rises with every failover, so a jump means the cluster has been electing. */
  currentEpoch: number;
}

/**
 * One slot on its way between two nodes. Mirrors io.keydra.engine.ClusterNode.SlotMigration.
 *
 * <p>The only part of a cluster's description that is happening rather than being. Empty in the
 * ordinary case — a cluster is only resharding while somebody is resharding it.
 */
export interface SlotMigration {
  slot: number;
  /** From the reporting node's point of view: OUT is handing over, IN is taking on. */
  direction: 'OUT' | 'IN';
  peerId: string;
}

export interface ClusterNode {
  id: string;
  address: string;
  role: 'primary' | 'replica';
  isSelf: boolean;
  primaryId: string | null;
  slots: SlotRange[];
  linkState: string;
  flags: string[];
  migrations: SlotMigration[];
}

export interface SentinelReplica {
  address: string;
  status: string;
  linkStatus: string;
}

export interface SentinelMaster {
  name: string;
  address: string;
  status: string;
  quorum: number | null;
  replicas: SentinelReplica[];
}

export interface TargetTopology {
  server: ServerInfo;
  capabilities: Capabilities;
  nodes: ClusterNode[];
  sentinelMasters: SentinelMaster[];
  /** Null when the target is not a cluster, or is one that would not answer. */
  health: ClusterHealth | null;
}

/** Total hash slots in a Redis cluster; the denominator for a node's share. */
export const TOTAL_SLOTS = 16384;

/** How many slots a node serves, across all its ranges. */
export const slotCount = (node: ClusterNode): number =>
  node.slots.reduce((total, range) => total + (range.to - range.from + 1), 0);
