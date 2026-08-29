import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { NotificationCategory } from '@app/Shared/Services/api.types';
import { ServiceContext } from '@app/Shared/Services/Services';
import { useHubRefresh } from '@app/Shared/Components/useHubRefresh';
import type { JobRunSummary, JobTypeInfo, ScheduleRequest, ScheduleSummary } from './types';

export const schedulesQueryKey = ['schedules'] as const;

/**
 * The schedules and their history are invalidated together.
 *
 * <p>They are two readings of one thing: running a schedule now changes both the history and the
 * "last run" the list shows, and deleting one takes its runs with it.
 */
const useInvalidateSchedules = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: schedulesQueryKey });
};

/** Enough of a target to name it in a row and to choose one in a form. */
export interface TargetChoice {
  id: number;
  name: string;
  /** Whether arranging work that would empty this target means naming it first. */
  guarded: boolean;
}

/** Everything the page draws, which is what it asks for. */
export interface SchedulesPage {
  schedules: ScheduleSummary[];
  scheduleJobTypes: JobTypeInfo[];
  connections: TargetChoice[];
}

const PAGE = `
  query SchedulesPage {
    schedules {
      id
      name
      connectionId
      connectionName
      jobType
      cron
      enabled
      settings
      createdBy
      createdAt
      lastRunAt
      lastOutcome
      nextRunAt
    }
    scheduleJobTypes {
      name
      requires
    }
    connections {
      id
      name
      guarded
    }
  }
`;

/**
 * Everything the page needs, asked once.
 *
 * <p>Three requests before: the schedules, the kinds of work this build can do, and the whole
 * connection catalogue so a form could offer targets to choose from. The catalogue was asked for
 * again by the dialog, and again by the row that names a target.
 *
 * <p>Not on a timer. The interesting column moves on its own — "last run" changes without anybody
 * touching the page — but the server says when a run finishes, so the page is told rather than
 * asking every fifteen seconds and usually being handed back what it already had.
 */
const useSchedulesPageSelecting = <T>(
  select: (page: SchedulesPage) => T,
): UseQueryResult<T, Error> => {
  const { graphql } = useContext(ServiceContext);
  useHubRefresh(
    [NotificationCategory.ScheduleRan, NotificationCategory.ScheduleFailed],
    schedulesQueryKey,
  );
  return useQuery({
    queryKey: [...schedulesQueryKey, 'page'],
    queryFn: () => graphql.query<SchedulesPage>(PAGE),
    select,
  });
};

export const useSchedulesPage = (): UseQueryResult<SchedulesPage, Error> =>
  useSchedulesPageSelecting((page) => page);

/**
 * The kinds of work, read off the page's own answer.
 *
 * <p>A derived view rather than a second query. The dialog needs them and so does the page; asking
 * separately would be the request this change exists to remove, and reading them from the same
 * cached answer costs nothing — TanStack hands back the same object.
 */
export const useJobTypes = (): UseQueryResult<JobTypeInfo[], Error> =>
  useSchedulesPageSelecting((page) => page.scheduleJobTypes);

/** The targets a schedule can be arranged against, from the same answer. */
export const useScheduleTargets = (): UseQueryResult<TargetChoice[], Error> =>
  useSchedulesPageSelecting((page) => page.connections);

const RUNS = `
  query ScheduleRuns($jobId: BigInteger) {
    scheduleRuns(jobId: $jobId) {
      id
      jobId
      jobName
      startedAt
      finishedAt
      outcome
      detail
      wasManual
    }
  }
`;

/** What the schedules have done — all of them, or one. */
export const useJobRuns = (jobId?: number): UseQueryResult<JobRunSummary[], Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: [...schedulesQueryKey, 'runs', jobId ?? 'all'],
    queryFn: () =>
      graphql
        .query<{ scheduleRuns: JobRunSummary[] }>(RUNS, { jobId: jobId ?? null })
        .then((answer) => answer.scheduleRuns),
  });
};

const CREATE = `
  mutation CreateSchedule($connectionId: BigInteger, $schedule: ScheduleRequestInput) {
    createSchedule(connectionId: $connectionId, schedule: $schedule) {
      id
    }
  }
`;

const UPDATE = `
  mutation UpdateSchedule(
    $id: BigInteger
    $connectionId: BigInteger
    $schedule: ScheduleRequestInput
  ) {
    updateSchedule(id: $id, connectionId: $connectionId, schedule: $schedule) {
      id
    }
  }
`;

export const useSaveSchedule = (): UseMutationResult<
  { id: number },
  Error,
  { id?: number; request: ScheduleRequest }
> => {
  const { graphql } = useContext(ServiceContext);
  const invalidate = useInvalidateSchedules();
  return useMutation({
    // The target rides along as its own argument as well as inside the request: the permission
    // check happens before the body is read, and it is a permission about that target.
    mutationFn: ({ id, request }) =>
      id === undefined
        ? graphql
            .query<{ createSchedule: { id: number } }>(CREATE, {
              connectionId: request.connectionId,
              schedule: request,
            })
            .then((answer) => answer.createSchedule)
        : graphql
            .query<{ updateSchedule: { id: number } }>(UPDATE, {
              id,
              connectionId: request.connectionId,
              schedule: request,
            })
            .then((answer) => answer.updateSchedule),
    onSuccess: invalidate,
  });
};

const DELETE = `
  mutation DeleteSchedule($id: BigInteger, $connectionId: BigInteger) {
    deleteSchedule(id: $id, connectionId: $connectionId)
  }
`;

export const useDeleteSchedule = (): UseMutationResult<
  boolean,
  Error,
  { id: number; connectionId: number }
> => {
  const { graphql } = useContext(ServiceContext);
  const invalidate = useInvalidateSchedules();
  return useMutation({
    mutationFn: ({ id, connectionId }) =>
      graphql
        .query<{ deleteSchedule: boolean }>(DELETE, { id, connectionId })
        .then((answer) => answer.deleteSchedule),
    onSuccess: invalidate,
  });
};

const RUN_NOW = `
  mutation RunSchedule($id: BigInteger, $connectionId: BigInteger) {
    runSchedule(id: $id, connectionId: $connectionId) {
      id
      outcome
      detail
    }
  }
`;

export const useRunNow = (): UseMutationResult<
  JobRunSummary,
  Error,
  { id: number; connectionId: number }
> => {
  const { graphql } = useContext(ServiceContext);
  const invalidate = useInvalidateSchedules();
  return useMutation({
    mutationFn: ({ id, connectionId }) =>
      graphql
        .query<{ runSchedule: JobRunSummary }>(RUN_NOW, { id, connectionId })
        .then((answer) => answer.runSchedule),
    onSuccess: invalidate,
  });
};
