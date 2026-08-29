import type { FC } from 'react';
import { useState } from 'react';
import type { TFunction } from 'i18next';
import {
  Button,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  Label,
  LabelGroup,
  Switch,
  Timestamp,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Tooltip,
} from '@patternfly/react-core';
import { BellIcon, PlusCircleIcon } from '@patternfly/react-icons';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { useAlertTargets } from './queries';
import { Permission, usePermissionCheck } from '@app/Login/queries';
import { ConfirmDialog } from '@app/Shared/Components/ConfirmDialog';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { RuleDialog } from './RuleDialog';
import { useAlertRules, useDeleteAlertRule, useSaveAlertRule } from './queries';
import { AlertBasis, AlertState, BASELINE_WINDOWS, MetricUnit } from './types';
import type { AlertRuleSummary } from './types';
import { formatReading } from './wording';

/** How a window is said out loud, from how far back it sits. */
const windowLabel = (offsetSeconds: number) =>
  BASELINE_WINDOWS.find((window) => window.offsetSeconds === offsetSeconds)?.labelKey ??
  ('Alerts.WINDOW_EARLIER' as const);

const stateColor = (state: AlertState) => {
  switch (state) {
    case AlertState.Firing:
      return 'red' as const;
    case AlertState.Pending:
      return 'orange' as const;
    default:
      return 'green' as const;
  }
};

/**
 * The rules, and where each one stands right now.
 *
 * <p>The state column is the one somebody opens this page for, so it carries the reading beside it:
 * "firing" without the number it fired on is a row that sends you somewhere else to find out.
 *
 * <p>A rule whose target is not being sampled says so. That is not a hypothetical — an enabled rule
 * keeps its target sampled, so the only way to see it is a rule that is switched off, and a
 * switched-off rule that looked identical to a quiet one would be the worst row on the page.
 */
