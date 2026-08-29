import type { FC } from 'react';
import { useState } from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  Content,
  EmptyState,
  EmptyStateBody,
  FormSelect,
  FormSelectOption,
  Grid,
  GridItem,
  Label,
  LabelGroup,
  PageSection,
  Pagination,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { CheckCircleIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { PageHeader } from '@app/Shared/Components/PageHeader';
import {
  anomalyLabel,
  anomalySeverity,
  countryLabel,
  describeAgent,
  outcomeLabel,
  whenLocal,
} from '@app/Shared/Components/signInLabels';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import { useSignInWatch } from '@app/Settings/signInQueries';
import type { SignInActivity } from '@app/Settings/signInQueries';

/** How far back the page looks. Short enough to be about now, long enough to hold a weekend. */
const WINDOWS = [1, 7, 30] as const;

/**
 * Sign-ins that did not look like the ones before them, and sign-ins that were refused.
 *
 * <p>Separate from the audit log, which records what people did once they were in. This is about
 * getting in, and the two questions have different shapes: an audit entry is a fact about an
 * action, and these are comparisons against a history — a network this account has not used, a
 * country it cannot have reached in the time, a run of wrong passwords that ended in a right one.
 *
 * <p>Two tables because there are two things to see and they are read differently. The flagged
 * list is short and every row deserves reading; the refused list is long by nature and what
 * matters in it is the shape — one name over and over is somebody guessing a password, forty
 * names from one network is somebody working through a list.
 *
 * <p>An empty flagged list is the ordinary state and is drawn as an answer rather than as a table
 * with no rows in it. "Nothing looked wrong" is what somebody came here to find out.
 */
export const SignInWatch: FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('SignIns.WATCH_TITLE'));
  const [days, setDays] = useState<number>(7);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const watch = useSignInWatch(days, perPage, (page - 1) * perPage);

  const rows = (entries: SignInActivity[], withAnomalies: boolean) => (
    <Table variant="compact" aria-label={t('SignIns.WATCH_TITLE')}>
      <Thead>
        <Tr>
          <Th>{t('SignIns.WHEN')}</Th>
          <Th>{t('SignIns.ACCOUNT')}</Th>
          <Th>{t('SignIns.OUTCOME_HEADING')}</Th>
          <Th>{t('SignIns.WHERE')}</Th>
          <Th>{withAnomalies ? t('SignIns.NOTICED') : t('SignIns.DEVICE')}</Th>
        </Tr>
      </Thead>
      <Tbody>
        {entries.map((row) => (
          <Tr key={row.id}>
            <Td dataLabel={t('SignIns.WHEN')}>{whenLocal(row.at)}</Td>
            <Td dataLabel={t('SignIns.ACCOUNT')}>{row.username}</Td>
            <Td dataLabel={t('SignIns.OUTCOME_HEADING')}>
              <Label isCompact color={row.outcome === 'SUCCEEDED' ? 'green' : 'grey'}>
                {outcomeLabel(t, row.outcome)}
              </Label>
            </Td>
            <Td dataLabel={t('SignIns.WHERE')}>
              {[countryLabel(row.country), row.network].filter(Boolean).join(' · ') ||
                t('SignIns.UNKNOWN_PLACE')}
            </Td>
            <Td dataLabel={withAnomalies ? t('SignIns.NOTICED') : t('SignIns.DEVICE')}>
              {withAnomalies ? (
                <LabelGroup isCompact numLabels={3}>
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
              ) : (
                describeAgent(row.userAgent)
              )}
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );

  return (
    <>
      <PageHeader title={t('SignIns.WATCH_TITLE')} description={t('SignIns.WATCH_DESCRIPTION')} />

      <PageSection isFilled>
        <Toolbar id="sign-in-watch-toolbar" inset={{ default: 'insetNone' }}>
          <ToolbarContent alignItems="center">
            <ToolbarItem>
              <FormSelect
                aria-label={t('SignIns.WINDOW')}
                value={String(days)}
                onChange={(_event, value) => {
                  setDays(Number(value));
                  setPage(1);
                }}
              >
                {WINDOWS.map((window) => (
                  <FormSelectOption
                    key={window}
                    value={String(window)}
                    label={t('SignIns.LAST_DAYS', { count: window })}
                  />
                ))}
              </FormSelect>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        {watch.isLoading && <LoadingView />}
        {watch.isError && (
          <ErrorView
            title={t('SignIns.LOAD_ERROR')}
            failure={watch.error}
            onRetry={() => void watch.refetch()}
          />
        )}

        {watch.data && (
          <Grid hasGutter>
            <GridItem span={12}>
              <Card>
                <CardTitle>{t('SignIns.FLAGGED_TITLE')}</CardTitle>
                <CardBody>
                  {watch.data.flaggedSignIns.length === 0 ? (
                    <EmptyState
                      headingLevel="h3"
                      icon={CheckCircleIcon}
                      titleText={t('SignIns.NOTHING_FLAGGED')}
                      variant="sm"
                    >
                      <EmptyStateBody>{t('SignIns.NOTHING_FLAGGED_BODY')}</EmptyStateBody>
                    </EmptyState>
                  ) : (
                    <>
                      {rows(watch.data.flaggedSignIns, true)}
                      <Pagination
                        itemCount={watch.data.flaggedSignInCount}
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
                    </>
                  )}
                </CardBody>
              </Card>
            </GridItem>

            <GridItem span={12}>
              <Card>
                <CardTitle>{t('SignIns.REFUSED_TITLE')}</CardTitle>
                <CardBody>
                  {watch.data.refusedSignIns.length === 0 ? (
                    <Content component="p">{t('SignIns.NOTHING_REFUSED')}</Content>
                  ) : (
                    rows(watch.data.refusedSignIns, false)
                  )}
                </CardBody>
              </Card>
            </GridItem>
          </Grid>
        )}
      </PageSection>
    </>
  );
};
