import type { FC } from 'react';
import { useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import {
  Button,
  Card,
  CardBody,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  Label,
  PageSection,
  SearchInput,
  Switch,
  Timestamp,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Tooltip,
} from '@patternfly/react-core';
import { FormSelect, FormSelectOption } from '@patternfly/react-core';
import { OutlinedClockIcon, PlusCircleIcon } from '@patternfly/react-icons';
import {
  ActionsColumn,
  ExpandableRowContent,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { Permission, usePermissionCheck } from '@app/Login/queries';
import { ConfirmDialog } from '@app/Shared/Components/ConfirmDialog';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { PageHeader } from '@app/Shared/Components/PageHeader';
import { useNotifications } from '@app/Shared/Components/notificationStore';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import { JobRuns } from './JobRuns';
import { ScheduleDialog } from './ScheduleDialog';
import { fromCron } from './cron';
import {
  useDeleteSchedule,
  useRunNow,
  useSaveSchedule,
  useScheduleTargets,
  useSchedulesPage,
} from './queries';
import { parseSettings } from './settings';
import { JobType, RunOutcome } from './types';
import type { ScheduleSummary } from './types';
import { useScheduleFailures } from './useScheduleFailures';

const outcomeColor = (outcome: RunOutcome | null) => {
  switch (outcome) {
    case RunOutcome.Done:
      return 'green' as const;
    case RunOutcome.Failed:
      return 'red' as const;
    case RunOutcome.Refused:
    case RunOutcome.Interrupted:
      return 'orange' as const;
    case RunOutcome.Running:
      return 'blue' as const;
    default:
      return 'grey' as const;
  }
};

/**
 * Work arranged to happen on its own.
 *
 * <p>The page answers three questions in the order somebody opens it with: what is arranged, when
 * does it next happen, and did the last one work. Everything else — which keys, which second
 * target — is one row expansion away, because a table wide enough to hold every job type's settings
 * would be a table nobody can read across.
 *
 * <p>The list refreshes on its own, since two of its columns move without anybody touching the page.
 * A failure does not wait for that: it arrives over the notification hub, which is the difference
 * between finding out and finding the cache empty.
 */
export const Schedules: FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('Schedules.TITLE'));
  useScheduleFailures();

  const page = useSchedulesPage();
  // From the same answer as the schedules: one request, not two.
  const connections = useScheduleTargets();
  const save = useSaveSchedule();
  const remove = useDeleteSchedule();
  const runNow = useRunNow();
  const holds = usePermissionCheck();
  const { notify } = useNotifications();

  const [search, setSearch] = useState('');
  const [ofType, setOfType] = useState<JobType | ''>('');
  const [editing, setEditing] = useState<ScheduleSummary | 'new' | undefined>();
  const [removing, setRemoving] = useState<ScheduleSummary | undefined>();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (page.data?.schedules ?? []).filter(
      (schedule) =>
        (ofType === '' || schedule.jobType === ofType) &&
        (needle === '' ||
          schedule.name.toLowerCase().includes(needle) ||
          (schedule.connectionName ?? '').toLowerCase().includes(needle)),
    );
  }, [page.data?.schedules, search, ofType]);

  /**
   * Whether there is any target this person could arrange work on.
   *
   * <p>Asked of the targets rather than of the existing schedules: somebody who may arrange
   * something and has not yet is exactly the person the button is for, and reading it off the
   * list would hide it from them until somebody else had gone first.
   */
  const mayArrange = (connections.data ?? []).some((profile) =>
    holds(Permission.ScheduleManage, profile.id),
  );

  const toggle = (schedule: ScheduleSummary, enabled: boolean) =>
    save.mutate({
      id: schedule.id,
      request: {
        name: schedule.name,
        connectionId: schedule.connectionId,
        jobType: schedule.jobType,
        cron: schedule.cron,
        enabled,
        settings: schedule.settings ?? undefined,
      },
    });

  const run = (schedule: ScheduleSummary) =>
    runNow.mutate(
      { id: schedule.id, connectionId: schedule.connectionId },
      {
        onSuccess: (result) =>
          notify({
            title: t('Schedules.RAN', { name: schedule.name }),
            description: result.detail ?? undefined,
            variant: result.outcome === RunOutcome.Failed ? 'danger' : 'success',
          }),
        onError: (error) =>
          notify({
            title: t('Schedules.RUN_FAILED', { name: schedule.name }),
            description: error.message,
            variant: 'danger',
          }),
      },
    );

  if (page.isPending) {
    return <LoadingView />;
  }
  if (page.isError) {
    return (
      <PageSection>
        <ErrorView title={t('Schedules.LOAD_ERROR')} message={page.error.message} />
      </PageSection>
    );
  }

  const all = page.data?.schedules ?? [];
  const due = all.filter((schedule) => schedule.enabled).length;
  const broken = all.filter((schedule) => schedule.lastOutcome === RunOutcome.Failed).length;

  return (
    <>
      <PageHeader
        title={t('Schedules.TITLE')}
        description={
          all.length === 0
            ? t('Schedules.DESCRIPTION')
            : t('Schedules.SUMMARY', { count: all.length, due })
        }
        badges={
          broken > 0 ? (
            <Label isCompact color="red">
              {t('Schedules.BROKEN', { count: broken })}
            </Label>
          ) : null
        }
        actions={
          all.length > 0 && mayArrange ? (
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => setEditing('new')}>
              {t('Schedules.ADD')}
            </Button>
          ) : null
        }
      />

      <PageSection isFilled>
        <Card isCompact>
          <CardBody>
            {all.length === 0 ? (
              <EmptyState
                titleText={t('Schedules.EMPTY_TITLE')}
                icon={OutlinedClockIcon}
                headingLevel="h2"
              >
                <EmptyStateBody>
                  {mayArrange ? t('Schedules.EMPTY_BODY') : t('Schedules.EMPTY_UNPRIVILEGED')}
                </EmptyStateBody>
                {mayArrange && (
                  <EmptyStateFooter>
                    <EmptyStateActions>
                      <Button
                        variant="primary"
                        icon={<PlusCircleIcon />}
                        onClick={() => setEditing('new')}
                      >
                        {t('Schedules.ADD')}
                      </Button>
                    </EmptyStateActions>
                  </EmptyStateFooter>
                )}
              </EmptyState>
            ) : (
              <>
                <Toolbar id="schedules-toolbar" inset={{ default: 'insetNone' }}>
                  <ToolbarContent alignItems="center">
                    <ToolbarItem>
                      <SearchInput
                        aria-label={t('Schedules.SEARCH')}
                        placeholder={t('Schedules.SEARCH')}
                        value={search}
                        onChange={(_event, value) => setSearch(value)}
                        onClear={() => setSearch('')}
                      />
                    </ToolbarItem>
                    <ToolbarItem>
                      <FormSelect
                        value={ofType}
                        aria-label={t('Schedules.FILTER_TYPE')}
                        onChange={(_event, value) => setOfType(value as JobType | '')}
                      >
                        <FormSelectOption value="" label={t('Schedules.ALL_TYPES')} />
                        {Object.values(JobType).map((type) => (
                          <FormSelectOption
                            key={type}
                            value={type}
                            label={t(`Schedules.JOB_${type}` as 'Schedules.JOB_FLUSH_DATABASE')}
                          />
                        ))}
                      </FormSelect>
                    </ToolbarItem>
                  </ToolbarContent>
                </Toolbar>

                <Table aria-label={t('Schedules.TITLE')} variant="compact">
                  <Thead>
                    <Tr>
                      <Th screenReaderText={t('Schedules.DETAILS')} />
                      <Th width={20}>{t('Schedules.NAME')}</Th>
                      <Th width={15}>{t('Schedules.WHAT')}</Th>
                      <Th width={15}>{t('Schedules.TARGET')}</Th>
                      <Th width={15}>{t('Schedules.WHEN')}</Th>
                      <Th width={15}>{t('Schedules.NEXT_RUN')}</Th>
                      <Th width={15}>{t('Schedules.LAST_RUN')}</Th>
                      <Th screenReaderText={t('Schedules.ACTIONS')} />
                    </Tr>
                  </Thead>
                  {shown.map((schedule, index) => {
                    const isExpanded = expanded.has(schedule.id);
                    const mayManage = holds(Permission.ScheduleManage, schedule.connectionId);
                    return (
                      <Tbody key={schedule.id} isExpanded={isExpanded}>
                        <Tr>
                          <Td
                            expand={{
                              rowIndex: index,
                              isExpanded,
                              onToggle: () =>
                                setExpanded((held) => {
                                  const next = new Set(held);
                                  if (!next.delete(schedule.id)) {
                                    next.add(schedule.id);
                                  }
                                  return next;
                                }),
                            }}
                          />
                          <Td dataLabel={t('Schedules.NAME')}>{schedule.name}</Td>
                          <Td dataLabel={t('Schedules.WHAT')}>
                            <Label isCompact variant="outline">
                              {t(
                                `Schedules.JOB_${schedule.jobType}` as 'Schedules.JOB_FLUSH_DATABASE',
                              )}
                            </Label>
                          </Td>
                          <Td dataLabel={t('Schedules.TARGET')}>
                            {schedule.connectionName ?? String(schedule.connectionId)}
                          </Td>
                          <Td dataLabel={t('Schedules.WHEN')}>
                            <Tooltip content={<code>{schedule.cron}</code>}>
                              <span>{describeCadence(schedule.cron, t)}</span>
                            </Tooltip>
                          </Td>
                          <Td dataLabel={t('Schedules.NEXT_RUN')}>
                            {schedule.enabled && schedule.nextRunAt ? (
                              <Timestamp
                                date={new Date(schedule.nextRunAt)}
                                dateFormat="short"
                                timeFormat="short"
                              />
                            ) : (
                              <Label isCompact color="grey">
                                {t('Schedules.PAUSED')}
                              </Label>
                            )}
                          </Td>
                          <Td dataLabel={t('Schedules.LAST_RUN')}>
                            {schedule.lastRunAt ? (
                              <Label isCompact color={outcomeColor(schedule.lastOutcome)}>
                                {t(
                                  `Schedules.OUTCOME_${schedule.lastOutcome}` as 'Schedules.OUTCOME_DONE',
                                )}
                              </Label>
                            ) : (
                              t('Schedules.NEVER')
                            )}
                          </Td>
                          <Td isActionCell>
                            <ActionsColumn
                              items={[
                                {
                                  title: t('Schedules.RUN_NOW'),
                                  isDisabled: !mayManage || runNow.isPending,
                                  onClick: () => run(schedule),
                                },
                                {
                                  title: schedule.enabled
                                    ? t('Schedules.PAUSE')
                                    : t('Schedules.RESUME'),
                                  isDisabled: !mayManage,
                                  onClick: () => toggle(schedule, !schedule.enabled),
                                },
                                { isSeparator: true },
                                {
                                  title: t('Schedules.EDIT'),
                                  isDisabled: !mayManage,
                                  onClick: () => setEditing(schedule),
                                },
                                {
                                  title: t('Schedules.REMOVE'),
                                  isDanger: true,
                                  isDisabled: !mayManage,
                                  onClick: () => setRemoving(schedule),
                                },
                              ]}
                            />
                          </Td>
                        </Tr>
                        <Tr isExpanded={isExpanded}>
                          <Td />
                          <Td colSpan={7}>
                            <ExpandableRowContent>
                              <Toolbar
                                id={`schedule-${schedule.id}-detail`}
                                inset={{ default: 'insetNone' }}
                              >
                                <ToolbarContent alignItems="center">
                                  <ToolbarItem>
                                    <Switch
                                      id={`schedule-${schedule.id}-enabled`}
                                      label={t('Schedules.ENABLED')}
                                      isChecked={schedule.enabled}
                                      isDisabled={!mayManage || save.isPending}
                                      onChange={(_event, checked) => toggle(schedule, checked)}
                                    />
                                  </ToolbarItem>
                                  <ToolbarItem>{describeSettings(schedule, t)}</ToolbarItem>
                                </ToolbarContent>
                              </Toolbar>
                              <JobRuns jobId={schedule.id} />
                            </ExpandableRowContent>
                          </Td>
                        </Tr>
                      </Tbody>
                    );
                  })}
                </Table>
                {shown.length === 0 && (
                  <EmptyState
                    titleText={t('Schedules.NO_MATCH')}
                    icon={OutlinedClockIcon}
                    headingLevel="h3"
                  >
                    <EmptyStateBody>{t('Schedules.NO_MATCH_BODY')}</EmptyStateBody>
                  </EmptyState>
                )}
              </>
            )}
          </CardBody>
        </Card>
      </PageSection>

      {editing && (
        <ScheduleDialog
          schedule={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
        />
      )}

      {removing && (
        <ConfirmDialog
          isOpen
          title={t('Schedules.REMOVE_TITLE')}
          confirmLabel={t('Schedules.REMOVE')}
          isDestructive
          isBusy={remove.isPending}
          onConfirm={() => {
            remove.mutate({ id: removing.id, connectionId: removing.connectionId });
            setRemoving(undefined);
          }}
          onCancel={() => setRemoving(undefined)}
        >
          {t('Schedules.REMOVE_BODY', { name: removing.name })}
        </ConfirmDialog>
      )}
    </>
  );
};

