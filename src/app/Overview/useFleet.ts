import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ServiceContext } from '@app/Shared/Services/Services';
import { ConnectionState, NotificationCategory } from '@app/Shared/Services/api.types';
import { useHubRefresh } from '@app/Shared/Components/useHubRefresh';
import type { ConnectionResponse } from '@app/Shared/Services/api.types';
import type { MetricsSample } from '@app/Monitoring/types';

export interface FleetMember {
  profile: ConnectionResponse;
  sample?: MetricsSample;
  isLoading: boolean;
}

export interface Fleet {
  members: FleetMember[];
  reachable: number;
  unreachable: number;
  /** Sums over the targets that answered; a target that did not is left out rather than counted as zero. */
  keys: number;
  memoryBytes: number;
  clients: number;
  opsPerSecond: number;
  /** How many of the reachable targets have reported so far. */
  reporting: number;
}

/**
 * Every saved target's current reading, gathered at once.
 *
 * <p>One query per target rather than one endpoint answering for all of them: a target that is
 * down, slow or behind a tunnel that will not open must not hold up the others, and each reading
 * is independently refreshable and independently stale.
 *
 * <p>Only reachable targets are asked. A profile whose last check failed has nothing to sample, and
 * asking anyway would spend a connection attempt per target per refresh on servers known to be
 * unreachable.
 */
const FLEET = `
  query Fleet {
    fleet {
      connectionId
      sample {
        at
        memoryUsedBytes
        memoryPeakBytes
        memoryMaxBytes
        keyCount
        connectedClients
        opsPerSecond
        keyspaceHits
        keyspaceMisses
        expiredKeys
        evictedKeys
        totalCommands
        uptimeSeconds
      }
    }
  }
`;

export const useFleet = (profiles: ConnectionResponse[]): Fleet => {
  const { graphql } = useContext(ServiceContext);

  /*
   * One question for the whole fleet, and it used to be one per target: an estate of twenty made
   * twenty requests every time somebody opened the overview, and again on every timer tick. They
   * are one question — "how is the fleet" — and the server answers it better, because it takes the
   * readings at once where twenty browser requests queue behind each other.
   *
   * Not on a timer either. A target being sampled broadcasts its readings and one going up or down
   * says so; a target nobody is sampling has figures that change slowly enough that the next visit
   * is soon enough.
   */
  useHubRefresh(
    [NotificationCategory.MetricsSample, NotificationCategory.ConnectionStatusChanged],
    ['fleet'],
  );

  const answer = useQuery({
    queryKey: ['fleet'],
    queryFn: () =>
      graphql
        .query<{ fleet: { connectionId: number; sample: MetricsSample | null }[] }>(FLEET)
        .then((a) => a.fleet),
    // A stale set of readings is better than empty figures while the next one is in flight.
    placeholderData: (previous) => previous,
  });

  const byTarget = new Map((answer.data ?? []).map((one) => [one.connectionId, one.sample]));

  const members: FleetMember[] = profiles.map((profile) => ({
    profile,
    sample: byTarget.get(profile.id) ?? undefined,
    isLoading: answer.isPending,
  }));

  const answered = members.filter((member) => member.sample);
  const sum = (read: (sample: MetricsSample) => number | null): number =>
    answered.reduce((total, member) => total + (read(member.sample!) ?? 0), 0);

  return {
    members,
    reachable: profiles.filter((profile) => profile.status.state === ConnectionState.Up).length,
    unreachable: profiles.filter((profile) => profile.status.state !== ConnectionState.Up).length,
    keys: sum((sample) => sample.keyCount),
    memoryBytes: sum((sample) => sample.memoryUsedBytes),
    clients: sum((sample) => sample.connectedClients),
    opsPerSecond: sum((sample) => sample.opsPerSecond),
    reporting: answered.length,
  };
};
