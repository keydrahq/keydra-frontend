import type { FC } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  Content,
  EmptyState,
  EmptyStateBody,
  Flex,
  FlexItem,
  Progress,
  ProgressMeasureLocation,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { KeyTypeLabel } from '@app/KeyBrowser/KeyTypeLabel';
import { formatBytes, formatCount } from './format';
import { useBigKeys } from './queries';

export interface BigKeysCardProps {
  connectionId: number;
}

/** How much of the keyspace one run measures. */
const SAMPLE_SIZE = 1000;
const TOP = 15;

/**
 * The largest keys in a sample.
 *
 * <p>Run on request, never on mount: measuring is a round trip per key, and a page that quietly
 * issued a thousand commands because someone opened it would be the opposite of what a monitoring
 * page is for.
 */
export const BigKeysCard: FC<BigKeysCardProps> = ({ connectionId }) => {
  const { t } = useTranslation();
  const report = useBigKeys(connectionId);

  const data = report.data;
  const largest = data?.largest ?? [];
  const biggest = largest[0]?.bytes ?? 0;

  return (
    <Card isCompact isFullHeight>
      <CardTitle>
        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
          <FlexItem grow={{ default: 'grow' }}>{t('Monitoring.BIG_KEYS')}</FlexItem>
          <FlexItem>
            <Button
              variant="secondary"
              size="sm"
              isLoading={report.isPending}
              isDisabled={report.isPending}
              onClick={() => report.mutate({ sample: SAMPLE_SIZE, top: TOP })}
            >
              {data ? t('Monitoring.MEASURE_AGAIN') : t('Monitoring.MEASURE')}
            </Button>
          </FlexItem>
        </Flex>
      </CardTitle>
      <CardBody className="keydra-monitoring__scroll">
        {!data ? (
          <EmptyState titleText={t('Monitoring.BIG_KEYS_IDLE')} headingLevel="h4" variant="xs">
            <EmptyStateBody>
              {t('Monitoring.BIG_KEYS_IDLE_BODY', { count: SAMPLE_SIZE })}
            </EmptyStateBody>
          </EmptyState>
        ) : (
          <>
            {/* The ranking is only true of what was measured, so the page says what that was. */}
            <Content component="small">
              {t('Monitoring.BIG_KEYS_SAMPLED', {
                sampled: formatCount(data.sampled),
                total: formatBytes(data.totalBytes),
              })}
            </Content>
            <Table aria-label={t('Monitoring.BIG_KEYS')} variant="compact">
              <Thead>
                <Tr>
                  <Th>{t('Monitoring.KEY')}</Th>
                  <Th width={10}>{t('Monitoring.TYPE')}</Th>
                  <Th width={30}>{t('Monitoring.SIZE')}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {largest.map((entry) => (
                  <Tr key={entry.key}>
                    <Td dataLabel={t('Monitoring.KEY')} className="pf-v6-u-font-family-monospace">
                      {entry.key}
                    </Td>
                    <Td dataLabel={t('Monitoring.TYPE')}>
                      <KeyTypeLabel type={entry.type} />
                    </Td>
                    <Td dataLabel={t('Monitoring.SIZE')}>
                      <Progress
                        value={biggest === 0 ? 0 : (entry.bytes / biggest) * 100}
                        title=""
                        label={formatBytes(entry.bytes)}
                        measureLocation={ProgressMeasureLocation.outside}
                        aria-label={t('Monitoring.SIZE_OF', { name: entry.key })}
                      />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </>
        )}
      </CardBody>
    </Card>
  );
};
