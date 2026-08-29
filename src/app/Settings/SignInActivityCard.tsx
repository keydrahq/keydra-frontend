import type { FC } from 'react';
import { useState } from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  Content,
  Label,
  LabelGroup,
  Pagination,
  Spinner,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import {
  anomalyLabel,
  anomalySeverity,
  countryLabel,
  describeAgent,
  outcomeLabel,
  whenLocal,
} from '@app/Shared/Components/signInLabels';
import { useMySignIns } from './signInQueries';

/**
 * Your own recent sign-ins.
 *
 * <p>Beside the sessions and for the same reason: both are yours, both answer the same question,
 * and neither is anybody else's to read. Sessions say which browsers can act as you right now;
 * this says how each of them got there, including the attempts that did not.
 *
 * <p>Every row is expected to be dull. The one worth finding is the one that is not — a sign-in
 * from somewhere you have never been, or a run of wrong passwords you did not type — so what is
 * unusual about a row is a label on the row rather than a column somebody has to scan.
 */
export const SignInActivityCard: FC = () => {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const activity = useMySignIns(perPage, (page - 1) * perPage);

  return (
    <Card>
      <CardTitle>{t('SignIns.MINE_TITLE')}</CardTitle>
      <CardBody>
        <Stack hasGutter>
          <StackItem>
            <Content component="p">{t('SignIns.MINE_INTRO')}</Content>
          </StackItem>

          {activity.isLoading && (
            <StackItem>
              <Spinner size="lg" aria-label={t('SignIns.LOADING')} />
            </StackItem>
          )}

          {activity.isError && (
            <StackItem>
              <ErrorView
                title={t('SignIns.LOAD_ERROR')}
                failure={activity.error}
                onRetry={() => void activity.refetch()}
              />
            </StackItem>
          )}

          {activity.data && activity.data.mySignIns.length === 0 && (
            <StackItem>
              <Content component="p">{t('SignIns.MINE_EMPTY')}</Content>
            </StackItem>
          )}

          {activity.data && activity.data.mySignIns.length > 0 && (
            <>
              <StackItem>
                <Table variant="compact" aria-label={t('SignIns.MINE_TITLE')}>
                  <Thead>
                    <Tr>
                      <Th>{t('SignIns.WHEN')}</Th>
                      <Th>{t('SignIns.OUTCOME_HEADING')}</Th>
                      <Th>{t('SignIns.WHERE')}</Th>
                      <Th>{t('SignIns.DEVICE')}</Th>
                      <Th>{t('SignIns.NOTICED')}</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {activity.data.mySignIns.map((row) => (
                      <Tr key={row.id}>
                        <Td dataLabel={t('SignIns.WHEN')}>{whenLocal(row.at)}</Td>
                        <Td dataLabel={t('SignIns.OUTCOME_HEADING')}>
                          <Label isCompact color={row.outcome === 'SUCCEEDED' ? 'green' : 'grey'}>
                            {outcomeLabel(t, row.outcome)}
                          </Label>
                        </Td>
                        <Td dataLabel={t('SignIns.WHERE')}>
                          {[countryLabel(row.country), row.network].filter(Boolean).join(' · ') ||
                            t('SignIns.UNKNOWN_PLACE')}
                        </Td>
                        <Td dataLabel={t('SignIns.DEVICE')}>{describeAgent(row.userAgent)}</Td>
                        <Td dataLabel={t('SignIns.NOTICED')}>
                          {row.anomalies.length === 0 ? (
                            <Content component="small">{t('SignIns.NOTHING')}</Content>
                          ) : (
                            <LabelGroup isCompact numLabels={2}>
                              {row.anomalies.map((anomaly) => (
                                <Label
                                  key={anomaly}
                                  isCompact
                                  status={anomalySeverity(anomaly) === 'red' ? 'danger' : 'warning'}
                                >
                                  {anomalyLabel(t, anomaly)}
                                </Label>
                              ))}
                            </LabelGroup>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </StackItem>
              <StackItem>
                <Pagination
                  itemCount={activity.data.mySignInCount}
                  page={page}
                  perPage={perPage}
                  onSetPage={(_event, next) => setPage(next)}
                  onPerPageSelect={(_event, next) => {
                    setPerPage(next);
                    setPage(1);
                  }}
                  variant="bottom"
                  titles={{ paginationAriaLabel: t('SignIns.PAGINATION') }}
                />
              </StackItem>
            </>
          )}
        </Stack>
      </CardBody>
    </Card>
  );
};
