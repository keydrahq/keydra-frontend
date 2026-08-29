import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { ServiceContext } from '@app/Shared/Services/Services';
import type { Capabilities, TargetTopology } from './types';

export const topologyQueryKey = (connectionId: number) => ['topology', connectionId] as const;

/**
 * How a target is arranged and what it supports.
 *
 * <p>Held for a while rather than refetched: a server's command set does not change between page
 * loads, and its cluster membership changes rarely enough that a manual reload is the right way to
 * see a change.
 */
const TOPOLOGY = `
  query Topology($connectionId: BigInteger) {
    topology(connectionId: $connectionId) {
      server {
        version
        mode
        flavor
      }
      capabilities {
        detected
        features
      }
      health {
        state
        serving
        slotsAssigned
        slotsOk
        slotsPfail
        slotsFail
        knownNodes
        size
        currentEpoch
      }
      nodes {
        id
        address
        role
        primaryId
        flags
        linkState
        # Aliased, and this is the one place the mismatch is written down: the Java field is
        # isSelf and SmallRye publishes it as self, so reading node.isSelf off the answer
        # silently gave undefined and the "connected to" marker never appeared against a real
        # server. It appeared against the mock, which is why nothing caught it.
        isSelf: self
        slots {
          from
          to
        }
        migrations {
          slot
          direction
          peerId
        }
      }
      sentinelMasters {
        name
        address
        quorum
        status
        replicas {
          address
          status
          linkStatus
        }
      }
    }
  }
`;

export const useTopology = (connectionId: number): UseQueryResult<TargetTopology, Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: topologyQueryKey(connectionId),
    queryFn: () =>
      graphql
        .query<{ topology: TargetTopology }>(TOPOLOGY, { connectionId })
        .then((a) => a.topology),
    staleTime: 60_000,
  });
};

/**
 * Everything supported, for a target whose capabilities have not been read.
 *
 * <p>Assuming presence rather than absence is deliberate: hiding a feature the server has is
 * worse than offering one it does not, because the second failure explains itself and the first
 * looks like the feature was never built.
 */
const ASSUME_EVERYTHING: Capabilities = {
  features: [],
  detected: false,
};

/**
 * Whether a target supports a feature.
 *
 * <p>Answers true while the answer is unknown, and true when the server declined to be asked.
 */
export const useSupports = (connectionId: number, feature: string): boolean => {
  const topology = useTopology(connectionId);
  const capabilities = topology.data?.capabilities ?? ASSUME_EVERYTHING;
  return !capabilities.detected || capabilities.features.includes(feature);
};
