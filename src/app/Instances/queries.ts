import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { ServiceContext } from '@app/Shared/Services/Services';
import { ratesSince } from './traffic';
import type { BusRate } from './traffic';

/** One running Keydra. Mirrors io.keydra.cluster.dto.ClusterDtos.InstanceSummary. */
export interface InstanceSummary {
  id: string;
  version: string;
  commit: string | null;
  startedAt: string;
  lastSeenAt: string;
  /** Whether it holds the work that must happen once. */
  leader: boolean;
  /** Whether it is the one that answered — not the same as the leader, and worth marking. */
  self: boolean;
  /**
   * How many envelopes it has put on the notification bus, and taken off it. Cumulative.
   *
   * <p>The only evidence that instances are talking to each other at all: two Keydras do not
   * connect to one another, they both connect to the store and shout down the same channel. Totals
   * rather than rates, so the browser can work out a rate over exactly the interval it watched.
   */
  published: number;
  received: number;
  /**
   * How many commands it has sent to targets. Cumulative, and the same arithmetic applies.
   *
   * <p>Counted where a command is still one command — the moment before it is written to a
   * connection — so a pipeline of ten counts as ten rather than as one write.
   */
  commands: number;
  /**
   * How many browsers it is talking to, as of its last beat.
   *
   * <p>Where a load balancer's decisions show up, and only meaningful read across the fleet:
   * twelve on one instance and none on the other is not a busy instance, it is a balancer sending
   * everything one way.
   */
  sockets: number;
  /** Connections it holds open against a target because somebody is looking: subscriptions and
   * command watches. */
  streams: number;
  /** Long work under way on it — a keyspace being walked, a tunnel being held. */
  jobs: number;
  /**
   * Which targets it holds clients for, by connection id.
   *
   * <p>Ids rather than a count, because a target three instances are watching is three pools
   * against one server. Reported on the last beat like everything else here, so it is a few seconds
   * old rather than live.
   */
  watching: number[];
  /**
   * Whether somebody has asked it to stop taking new work.
   *
   * <p>The only field here the instance does not say about itself, and the only one that is true
   * the moment it is written. What follows from it — reporting itself unready, giving the chores
   * back, taking no new long work — happens when the instance next reads the row, which is a beat
   * later.
   */
  draining: boolean;
  /**
   * Whether it is still answering.
   *
   * <p>False for a row that has aged without being removed — an instance that stopped without
   * shutting down. One that stopped cleanly is not on this list at all, because it takes its own
   * row with it, which is the whole distinction: a row that vanishes is a departure and a row that
   * ages is a death.
   */
  present: boolean;
}

/** Something Keydra itself rests on. */
export interface DependencyState {
  /**
   * A stable, language-neutral name for the thing — `database`, `ssh-tunnels`.
   *
   * <p>What the icon and the translated label are matched on. Before it existed they were matched
   * on the English display name, which tied this file to a sentence in a Java file and made the
   * picture the one part of Keydra with no translation.
   */
  id: string;
  /** What it is, in English. `dependencyName` prefers a translation and falls back to this. */
  name: string;
  kind: string;
  /** False for something this deployment chose not to have, which is not a fault. */
  configured: boolean;
  reachable: boolean;
  /** How many there are: one database, however many identity providers or targets. */
  count: number;
  /** How many of those are all right — a different number only where there is more than one. */
  healthy: number;
  /** An exception's own words, when it did not answer. Diagnostic, and shown as it is. */
  detail: string | null;
  /**
   * A stable key for the standing sentence that explains something nobody has configured.
   *
   * <p>`mail-off`, `shared-store-local`. A key rather than the sentence, because the sentence is
   * interface text; `dependencyDetail` writes it.
   */
  note: string | null;
  /**
   * What came of asking these whether they answer, or null for a group nothing asks.
   *
   * <p>The database and the store are reached by every request, so nothing asks them separately; a
   * chat channel is not asked because asking one sends somebody a message. Identity providers and
   * backup destinations are asked on a slow clock, and this is the last thing they said.
   */
  reached: { at: string; asked: number; answering: number } | null;
}

/**
 * Two things this deployment says that cannot both be right.
 *
 * <p>Not the same question as a dependency being unconfigured. That is a choice — a deployment with
 * no mail relay does not send mail — and this is a contradiction.
 */
export interface DeploymentNote {
  /** The environment variable to change, named as somebody would set it. */
  setting: string;
  saying: string;
  /** What it is costing meanwhile, because a warning nobody can weigh is one nobody acts on. */
  costing: string;
}

export interface InstanceHealth {
  instances: InstanceSummary[];
  dependencies: DependencyState[];
  /**
   * When the work that must happen once stopped being done, or null in every ordinary case.
   *
   * <p>Including the seconds between one instance giving the chores up and another claiming them:
   * the server applies the same threshold it announces on, so the page and the message cannot
   * disagree about one fact.
   */
  choresStoppedSince: string | null;
  /** Empty in the ordinary case, and drawn as nothing at all when it is. */
  deployment: DeploymentNote[];
}

