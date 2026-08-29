import { useContext, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { NotificationCategory } from '@app/Shared/Services/api.types';
import { ServiceContext } from '@app/Shared/Services/Services';
import type { MigrationJob } from '@app/KeyBrowser/types';

/** Enough of a target to name it in a row. */
export interface TargetName {
  id: number;
  name: string;
}

/**
 * What the table draws for each job.
 *
 * <p>The two targets arrive as targets rather than as numbers, which is the whole point of asking
 * the graph: the page used to fetch the entire connection catalogue alongside the rows and join
 * them by hand. Null when the target has been deleted since, or when this caller cannot see it —
 * the row still exists, and saying so with a name it is not allowed to know would be a leak.
 */
export type MigrationRow = Pick<
  MigrationJob,
  | 'id'
  | 'total'
  | 'scanned'
  | 'migrated'
  | 'skipped'
  | 'failed'
  | 'reason'
  | 'state'
  | 'startedAt'
  | 'startedBy'
  | 'resumed'
> & {
  source: TargetName | null;
  target: TargetName | null;
};

/** Where a page sits in the list, as the server describes it. */
export interface PageInfo {
  endCursor: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** Everything this page needs, which is what it asks for. */
export interface MigrationsPage {
  migrations: {
    totalCount: number;
    running: number;
    nodes: MigrationRow[];
    pageInfo: PageInfo;
  };
}

/**
 * One question for the whole page.
 *
 * <p>This is what the second surface is for. The page used to make two requests to draw one table:
 * the jobs, and then the whole connection catalogue so a row could say "payments-cache" instead of
 * "3". Two round trips, and the second one answered with the host, port, TLS flag, status and
 * server version of every target so the page could read two fields of each.
 *
 * <p>The fields are named beside the types above, so the two cannot drift: a column added to the
 * table and not to the query arrives undefined, and a field asked for and drawn nowhere is bytes
 * nobody reads.
 */
const PAGE = `
  query MigrationsPage(
    $first: Int!
    $after: String
    $search: String
    $state: State
    $sort: MigrationSort
    $descending: Boolean
  ) {
    migrations(
      first: $first
      after: $after
      search: $search
      state: $state
      sort: $sort
      descending: $descending
    ) {
      totalCount
      running
      nodes {
        id
        total
        scanned
        migrated
        skipped
        failed
        reason
        state
        startedAt
        startedBy
        resumed
        source {
          id
          name
        }
        target {
          id
          name
        }
      }
      pageInfo {
        endCursor
        hasNextPage
        hasPreviousPage
      }
    }
  }
`;

const QUERY_KEY = ['migrations-page'] as const;

/**
 * The page's data, asked once and then kept current by what the server pushes.
 *
 * <p>A running migration already broadcasts its counters on the hub — that is what the dialog
 * watching one reads — so this page has the same numbers arriving without asking again. It used to
 * poll every two seconds, which meant a page nobody was looking at was a request every two seconds
 * for a list that had not changed.
 */
/** How a page is narrowed and ordered, all of it settled on the server. */
export interface MigrationsQuery {
  first: number;
  /** Where to resume, or undefined for the newest page. */
  after?: string;
  /** Text matched against either target's name, on the server. */
  search?: string;
  state?: string;
  sort: 'SOURCE' | 'TARGET' | 'STARTED' | 'STATE';
  descending: boolean;
}

export const useMigrationsPage = (
  request: MigrationsQuery,
): UseQueryResult<MigrationsPage, Error> => {
  const { graphql, notifications } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  const key = [...QUERY_KEY, request] as const;

  useEffect(
    () =>
      notifications.subscribe<MigrationRow>(NotificationCategory.MigrationProgress, ({ payload }) =>
        queryClient.setQueryData<MigrationsPage>(key, (current) => {
          if (!current) {
            return current;
          }
          // The broadcast carries the whole job, so a row already on this page is replaced
          // rather than refetched. One nobody has seen is left alone now that the server cuts
          // the pages: pushing it onto the front would make a page of twenty hold twenty-one,
          // and put a row here that belongs on whichever page its date puts it on.
          const known = current.migrations.nodes.some((job) => job.id === payload.id);
          if (!known) {
            return current;
          }
          return {
            ...current,
            migrations: {
              ...current.migrations,
              nodes: current.migrations.nodes.map((job) =>
                job.id === payload.id ? { ...job, ...payload } : job,
              ),
            },
          };
        }),
      ),
    // `key` is rebuilt every render, so its contents rather than its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notifications, queryClient, request],
  );

  return useQuery({
    queryKey: key,
    queryFn: () =>
      graphql.query<MigrationsPage>(PAGE, {
        first: request.first,
        after: request.after ?? null,
        search: request.search ?? null,
        state: request.state ?? null,
        sort: request.sort,
        descending: request.descending,
      }),
    // The page already on screen stays while the next one loads, so paging does not blink.
    placeholderData: (previous) => previous,
  });
};
