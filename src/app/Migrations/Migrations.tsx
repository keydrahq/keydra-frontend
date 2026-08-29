import type { FC } from 'react';
import { useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  Content,
  ContentVariants,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  FormSelect,
  FormSelectOption,
  Label,
  PageSection,
  Pagination,
  Progress,
  ProgressMeasureLocation,
  ProgressVariant,
  SearchInput,
  Timestamp,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Tooltip,
} from '@patternfly/react-core';
import { ExchangeAltIcon, SearchIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { ThProps } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { PageHeader } from '@app/Shared/Components/PageHeader';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import { useMigrationsPage } from './queries';
import type { MigrationRow } from './queries';
import { useCursorPages } from '@app/Shared/Components/useCursorPages';

/**
 * The states a job can be in, in the order somebody looks for them.
 *
 * <p>Written out rather than collected from what happens to be on the page: a filter whose
 * options come from the rows cannot offer "failed" on the day nothing has failed, which is the
 * day somebody most wants to ask.
 */
const STATES = ['RUNNING', 'DONE', 'INTERRUPTED', 'FAILED', 'CANCELLED'] as const;

/** What a job's state means for the bar that shows it. */
/** Everything the job has dealt with, whichever way it went. */
const handledBy = (job: MigrationRow): number => job.migrated + job.skipped + job.failed;

/**
 * How far along a job is, on the same terms the migration dialog uses.
 *
 * <p>The two were measuring different things and reporting different numbers for one job, which is
 * the sort of disagreement that makes somebody distrust both. This is the dialog's rule: the share
 * of the expected total that has been dealt with, and a full bar for a walk that reached the end
 * whatever the total turned out to be — the total is a reading of the keyspace taken as the job
 * started, and a keyspace does not hold still while it is being read.
 */
const percentOf = (job: MigrationRow): number => {
  if (job.state === 'DONE') {
    return 100;
  }
  if (!job.total) {
    return job.state === 'RUNNING' ? 0 : 100;
  }
  return Math.min(100, Math.round((handledBy(job) / job.total) * 100));
};

/** What the bar says, or what stands in for it where there is no bar. */
const labelFor = (t: TFunction, job: MigrationRow): string =>
  !job.total || job.state === 'DONE'
    ? t('Migrations.MOVED_DONE', { handled: handledBy(job) })
    : t('Migrations.MOVED', { handled: handledBy(job), total: job.total });

const variantOf = (state: string): ProgressVariant | undefined => {
  switch (state) {
    case 'DONE':
      return ProgressVariant.success;
    case 'FAILED':
      return ProgressVariant.danger;
    case 'CANCELLED':
    case 'INTERRUPTED':
      return ProgressVariant.warning;
    default:
      return undefined;
  }
};

const colorOf = (state: string) => {
  switch (state) {
    case 'RUNNING':
      return 'blue' as const;
    case 'DONE':
      return 'green' as const;
    case 'FAILED':
      return 'red' as const;
    default:
      return 'orange' as const;
  }
};

/**
 * Every migration, whichever target started it.
 *
 * <p>A migration is between two targets, so a list kept under one of them is a list somebody has to
 * already know where to look for. This is the page that answers "what is moving right now", which
 * is a question asked without knowing where to look.
 *
 * <p>Refreshed on a timer rather than over the notification hub: the hub carries a job's progress
 * to whoever opened its dialog, and a page listing every job wants the whole set rather than the
 * events of one.
 */
export const Migrations: FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('Migrations.TITLE'));

  const [search, setSearch] = useState('');
  const [state, setState] = useState<string>('');
  const [perPage, setPerPage] = useState(20);
  /** Newest first by default: the question a list of jobs is opened with is "what just happened". */
  const [sortBy, setSortBy] = useState<{ index: number; direction: 'asc' | 'desc' }>({
    index: 2,
    direction: 'desc',
  });

  const COLUMN_SORTS = ['SOURCE', 'TARGET', 'STARTED', 'STATE'] as const;

  const pages = useCursorPages();

  // Every narrowing is the server's: the search matches a target's name there, where all of them
  // are, rather than against the handful of rows this browser happens to be holding.
  const pageData = useMigrationsPage({
    first: perPage,
    after: pages.after,
    search: search.trim() === '' ? undefined : search.trim(),
    state: state === '' ? undefined : state,
    sort: COLUMN_SORTS[sortBy.index] ?? 'STARTED',
    descending: sortBy.direction === 'desc',
  });

  const visible = pageData.data?.migrations.nodes ?? [];
  const total = pageData.data?.migrations.totalCount ?? 0;
  const where = pageData.data?.migrations.pageInfo;
  // Counted on the server, over every page: a summary adding up the twenty rows on screen would
  // say "20 migrations" however many there were.
  const running = pageData.data?.migrations.running ?? 0;

  /** A target's name, or a dash when it has been deleted or is not this caller's to see. */
  const nameOf = (target: { name: string } | null): string => target?.name ?? '—';

  /**
   * Narrowing or reordering returns to the newest page.
   *
   * <p>A cursor is a position in one particular list, ordered one particular way. Carrying it into
   * a differently sorted list would resume from a row that is not there, so the server refuses it.
   */
  const narrow = (change: () => void) => {
    change();
    pages.first();
  };

  const sortFor = (index: number): ThProps['sort'] => ({
    sortBy: { index: sortBy.index, direction: sortBy.direction },
    onSort: (_event, columnIndex, direction) =>
      narrow(() => setSortBy({ index: columnIndex, direction })),
    columnIndex: index,
  });

  const paging = (variant: 'top' | 'bottom') => (
    <Pagination
      itemCount={total}
      page={pages.page}
      perPage={perPage}
      variant={variant}
      isCompact
      // Forward and back and nowhere else: a cursor names a row, and page seven has no name
      // until pages one to six have been read. That is the trade a list that grows at the front
      // asks for, and offering a jump that landed elsewhere would be worse than not offering one.
      // The arrows enable themselves from the count and the page number, which is what
      // PatternFly does with them — there are no props to override that, and no need: the total
      // is exact, so "there is a next page" and "the count says so" agree.
      onNextClick={() => pages.forward(where?.endCursor ?? null)}
      onPreviousClick={() => pages.back()}
      onPerPageSelect={(_event, next) => narrow(() => setPerPage(next))}
      titles={{ paginationAriaLabel: t('Migrations.PAGINATION') }}
    />
  );

  if (pageData.isPending) {
    return <LoadingView />;
  }
  if (pageData.isError) {
    return (
      <PageSection>
        <ErrorView
          title={t('Migrations.LOAD_ERROR')}
          failure={pageData.error}
          onRetry={() => void pageData.refetch()}
        />
      </PageSection>
    );
  }

  return (
    <>
      <PageHeader
        title={t('Migrations.TITLE')}
        description={
          total === 0
            ? t('Migrations.DESCRIPTION')
            : t('Migrations.SUMMARY', { count: total, running })
        }
      />
      <PageSection isFilled>
        <Card isCompact>
          <CardBody>
            {total === 0 ? (
              <EmptyState
                titleText={t('Migrations.EMPTY_TITLE')}
                icon={ExchangeAltIcon}
                headingLevel="h2"
              >
                <EmptyStateBody>{t('Migrations.EMPTY_BODY')}</EmptyStateBody>
              </EmptyState>
            ) : (
              <>
                <Toolbar id="migrations-toolbar" inset={{ default: 'insetNone' }}>
                  <ToolbarContent alignItems="center">
                    <ToolbarItem>
                      <SearchInput
                        aria-label={t('Migrations.SEARCH')}
                        placeholder={t('Migrations.SEARCH')}
                        value={search}
                        onChange={(_event, value) => narrow(() => setSearch(value))}
                        onClear={() => narrow(() => setSearch(''))}
                      />
                    </ToolbarItem>
                    <ToolbarItem>
                      <FormSelect
                        value={state}
                        aria-label={t('Migrations.FILTER_STATE')}
                        onChange={(_event, value) => narrow(() => setState(value))}
                      >
                        <FormSelectOption value="" label={t('Migrations.ALL_STATES')} />
                        {STATES.map((option) => (
                          <FormSelectOption
                            key={option}
                            value={option}
                            label={t(`Migrations.STATE_${option}` as 'Migrations.STATE_RUNNING')}
                          />
                        ))}
                      </FormSelect>
                    </ToolbarItem>
                    <ToolbarItem align={{ default: 'alignEnd' }}>{paging('top')}</ToolbarItem>
                  </ToolbarContent>
                </Toolbar>

                {visible.length === 0 ? (
                  <EmptyState
                    titleText={t('Migrations.NO_MATCHES')}
                    icon={SearchIcon}
                    headingLevel="h2"
                    variant="sm"
                  >
                    <EmptyStateBody>{t('Migrations.NO_MATCHES_BODY')}</EmptyStateBody>
                    <EmptyStateFooter>
                      <EmptyStateActions>
                        <Button
                          variant="link"
                          onClick={() =>
                            narrow(() => {
                              setSearch('');
                              setState('');
                            })
                          }
                        >
                          {t('Migrations.CLEAR_FILTERS')}
                        </Button>
                      </EmptyStateActions>
                    </EmptyStateFooter>
                  </EmptyState>
                ) : (
                  <Table aria-label={t('Migrations.TABLE')} variant="compact">
                    <Thead>
                      <Tr>
                        <Th width={15} sort={sortFor(0)}>
                          {t('Migrations.FROM')}
                        </Th>
                        <Th width={15} sort={sortFor(1)}>
                          {t('Migrations.TO')}
                        </Th>
                        <Th width={15} sort={sortFor(2)}>
                          {t('Migrations.WHEN')}
                        </Th>
                        <Th width={10} sort={sortFor(3)}>
                          {t('Migrations.STATE')}
                        </Th>
                        <Th width={25}>{t('Migrations.PROGRESS')}</Th>
                        <Th>{t('Migrations.OUTCOME')}</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {visible.map((job) => (
                        <Tr key={job.id}>
                          <Td dataLabel={t('Migrations.FROM')}>{nameOf(job.source)}</Td>
                          <Td dataLabel={t('Migrations.TO')}>{nameOf(job.target)}</Td>
                          <Td dataLabel={t('Migrations.WHEN')}>
                            {job.startedBy ? (
                              <Tooltip content={t('Migrations.STARTED_BY', { who: job.startedBy })}>
                                <Timestamp date={new Date(job.startedAt)} dateFormat="short" />
                              </Tooltip>
                            ) : (
                              <Timestamp date={new Date(job.startedAt)} dateFormat="short" />
                            )}
                          </Td>
                          <Td dataLabel={t('Migrations.STATE')}>
                            {job.state === 'INTERRUPTED' ? (
                              <Tooltip content={t('Migrations.INTERRUPTED_HINT')}>
                                <Label isCompact color={colorOf(job.state)}>
                                  {t('Migrations.STATE_INTERRUPTED')}
                                </Label>
                              </Tooltip>
                            ) : (
                              <Label isCompact color={colorOf(job.state)}>
                                {t(`Migrations.STATE_${job.state}` as 'Migrations.STATE_RUNNING')}
                              </Label>
                            )}
                            {/* Beside the state rather than instead of it: a job that changed
                                hands is still running, done or failed, and the handover is the
                                thing that explains why its counters are lower than somebody
                                remembers. Only when it happened, which is almost never. */}
                            {job.resumed > 0 ? (
                              <>
                                {' '}
                                <Tooltip
                                  content={t('Migrations.RESUMED_HINT', { count: job.resumed })}
                                >
                                  <Label isCompact variant="outline">
                                    {t('Migrations.RESUMED', { count: job.resumed })}
                                  </Label>
                                </Tooltip>
                              </>
                            ) : null}
                          </Td>
                          <Td dataLabel={t('Migrations.PROGRESS')}>
                            {/* Without a denominator there is no bar to draw, only a count — a
                                glob's size is not knowable until the walk that answers it has
                                ended. Drawing one anyway is what this cell used to do, against
                                what the walk had found so far: on a job that ran to the end,
                                every key already on the target came off the top of a bar that
                                was measuring nothing, so a migration that did exactly what was
                                asked of it sat at 93 per cent under a green tick. What those
                                keys were is the next column's job, and it says so. */}
                            {job.total ? (
                              <Progress
                                title=""
                                value={percentOf(job)}
                                label={labelFor(t, job)}
                                measureLocation={ProgressMeasureLocation.outside}
                                variant={variantOf(job.state)}
                                aria-label={t('Migrations.PROGRESS')}
                              />
                            ) : (
                              <Content component={ContentVariants.small}>
                                {labelFor(t, job)}
                              </Content>
                            )}
                          </Td>
                          <Td dataLabel={t('Migrations.OUTCOME')}>
                            {job.reason ??
                              t('Migrations.TALLY', {
                                skipped: job.skipped,
                                failed: job.failed,
                              })}
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                )}

                {total > perPage ? paging('bottom') : null}
              </>
            )}
          </CardBody>
        </Card>
      </PageSection>
    </>
  );
};