/** The same answer, with what changed since the one before it worked out. */
export interface InstanceHealthWithRates extends InstanceHealth {
  rates: Map<string, BusRate>;
}

/**
 * One time something outside Keydra started or stopped answering.
 *
 * <p>A change, not an answer: a row exists because something happened, so a subject that works
 * writes a handful a year and the list stays short enough to read.
 */
export interface ReachabilityEvent {
  kind: string;
  subjectId: number;
  /** What it was called then, which is not always what it is called now. */
  name: string | null;
  at: string;
  ok: boolean;
  detail: string | null;
}

export const instancesQueryKey = ['instances'] as const;

/**
 * How Keydra itself is doing.
 *
 * <p>Refetched on a timer, unlike almost everything else here, and for the reason the rest are not:
 * this page is opened *because* something might be wrong, and a roster that was true when the tab
 * was opened is the one answer that would mislead. The interval is a little longer than a lease, so
 * an instance that stops beating disappears from the page about as fast as it stops being here.
 */
export const useInstances = (): UseQueryResult<InstanceHealthWithRates, Error> => {
  const { api } = useContext(ServiceContext);
  return useQuery({
    queryKey: instancesQueryKey,
    // The rates are worked out here rather than in a component, because a rate needs the previous
    // reading and a clock and neither belongs in a render. Fetching is where both are allowed.
    queryFn: async () => {
      const health = await api.doGet<InstanceHealth>('/instances');
      return { ...health, rates: ratesSince(health.instances) };
    },
    // Often enough that the traffic on the page is traffic rather than history. Two readings make
    // a rate, so this is also how long the first one takes to appear.
    refetchInterval: 5_000,
  });
};

export const rosterQueryKey = ['instances', 'roster'] as const;

/**
 * Which instances are holding one target.
 *
 * <p>The roster read the other way round. It is its own endpoint rather than the full health
 * answer because that one probes the database and both stores every time it is asked, and a line
 * of text beside a target is not worth three outbound probes every few seconds.
 *
 * <p>Slower than the instances page for the same reason: which instance holds a target changes when
 * somebody opens or closes a page, not from one second to the next, and this is context rather than
 * something being watched.
 *
 * @param connectionId the target being asked about
 * @param enabled false where the caller may not read the roster at all, so an account without
 *   `instance:read` makes no request rather than collecting a 403 on every target page
 */
export const useTargetHolders = (
  connectionId: number,
  enabled: boolean,
): UseQueryResult<InstanceSummary[], Error> => {
  const { api } = useContext(ServiceContext);
  return useQuery({
    queryKey: [...rosterQueryKey, connectionId],
    queryFn: async () => {
      const roster = await api.doGet<InstanceSummary[]>('/instances/roster');
      return roster.filter((instance) => instance.watching.includes(connectionId));
    },
    enabled,
    refetchInterval: 30_000,
  });
};

/**
 * Takes an instance out of service, or puts it back.
 *
 * <p>Answered by whichever instance the request reached, which is almost never the one it is about:
 * it writes a row, and the instance it names acts on it on its next beat. So the reply means the
 * instruction was written and nothing more — what came of it is read off the roster a moment later,
 * which the page is refetching for anyway.
 */
export const useDrainInstance = (): UseMutationResult<
  void,
  Error,
  { id: string; draining: boolean }
> => {
  const { api } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, draining }) =>
      draining
        ? api.doPost<void>(`/instances/${encodeURIComponent(id)}/drain`)
        : api.doDelete<void>(`/instances/${encodeURIComponent(id)}/drain`),
    // The prefix, so the roster read beside a target is invalidated with the page that lists them.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: instancesQueryKey }),
  });
};

/**
 * Asks everything Keydra reaches whether it is there, now.
 *
 * <p>Refused by the server when the last answer is seconds old, which arrives as a 429 rather than
 * as a silence — a button that can be held down is a way to make Keydra hammer somebody else's
 * service from a page that only needs to be read.
 */
export const useCheckReachability = (): UseMutationResult<void, Error, void> => {
  const { api } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.doPost<void>('/instances/reachability'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: instancesQueryKey }),
  });
};

/**
 * What has started and stopped answering, newest first.
 *
 * <p>Its own query rather than a field on the health answer. The two are read at different rates:
 * the roster is refetched on a timer because a page opened because something might be wrong must
 * not be showing a moment that has passed, and a history of changes is the same list a minute
 * later.
 */
export const useReachabilityHistory = (): UseQueryResult<ReachabilityEvent[], Error> => {
  const { api } = useContext(ServiceContext);
  return useQuery({
    queryKey: [...instancesQueryKey, 'reachability-history'],
    queryFn: () => api.doGet<ReachabilityEvent[]>('/instances/reachability/history'),
  });
};
