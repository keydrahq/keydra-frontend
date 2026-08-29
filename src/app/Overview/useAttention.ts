import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertState } from '@app/Alerts/types';
import type { AlertRuleSummary } from '@app/Alerts/types';
import { formatReading } from '@app/Alerts/wording';
import { RunOutcome } from '@app/Schedules/types';
import type { JobRunSummary } from '@app/Schedules/types';
import { NotificationCategory } from '@app/Shared/Services/api.types';
import { ServiceContext } from '@app/Shared/Services/Services';
import { useHubRefresh } from '@app/Shared/Components/useHubRefresh';
import { ConnectionState } from '@app/Shared/Services/api.types';
import type { ConnectionResponse } from '@app/Shared/Services/api.types';
import type { MigrationJob } from '@app/KeyBrowser/types';
import { connectionHome } from '@app/routes';

/** How loudly one thing is asking to be looked at. */
export const Urgency = {
  Danger: 'danger',
  Warning: 'warning',
} as const;

export type Urgency = (typeof Urgency)[keyof typeof Urgency];

/** One thing worth somebody's attention, wherever it came from. */
export interface Attention {
  id: string;
  urgency: Urgency;
  /** What happened, in a sentence. */
  title: string;
  /** Which target, or which job — the thing it happened to. */
  subject: string;
  /** When, so a list can be read newest first. */
  at?: string;
  /** Where to go and look. */
  href: string;
  /** What kind of thing this is, so several of the same kind can be said once. */
  kind: string;
  /** How many there were, when several of one kind were folded into this row. */
  count?: number;
}

/**
 * Everything that is currently wrong, from wherever it is recorded.
 *
 * <p>The question a fleet dashboard exists to answer, and the one no single page can: a rule
 * firing lives with the alerts, a schedule that failed lives with the schedules, and a target
 * that has stopped answering lives with the connections. Somebody arriving in the morning has
 * one question, not four.
 *
 * <p>Ordered by how much it matters rather than by where it came from. A target nobody can reach
 * outranks a backup that skipped a night, whichever of them happened more recently.
 */
/**
 * The migrations worth mentioning on the overview.
 *
 * <p>The newest fifty rather than all of them: this is a summary of what needs attention, and
 * anything older than the newest fifty either finished long ago or is on the migrations page,
 * where the whole history is paged properly.
 */
/**
 * Everything the attention panel reads, in one question.
 *
 * <p>Three before: the alert rules, the schedule runs, and the running migrations — each its own
 * request, each on its own timer. They are three answers to one question, which is "is anything
 * wrong", and the panel cannot draw a line of itself until it has all three.
 *
 * <p>Fifty migrations rather than all of them: this is a summary, and anything older either
 * finished long ago or is on the migrations page, where the whole history is paged properly. The
 * runs are the same — what a panel says is what happened lately.
 */
const ATTENTION = `
  query Attention($first: Int!) {
    alertRules {
      id
      name
      connectionId
      connectionName
      metric
      unit
      threshold
      state
      since
      reading
    }
    scheduleRuns {
      id
      jobId
      jobName
      outcome
      detail
      finishedAt
    }
    migrations(first: $first) {
      nodes {
        id
        state
        scanned
        migrated
        failed
        reason
        startedAt
      }
    }
  }
`;

interface AttentionAnswer {
  alertRules: AlertRuleSummary[];
  scheduleRuns: JobRunSummary[];
  migrations: { nodes: MigrationJob[] };
}

