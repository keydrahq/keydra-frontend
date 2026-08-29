import type { FC } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  EmptyState,
  EmptyStateBody,
  Flex,
  FlexItem,
  Label,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { formatMicros } from './format';
import { useClearSlowCommands, useSlowCommands } from './queries';

export interface SlowLogTableProps {
  connectionId: number;
}

/** Commands the server itself recorded as slow. */
export const SlowLogTable: FC<SlowLogTableProps> = ({ connectionId }) => {
  const { t } = useTranslation();
  const slow = useSlowCommands(connectionId);
  const clear = useClearSlowCommands(connectionId);

  const entries = slow.data ?? [];

  return (
    <Card isCompact isFullHeight>
      <CardTitle>
        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
          <FlexItem grow={{ default: 'grow' }}>{t('Monitoring.SLOWLOG')}</FlexItem>
          {/* Buttons rather than inline links: they are controls on a card header, and a
              row of underlined words there reads as text that happens to be clickable. */}
          <FlexItem>
            <Button variant="secondary" size="sm" onClick={() => void slow.refetch()}>
              {t('Monitoring.REFRESH')}
            </Button>
          </FlexItem>
          <FlexItem>
            <Button
              variant="secondary"
              size="sm"
              isDanger
              isDisabled={entries.length === 0 || clear.isPending}
              onClick={() => clear.mutate()}
            >
              {t('Monitoring.CLEAR')}
            </Button>
          </FlexItem>
        </Flex>
      </CardTitle>
      <CardBody className="keydra-monitoring__scroll">
        {entries.length === 0 ? (
          <EmptyState titleText={t('Monitoring.SLOWLOG_EMPTY')} headingLevel="h4" variant="xs">
            <EmptyStateBody>{t('Monitoring.SLOWLOG_EMPTY_BODY')}</EmptyStateBody>
          </EmptyState>
        ) : (
          <Table aria-label={t('Monitoring.SLOWLOG')} variant="compact">
            <Thead>
              <Tr>
                <Th width={20}>{t('Monitoring.WHEN')}</Th>
                <Th width={15}>{t('Monitoring.DURATION')}</Th>
                <Th>{t('Monitoring.COMMAND')}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {entries.map((entry) => (
                <Tr key={entry.id}>
                  <Td dataLabel={t('Monitoring.WHEN')} className="pf-v6-u-font-family-monospace">
                    {new Date(entry.at).toLocaleTimeString()}
                  </Td>
                  <Td dataLabel={t('Monitoring.DURATION')}>
                    {/* Anything over a tenth of a second is worth the eye stopping on. */}
                    <Label
                      isCompact
                      color={entry.durationMicros > 100_000 ? 'red' : 'orange'}
                      status={entry.durationMicros > 100_000 ? 'danger' : 'warning'}
                    >
                      {formatMicros(entry.durationMicros)}
                    </Label>
                  </Td>
                  <Td
                    dataLabel={t('Monitoring.COMMAND')}
                    className="keydra-value__text pf-v6-u-font-family-monospace"
                  >
                    {entry.arguments.join(' ')}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
};
