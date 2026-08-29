import type { FC } from 'react';
import { EmptyState, EmptyStateBody, Label, Timestamp, Tooltip } from '@patternfly/react-core';
import { HistoryIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { useAlertEvents } from './queries';
import { DeliveryOutcome, EventKind, MetricUnit } from './types';
import { formatReading, unitOf } from './wording';

const outcomeColor = (outcome: DeliveryOutcome) => {
  switch (outcome) {
    case DeliveryOutcome.Sent:
      return 'green' as const;
    case DeliveryOutcome.Failed:
      return 'red' as const;
    case DeliveryOutcome.Sending:
      return 'blue' as const;
    default:
      return 'grey' as const;
  }
};

/**
 * What the rules have said.
 *
 * <p>Only transitions, which is why this is readable at all: a rule that has been firing since
 * Tuesday appears once rather than seventeen thousand times, and the line that says it cleared is
 * worth as much as the one that says it started.
 *
 * <p>The delivery column is the one nobody thinks to ask for until the night they need it: "was
 * anybody actually told?" is a question about a particular alert, usually the one nobody saw.
 */
export const HistoryTab: FC = () => {
  const { t } = useTranslation();
  const events = useAlertEvents();

  if (events.isPending) {
    return <LoadingView />;
  }
  if (events.isError) {
    return <ErrorView title={t('Alerts.HISTORY_ERROR')} message={events.error.message} />;
  }
  if (events.data.length === 0) {
    return (
      <EmptyState titleText={t('Alerts.HISTORY_EMPTY')} icon={HistoryIcon} headingLevel="h2">
        <EmptyStateBody>{t('Alerts.HISTORY_EMPTY_BODY')}</EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <Table aria-label={t('Alerts.HISTORY')} variant="compact">
      <Thead>
        <Tr>
          <Th width={20}>{t('Alerts.WHEN')}</Th>
          <Th width={20}>{t('Alerts.RULE')}</Th>
          <Th width={15}>{t('Alerts.TARGET')}</Th>
          <Th width={15}>{t('Alerts.WHAT_HAPPENED')}</Th>
          <Th width={15}>{t('Alerts.READING')}</Th>
          <Th width={15}>{t('Alerts.DELIVERY')}</Th>
        </Tr>
      </Thead>
      <Tbody>
        {events.data.map((event) => {
          const unit = unitOf(event.metric);
          return (
            <Tr key={event.id}>
              <Td dataLabel={t('Alerts.WHEN')}>
                <Timestamp date={new Date(event.at)} dateFormat="short" timeFormat="medium" />
              </Td>
              <Td dataLabel={t('Alerts.RULE')}>{event.ruleName}</Td>
              <Td dataLabel={t('Alerts.TARGET')}>
                {event.connectionName ?? `#${event.connectionId}`}
              </Td>
              <Td dataLabel={t('Alerts.WHAT_HAPPENED')}>
                <Label isCompact color={event.kind === EventKind.Fired ? 'red' : 'green'}>
                  {t(event.kind === EventKind.Fired ? 'Alerts.FIRED' : 'Alerts.CLEARED')}
                </Label>
              </Td>
              <Td dataLabel={t('Alerts.READING')}>
                {unit === MetricUnit.Condition
                  ? '—'
                  : t('Alerts.READING_AGAINST', {
                      reading: formatReading(event.reading, unit),
                      comparison: t('Alerts.ABOVE').toLowerCase(),
                      threshold: formatReading(event.threshold, unit),
                    })}
              </Td>
              <Td dataLabel={t('Alerts.DELIVERY')}>
                {event.deliveryOutcome === DeliveryOutcome.None ? (
                  <span className="pf-v6-u-color-200">{t('Alerts.IN_APP_ONLY')}</span>
                ) : (
                  <Tooltip
                    content={event.deliveryDetail ?? event.deliveryName ?? t('Alerts.DELIVERY')}
                  >
                    <Label isCompact color={outcomeColor(event.deliveryOutcome)}>
                      {event.deliveryName ??
                        t(`Alerts.DELIVERY_${event.deliveryOutcome}` as 'Alerts.DELIVERY_SENT')}
                    </Label>
                  </Tooltip>
                )}
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
};