export const useAttention = (profiles: ConnectionResponse[]): Attention[] => {
  const { t } = useTranslation();
  const { graphql } = useContext(ServiceContext);

  /*
   * Told rather than asking. Every one of these broadcasts when it changes — a rule that starts
   * firing, a schedule that finished, a migration taking a step — so the three timers that used to
   * sit behind this panel were asking a server that had already said nothing had happened.
   */
  useHubRefresh(
    [
      NotificationCategory.AlertChanged,
      NotificationCategory.ScheduleRan,
      NotificationCategory.ScheduleFailed,
      NotificationCategory.MigrationProgress,
    ],
    ['attention'],
  );

  const answer = useQuery({
    queryKey: ['attention'],
    queryFn: () => graphql.query<AttentionAnswer>(ATTENTION, { first: 50 }),
  });

  const rules = { data: answer.data?.alertRules };
  const runs = { data: answer.data?.scheduleRuns };
  const migrations = { data: answer.data?.migrations.nodes };

  const items: Attention[] = [];

  for (const profile of profiles) {
    if (profile.status.state === ConnectionState.Down) {
      items.push({
        id: `down-${profile.id}`,
        kind: 'down',
        urgency: Urgency.Danger,
        title: t('Overview.ATTENTION_DOWN'),
        subject: profile.name,
        at: profile.status.checkedAt ?? undefined,
        href: connectionHome(profile.id),
      });
    }
  }

  for (const rule of rules.data ?? []) {
    if (rule.state === AlertState.Firing) {
      items.push({
        id: `alert-${rule.id}`,
        kind: 'alert',
        urgency: Urgency.Danger,
        title: t('Overview.ATTENTION_FIRING', {
          name: rule.name,
          reading: formatReading(rule.reading, rule.unit),
        }),
        subject: rule.connectionName ?? String(rule.connectionId),
        at: rule.since ?? undefined,
        href: '/alerts',
      });
    }
  }

  for (const run of runs.data ?? []) {
    if (run.outcome === RunOutcome.Failed || run.outcome === RunOutcome.Refused) {
      items.push({
        id: `run-${run.id}`,
        kind: `run-${run.outcome}`,
        urgency: run.outcome === RunOutcome.Failed ? Urgency.Danger : Urgency.Warning,
        title:
          run.outcome === RunOutcome.Failed
            ? t('Overview.ATTENTION_JOB_FAILED')
            : t('Overview.ATTENTION_JOB_REFUSED'),
        subject: run.jobName ?? String(run.jobId),
        at: run.finishedAt ?? run.startedAt,
        href: '/schedules',
      });
    }
  }

  for (const job of migrations.data ?? []) {
    if (job.state === 'FAILED' || job.state === 'INTERRUPTED') {
      items.push({
        id: `migration-${job.id}`,
        kind: `migration-${job.state}`,
        urgency: job.state === 'FAILED' ? Urgency.Danger : Urgency.Warning,
        title:
          job.state === 'FAILED'
            ? t('Overview.ATTENTION_MIGRATION_FAILED')
            : t('Overview.ATTENTION_MIGRATION_INTERRUPTED'),
        subject: t('Overview.ATTENTION_MIGRATION_SUBJECT', {
          migrated: job.migrated,
          scanned: job.scanned,
        }),
        at: job.finishedAt ?? job.startedAt,
        href: '/migrations',
      });
    }
  }

  const ordered = items.sort((left, right) => {
    if (left.urgency !== right.urgency) {
      return left.urgency === Urgency.Danger ? -1 : 1;
    }
    return (right.at ?? '').localeCompare(left.at ?? '');
  });

  /*
   * Several of one kind are said once. One broken schedule produces a failed run every five
   * minutes and one interrupted migration behind it, and a panel listing each of them is a
   * panel where the one other thing that went wrong is below the fold. The newest keeps its
   * own words; the rest become a number beside them.
   *
   * A target that is not answering is never folded — each one is a different server, and
   * "3 targets are not answering" is the sentence that gets somebody looking at the wrong one.
   */
  const folded: Attention[] = [];
  for (const item of ordered) {
    const existing =
      item.kind === 'down' ? undefined : folded.find((seen) => seen.kind === item.kind);
    if (existing) {
      existing.count = (existing.count ?? 1) + 1;
    } else {
      folded.push({ ...item });
    }
  }
  return folded.slice(0, 8);
};