type Translate = TFunction<'public'>;

/** The cadence in words, falling back to the expression for anything the form cannot draw. */
const describeCadence = (cron: string, t: Translate): string => {
  const cadence = fromCron(cron);
  switch (cadence.every) {
    case 'minutes':
      return t('Schedules.SAYS_MINUTES', { count: cadence.interval });
    case 'hourly':
      return t('Schedules.SAYS_HOURLY', { minute: String(cadence.minute).padStart(2, '0') });
    case 'daily':
      return t('Schedules.SAYS_DAILY', { time: cadence.time });
    case 'weekly':
      return t('Schedules.SAYS_WEEKLY', {
        day: t(`Schedules.DAY_${cadence.weekday}` as 'Schedules.DAY_0'),
        time: cadence.time,
      });
    case 'monthly':
      return t('Schedules.SAYS_MONTHLY', { day: cadence.day, time: cadence.time });
    default:
      return cron;
  }
};

/** What the job will actually do, in one line, out of the settings only its own kind reads. */
const describeSettings = (schedule: ScheduleSummary, t: Translate): string => {
  const settings = parseSettings(schedule.settings);
  const match = settings.match ?? '*';
  switch (schedule.jobType) {
    case JobType.FlushDatabase:
      return t('Schedules.SAYS_FLUSH', {
        match,
        database: settings.database ?? t('Schedules.DEFAULT_DATABASE'),
      });
    case JobType.CopyKeys: {
      const says = t('Schedules.SAYS_COPY', {
        match,
        target: settings.targetConnectionId ?? '?',
        mode: settings.deleteFromSource ? t('Schedules.SAYS_MOVING') : t('Schedules.SAYS_COPYING'),
      });
      /*
       * A shaped copy says so here. The line is the only thing most people read about a schedule,
       * and one that renames keys as it moves them, or drops some of them, is not the same
       * arrangement as one that moves what it finds — the script most of all, because a schedule
       * that runs code is the one worth noticing in a list.
       */
      if (settings.script) {
        return t('Schedules.SAYS_WITH_SCRIPT', { says });
      }
      const shaped =
        settings.type || settings.stripPrefix || settings.addPrefix || settings.maxKeysPerSecond;
      return shaped ? t('Schedules.SAYS_SHAPED', { says }) : says;
    }
    default:
      return t('Schedules.SAYS_EXPORT', { match, prefix: settings.filePrefix ?? 'export' });
  }
};