export const RulesTab: FC = () => {
  const { t } = useTranslation();
  const rules = useAlertRules();
  const connections = useAlertTargets();
  const save = useSaveAlertRule();
  const remove = useDeleteAlertRule();
  const holds = usePermissionCheck();

  const [editing, setEditing] = useState<AlertRuleSummary | 'new' | undefined>();
  const [removing, setRemoving] = useState<AlertRuleSummary | undefined>();

  /**
   * Whether there is any target this person could write a rule about.
   *
   * <p>Asked of the targets rather than of the rules: somebody who may write one and has not yet is
   * exactly who the button is for.
   */
  const mayWrite = (connections.data ?? []).some((profile) =>
    holds(Permission.AlertManage, profile.id),
  );

  const toggle = (rule: AlertRuleSummary, enabled: boolean) =>
    save.mutate({
      id: rule.id,
      request: {
        name: rule.name,
        connectionId: rule.connectionId,
        metric: rule.metric,
        comparison: rule.comparison,
        threshold: rule.threshold,
        forSeconds: rule.forSeconds,
        deliveryIds: rule.deliveryIds,
        enabled,
      },
    });

  if (rules.isPending) {
    return <LoadingView />;
  }
  if (rules.isError) {
    return <ErrorView title={t('Alerts.LOAD_ERROR')} message={rules.error.message} />;
  }

  // The dialogs are rendered once, below, rather than inside each branch. Saving the first
  // rule turns the empty state into a table, and a dialog that lived in the branch it started
  // in would be unmounted by that — taking its "close on success" with it, because a mutation
  // callback belongs to the component that is still there when the request comes back.
  const dialogs = (
    <>
      {editing && (
        <RuleDialog
          rule={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
        />
      )}
      {removing && (
        <ConfirmDialog
          isOpen
          title={t('Alerts.DELETE_TITLE')}
          confirmLabel={t('Alerts.DELETE')}
          isDestructive
          isBusy={remove.isPending}
          onConfirm={() => {
            remove.mutate({ id: removing.id, connectionId: removing.connectionId });
            setRemoving(undefined);
          }}
          onCancel={() => setRemoving(undefined)}
        >
          {t('Alerts.DELETE_BODY', { name: removing.name })}
        </ConfirmDialog>
      )}
    </>
  );

  if (rules.data.length === 0) {
    return (
      <>
        <EmptyState titleText={t('Alerts.EMPTY_TITLE')} icon={BellIcon} headingLevel="h2">
          <EmptyStateBody>
            {mayWrite ? t('Alerts.EMPTY_BODY') : t('Alerts.EMPTY_UNPRIVILEGED')}
          </EmptyStateBody>
          {mayWrite && (
            <EmptyStateFooter>
              <EmptyStateActions>
                <Button
                  variant="primary"
                  icon={<PlusCircleIcon />}
                  onClick={() => setEditing('new')}
                >
                  {t('Alerts.ADD')}
                </Button>
              </EmptyStateActions>
            </EmptyStateFooter>
          )}
        </EmptyState>
        {dialogs}
      </>
    );
  }

  return (
    <>
      <Toolbar id="alert-rules-toolbar" inset={{ default: 'insetNone' }}>
        <ToolbarContent alignItems="center">
          <ToolbarItem align={{ default: 'alignEnd' }}>
            {mayWrite && (
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => setEditing('new')}>
                {t('Alerts.ADD')}
              </Button>
            )}
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      <Table aria-label={t('Alerts.RULES')} variant="compact">
        <Thead>
          <Tr>
            <Th width={20}>{t('Alerts.NAME')}</Th>
            <Th width={15}>{t('Alerts.TARGET')}</Th>
            <Th width={20}>{t('Alerts.CONDITION')}</Th>
            <Th width={15}>{t('Alerts.STATE')}</Th>
            <Th width={15}>{t('Alerts.SENDS_TO')}</Th>
            <Th width={10}>{t('Alerts.ENABLED')}</Th>
            <Th screenReaderText={t('Alerts.ACTIONS')} />
          </Tr>
        </Thead>
        <Tbody>
          {rules.data.map((rule) => {
            const mayManage = holds(Permission.AlertManage, rule.connectionId);
            const metricName = t(`Alerts.METRIC_${rule.metric}` as 'Alerts.METRIC_NO_ANSWER');
            const comparisonWord = t(
              rule.comparison === 'ABOVE' ? 'Alerts.ABOVE' : 'Alerts.BELOW',
            ).toLowerCase();
            let condition: string;
            if (rule.unit === MetricUnit.Condition) {
              condition = metricName;
            } else if (rule.basis === AlertBasis.Baseline) {
              // The percentage with nothing beside it is a number somebody has to go and look
              // up; the baseline is the half of the sentence that makes it mean something.
              condition = t('Alerts.CONDITION_BASELINE', {
                metric: metricName,
                comparison: comparisonWord,
                percent: Math.round(rule.threshold),
                window: t(windowLabel(rule.baselineOffsetSeconds)),
                baseline:
                  rule.baseline === null
                    ? t('Alerts.BASELINE_UNKNOWN')
                    : formatReading(rule.baseline, rule.unit),
              });
            } else {
              condition = t('Alerts.CONDITION_TEXT', {
                metric: metricName,
                comparison: comparisonWord,
                threshold: formatReading(rule.threshold, rule.unit),
              });
            }
            return (
              <Tr key={rule.id}>
                <Td dataLabel={t('Alerts.NAME')}>{rule.name}</Td>
                <Td dataLabel={t('Alerts.TARGET')}>
                  {rule.connectionName ?? `#${rule.connectionId}`}
                </Td>
                <Td dataLabel={t('Alerts.CONDITION')}>
                  {condition}
                  {rule.forSeconds > 0 && (
                    <div className="pf-v6-u-font-size-sm pf-v6-u-color-200">
                      {t('Alerts.FOR_TEXT', { duration: describeFor(rule.forSeconds, t) })}
                    </div>
                  )}
                </Td>
                <Td dataLabel={t('Alerts.STATE')}>
                  <Label isCompact color={stateColor(rule.state)}>
                    {t(`Alerts.STATE_${rule.state}` as 'Alerts.STATE_OK')}
                  </Label>{' '}
                  <span className="pf-v6-u-font-size-sm pf-v6-u-color-200">
                    {rule.readAt ? (
                      <Tooltip
                        content={<Timestamp date={new Date(rule.readAt)} dateFormat="medium" />}
                      >
                        <span>{formatReading(rule.reading, rule.unit)}</span>
                      </Tooltip>
                    ) : rule.enabled ? (
                      t('Alerts.NO_READING_YET')
                    ) : (
                      t('Alerts.NOT_WATCHING')
                    )}
                  </span>
                </Td>
                <Td dataLabel={t('Alerts.SENDS_TO')}>
                  {rule.deliveryNames.length > 0 ? (
                    // Every one of them, not a count: which channels a rule announces itself in
                    // is the thing somebody scans this column for, and "3 destinations" sends
                    // them into the dialog to find out which.
                    <LabelGroup numLabels={3}>
                      {rule.deliveryNames.map((name) => (
                        <Label key={name} isCompact variant="outline">
                          {name}
                        </Label>
                      ))}
                    </LabelGroup>
                  ) : (
                    <Tooltip content={t('Alerts.IN_APP_ONLY_HINT')}>
                      <span className="pf-v6-u-color-200">{t('Alerts.IN_APP_ONLY')}</span>
                    </Tooltip>
                  )}
                </Td>
                <Td dataLabel={t('Alerts.ENABLED')}>
                  <Switch
                    id={`alert-rule-${rule.id}`}
                    aria-label={t('Alerts.ENABLED')}
                    isChecked={rule.enabled}
                    isDisabled={!mayManage}
                    onChange={(_event, checked) => toggle(rule, checked)}
                  />
                </Td>
                <Td isActionCell>
                  {mayManage && (
                    <ActionsColumn
                      items={[
                        { title: t('Alerts.EDIT'), onClick: () => setEditing(rule) },
                        { isSeparator: true },
                        {
                          title: t('Alerts.DELETE'),
                          onClick: () => setRemoving(rule),
                          isDanger: true,
                        },
                      ]}
                    />
                  )}
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>

      {dialogs}
    </>
  );
};

/** "for two minutes", in whichever unit reads best. */
const describeFor = (seconds: number, t: TFunction): string => {
  if (seconds % 3600 === 0) {
    return t('Alerts.HOURS', { count: seconds / 3600 });
  }
  if (seconds % 60 === 0) {
    return t('Alerts.MINUTES', { count: seconds / 60 });
  }
  return t('Alerts.SECONDS', { count: seconds });
};
