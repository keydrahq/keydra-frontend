import type { FC } from 'react';
import { useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  EmptyState,
  EmptyStateBody,
  Label,
  PageSection,
  Switch,
  Timestamp,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Tooltip,
} from '@patternfly/react-core';
import { CheckCircleIcon } from '@patternfly/react-icons';
import { ExpandableRowContent, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import type { TranslationKey } from '@i18n/keys';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { PageHeader } from '@app/Shared/Components/PageHeader';
import { useNotifications } from '@app/Shared/Components/notificationStore';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import { DeclineDialog } from './DeclineDialog';
import { useApprove, useApprovals, useDecline, useWithdraw } from './queries';
import type { ApprovalState, ApprovalSummary } from './types';

/**
 * What each state is called, as a table rather than a name built from the value.
 *
 * <p>A key assembled at runtime is a key the compiler cannot check and the extractor cannot find,
 * which is how a state ends up rendering as its own identifier in one language.
 */
const STATE_LABELS: Record<ApprovalState, TranslationKey> = {
  PENDING: 'Approvals.STATE_PENDING',
  RUNNING: 'Approvals.STATE_RUNNING',
  DONE: 'Approvals.STATE_DONE',
  FAILED: 'Approvals.STATE_FAILED',
  DECLINED: 'Approvals.STATE_DECLINED',
  WITHDRAWN: 'Approvals.STATE_WITHDRAWN',
  EXPIRED: 'Approvals.STATE_EXPIRED',
};

/**
 * The colour of an ending.
 *
 * <p>Declined is not red. Somebody looked at a request and said no, which is the feature working;
 * red is for the two that mean something went wrong — the work failed, or nobody answered in time.
 */
const stateColour = (state: ApprovalState) => {
  switch (state) {
    case 'PENDING':
      return 'blue' as const;
    case 'RUNNING':
      return 'purple' as const;
    case 'DONE':
      return 'green' as const;
    case 'FAILED':
    case 'EXPIRED':
      return 'red' as const;
    default:
      return 'grey' as const;
  }
};

/**
 * Operations waiting for somebody who is not the person who asked.
 *
 * <p>Ungated in the navigation, the way the schedules and the rules are: whether somebody can
 * answer a request depends on the request, and hiding the page would hide it from the people
 * waiting to hear about their own.
 */
export const Approvals: FC = () => {
  const { t } = useTranslation('public');
  useDocumentTitle(t('Approvals.TITLE'));

  const [showAnswered, setShowAnswered] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [declining, setDeclining] = useState<ApprovalSummary | undefined>();

  const approvals = useApprovals(showAnswered);
  const approve = useApprove();
  const decline = useDecline();
  const withdraw = useWithdraw();
  const { notify } = useNotifications();

  const toggle = (id: number) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });

  const onApprove = (request: ApprovalSummary) =>
    approve.mutate(request.id, {
      onSuccess: () =>
        notify({
          title: t('Approvals.APPROVED', { name: request.connectionName }),
          variant: 'success',
        }),
    });

  const onWithdraw = (request: ApprovalSummary) =>
    withdraw.mutate(request.id, {
      onSuccess: () => notify({ title: t('Approvals.WITHDRAWN'), variant: 'success' }),
    });

  const onDecline = (reason: string) => {
    if (!declining) {
      return;
    }
    decline.mutate(
      { id: declining.id, reason },
      {
        onSuccess: () => {
          setDeclining(undefined);
          notify({ title: t('Approvals.DECLINED'), variant: 'success' });
        },
      },
    );
  };

  if (approvals.isLoading) {
    return <LoadingView />;
  }
  if (approvals.isError) {
    return <ErrorView title={t('Approvals.LOAD_ERROR')} message={approvals.error.message} />;
  }

  const rows = approvals.data ?? [];

  return (
    <>
      <PageHeader title={t('Approvals.TITLE')} description={t('Approvals.DESCRIPTION')} />
      <PageSection>
        <Card>
          <CardBody>
            <Toolbar>
              <ToolbarContent>
                <ToolbarItem>
                  <Switch
                    id="approvals-show-answered"
                    label={t('Approvals.SHOW_ANSWERED')}
                    isChecked={showAnswered}
                    onChange={(_, checked) => setShowAnswered(checked)}
                  />
                </ToolbarItem>
              </ToolbarContent>
            </Toolbar>

            {rows.length === 0 ? (
              <EmptyState
                titleText={t('Approvals.NONE_TITLE')}
                headingLevel="h2"
                icon={CheckCircleIcon}
              >
                <EmptyStateBody>{t('Approvals.NONE_BODY')}</EmptyStateBody>
              </EmptyState>
            ) : (
              <Table aria-label={t('Approvals.TABLE_LABEL')} variant="compact">
                <Thead>
                  <Tr>
                    <Th screenReaderText={t('Approvals.EXPAND_LABEL')} />
                    <Th>{t('Approvals.COL_WHAT')}</Th>
                    <Th>{t('Approvals.COL_TARGET')}</Th>
                    <Th>{t('Approvals.COL_ASKED_BY')}</Th>
                    <Th>{t('Approvals.COL_EXPIRES')}</Th>
                    <Th>{t('Approvals.COL_STATE')}</Th>
                    <Th screenReaderText={t('Approvals.COL_ACTIONS')} />
                  </Tr>
                </Thead>
                {rows.map((request, index) => (
                  <Tbody key={request.id} isExpanded={expanded.has(request.id)}>
                    <Tr>
                      <Td
                        expand={{
                          rowIndex: index,
                          isExpanded: expanded.has(request.id),
                          onToggle: () => toggle(request.id),
                          expandId: `approval-${request.id}`,
                        }}
                      />
                      <Td dataLabel={t('Approvals.COL_WHAT')}>{request.summary}</Td>
                      <Td dataLabel={t('Approvals.COL_TARGET')}>
                        {request.secondConnectionName
                          ? `${request.connectionName ?? '—'} → ${request.secondConnectionName}`
                          : (request.connectionName ?? '—')}
                      </Td>
                      <Td dataLabel={t('Approvals.COL_ASKED_BY')}>{request.requestedBy ?? '—'}</Td>
                      <Td dataLabel={t('Approvals.COL_EXPIRES')}>
                        {request.state === 'PENDING' ? (
                          <Timestamp date={new Date(request.expiresAt)} />
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td dataLabel={t('Approvals.COL_STATE')}>
                        <Label color={stateColour(request.state)} isCompact>
                          {t(STATE_LABELS[request.state])}
                        </Label>
                      </Td>
                      <Td isActionCell>
                        {request.state === 'PENDING' && request.canDecide ? (
                          <>
                            <Button
                              variant="secondary"
                              isDanger
                              size="sm"
                              isDisabled={approve.isPending}
                              onClick={() => onApprove(request)}
                            >
                              {t('Approvals.APPROVE')}
                            </Button>{' '}
                            <Button variant="link" size="sm" onClick={() => setDeclining(request)}>
                              {t('Approvals.DECLINE')}
                            </Button>
                          </>
                        ) : null}
                        {request.state === 'PENDING' && request.mine ? (
                          <>
                            {/*
                              Said rather than left to be worked out. A request of your own that
                              nobody else has answered looks, from here, exactly like one you are
                              being asked to answer — and the reason there are no buttons is the
                              whole point of the feature.
                            */}
                            <Tooltip content={t('Approvals.YOURS_HELP')}>
                              <span className="pf-v6-u-mr-sm pf-v6-u-color-200">
                                {t('Approvals.YOURS')}
                              </span>
                            </Tooltip>
                            <Button
                              variant="link"
                              size="sm"
                              isDisabled={withdraw.isPending}
                              onClick={() => onWithdraw(request)}
                            >
                              {t('Approvals.WITHDRAW')}
                            </Button>
                          </>
                        ) : null}
                      </Td>
                    </Tr>
                    <Tr isExpanded={expanded.has(request.id)}>
                      <Td />
                      <Td colSpan={6}>
                        <ExpandableRowContent>
                          <div>
                            {t('Approvals.ASKED_AT')}{' '}
                            <Timestamp date={new Date(request.requestedAt)} />
                          </div>
                          {request.particulars.map((line) => (
                            <div key={line}>{line}</div>
                          ))}
                          {request.decidedBy || request.decidedAt ? (
                            <div>
                              {t('Approvals.ANSWERED_BY', {
                                who: request.decidedBy ?? t('Approvals.NOBODY'),
                              })}
                            </div>
                          ) : null}
                          {request.detail ? <div>{request.detail}</div> : null}
                        </ExpandableRowContent>
                      </Td>
                    </Tr>
                  </Tbody>
                ))}
              </Table>
            )}
          </CardBody>
        </Card>
      </PageSection>

      <DeclineDialog
        request={declining}
        isBusy={decline.isPending}
        onConfirm={onDecline}
        onCancel={() => setDeclining(undefined)}
      />
    </>
  );
};
