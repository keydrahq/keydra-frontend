import type { FC } from 'react';
import { Label, Timestamp } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { useJobRuns } from './queries';
import { RunOutcome } from './types';

const colorOf = (outcome: RunOutcome) => {
  switch (outcome) {
    case RunOutcome.Done:
      return 'green' as const;
    case RunOutcome.Failed:
      return 'red' as const;
    case RunOutcome.Refused:
      return 'orange' as const;
    // Amber rather than red: nothing failed and nothing was refused — the instance running it
    // stopped, which is a fact about the deployment rather than about the job.
    case RunOutcome.Interrupted:
      return 'orange' as const;
    default:
      return 'blue' as const;
  }
};

export interface JobRunsProps {
  jobId: number;
}

/**
 * What one schedule has done.
 *
 * <p>Newest first, and every attempt including the ones that were never made: a run refused because
 * whoever arranged it lost the access is not a failure, and reading it as one sends somebody
 * looking for a bug instead of for a grant.
 *
 * <p>"By hand" is marked, so a history can tell a run somebody asked for from one the clock did —
 * which is the first thing to check when a schedule appears to have run at a time it should not
 * have.
 */
export const JobRuns: FC<JobRunsProps> = ({ jobId }) => {
  const { t } = useTranslation();
  const runs = useJobRuns(jobId);

  if (runs.isPending) {
    return <LoadingView />;
  }
  if (runs.isError) {
    return <ErrorView title={t('Schedules.RUNS_FAILED')} message={runs.error.message} />;
  }
  if (runs.data.length === 0) {
    return <>{t('Schedules.NO_RUNS')}</>;
  }

  return (
    <Table aria-label={t('Schedules.RUNS')} variant="compact" borders={false}>
      <Thead>
        <Tr>
          <Th width={20}>{t('Schedules.STARTED')}</Th>
          <Th width={15}>{t('Schedules.TOOK')}</Th>
          <Th width={15}>{t('Schedules.OUTCOME')}</Th>
          <Th>{t('Schedules.DETAIL')}</Th>
        </Tr>
      </Thead>
      <Tbody>
        {runs.data.map((run) => (
          <Tr key={run.id}>
            <Td dataLabel={t('Schedules.STARTED')}>
              <Timestamp date={new Date(run.startedAt)} dateFormat="short" timeFormat="medium" />
              {run.wasManual && (
                <Label isCompact variant="outline">
                  {t('Schedules.BY_HAND')}
                </Label>
              )}
            </Td>
            <Td dataLabel={t('Schedules.TOOK')}>
              {run.finishedAt
                ? t('Schedules.SECONDS', {
                    count: Math.max(
                      0,
                      Math.round(
                        (new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) /
                          1000,
                      ),
                    ),
                  })
                : '—'}
            </Td>
            <Td dataLabel={t('Schedules.OUTCOME')}>
              <Label isCompact color={colorOf(run.outcome)}>
                {t(`Schedules.OUTCOME_${run.outcome}` as 'Schedules.OUTCOME_DONE')}
              </Label>
            </Td>
            <Td dataLabel={t('Schedules.DETAIL')}>{run.detail ?? '—'}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};
