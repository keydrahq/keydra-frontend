import type { FC } from 'react';
import { useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateActions,
  Grid,
  GridItem,
  Label,
  PageSection,
  Title,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { ChartLineIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import { BigKeysCard } from './BigKeysCard';
import { ClientsTable } from './ClientsTable';
import { MetricChart } from './MetricChart';
import { SlowLogTable } from './SlowLogTable';
import { formatBytes, formatCount, formatDuration, formatPercent } from './format';
import {
  useMetricsHistory,
  useMonitoringState,
  useStartMonitoring,
  useStopMonitoring,
} from './queries';
import { HistorySource } from './types';
import { hitRatio } from './types';
import { useLiveSamples } from './useLiveSamples';

/** One headline number with its unit, for the row above the charts. */
/**
 * One headline figure.
 *
 * <p>A card rather than a plain block: the four readings are the first thing the page says, and on
 * the grey content plane an unbounded block of text is the one thing that does not look deliberate.
 */
const Reading: FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <Card isCompact isFullHeight className="keydra-stat">
    <CardBody>
      <div className="keydra-stat__label">{label}</div>
      <Title headingLevel="h3" size="2xl" className="keydra-stat__value">
        {value}
      </Title>
      {hint ? <div className="keydra-stat__hint">{hint}</div> : null}
    </CardBody>
  </Card>
);

/**
 * What a target is doing, as it does it.
 *
 * <p>Readings arrive over the notification hub rather than by polling: the dashboard is open for
 * as long as someone is watching, and a page that asked every few seconds would generate the very
 * background traffic it exists to help someone notice.
 */
/**
 * The windows offered, in seconds. Zero is "live", which is a different thing rather than a
 * longer one: it follows the socket instead of asking for a range.
 */
const WINDOWS = [0, 3600, 86_400, 604_800, 2_592_000];

export const Dashboard: FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('Monitoring.TITLE'));

  const { connectionId: idParam } = useParams();
  const connectionId = Number(idParam);

  const state = useMonitoringState(connectionId);
  const start = useStartMonitoring(connectionId);
  const stop = useStopMonitoring(connectionId);
  // Passed as-is rather than defaulted here: the hook compares this by identity, and a
  // fresh [] per render would make every render look like new history.
  const live = useLiveSamples(connectionId, state.data?.samples);

  /**
   * Which window the charts draw.
   *
   * <p>"Live" is the readings as they arrive and is what the page opens with — the question
   * somebody has in front of a dashboard is almost always about the last few minutes. The rest
   * are asked of whatever sink can answer them, which is a store when one is configured and
   * memory when the window happens to fit.
   */
  const [window, setWindow] = useState<number>(0);
  const history = useMetricsHistory(connectionId, window, window > 0);
  const samples = window === 0 ? live : (history.data?.samples ?? []);

  // The readings above the charts are always now, whatever window is being drawn: they say
  // what the server is doing, and the chart says what it has been doing.
  const latest = live[live.length - 1];
  const ratio = latest ? hitRatio(latest) : null;

  if (!Number.isFinite(connectionId)) {
    return (
      <PageSection>
        <EmptyState titleText={t('Monitoring.NO_CONNECTION')} headingLevel="h2">
          <EmptyStateBody>{t('Monitoring.NO_CONNECTION_BODY')}</EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  return (
    <PageSection className="keydra-browser" isFilled>
      {state.isPending ? (
        <LoadingView />
      ) : !state.data?.enabled ? (
        <EmptyState titleText={t('Monitoring.OFF_TITLE')} icon={ChartLineIcon} headingLevel="h2">
          <EmptyStateBody>{t('Monitoring.OFF_BODY')}</EmptyStateBody>
          <EmptyStateFooter>
            <EmptyStateActions>
              <Button
                variant="primary"
                isLoading={start.isPending}
                isDisabled={start.isPending}
                onClick={() => start.mutate()}
              >
                {t('Monitoring.START')}
              </Button>
            </EmptyStateActions>
          </EmptyStateFooter>
        </EmptyState>
      ) : (
        <div className="keydra-monitoring">
          {/* Sampling is this tool's state, not the target's, so it is said here rather
                than in the header that names the server. */}
          <Toolbar
            id="monitoring-toolbar"
            className="keydra-tool-toolbar"
            inset={{ default: 'insetNone' }}
          >
            <ToolbarContent>
              <ToolbarItem>
                <Label isCompact color="green" status="success">
                  {t('Monitoring.SAMPLING', { seconds: state.data.intervalSeconds })}
                </Label>
              </ToolbarItem>
              <ToolbarItem>
                <ToggleGroup aria-label={t('Monitoring.WINDOW')}>
                  {WINDOWS.map((seconds) => (
                    <ToggleGroupItem
                      key={seconds}
                      text={t(`Monitoring.WINDOW_${seconds}` as 'Monitoring.WINDOW_0')}
                      buttonId={`window-${seconds}`}
                      isSelected={window === seconds}
                      onChange={() => setWindow(seconds)}
                    />
                  ))}
                </ToggleGroup>
              </ToolbarItem>
              {window > 0 && history.data ? (
                <ToolbarItem>
                  {/* Which of two different claims this is: every reading taken, or buckets
                      of them averaged. A chart that drew both the same way would invite
                      somebody to read a smoothed line as a measurement. */}
                  <Label isCompact variant="outline">
                    {history.data.source === HistorySource.Store
                      ? t('Monitoring.FROM_STORE', { seconds: history.data.stepSeconds })
                      : history.data.source === HistorySource.Memory
                        ? t('Monitoring.FROM_MEMORY')
                        : t('Monitoring.FROM_NOWHERE')}
                  </Label>
                </ToolbarItem>
              ) : null}
              <ToolbarItem align={{ default: 'alignEnd' }}>
                <Button variant="secondary" size="sm" onClick={() => stop.mutate()}>
                  {t('Monitoring.STOP')}
                </Button>
              </ToolbarItem>
            </ToolbarContent>
          </Toolbar>

          <Grid hasGutter>
            <GridItem md={3} sm={6}>
              <Reading
                label={t('Monitoring.OPS')}
                value={
                  latest?.opsPerSecond === null || latest === undefined
                    ? '—'
                    : formatCount(latest.opsPerSecond)
                }
                hint={
                  latest?.totalCommands != null
                    ? t('Monitoring.TOTAL_COMMANDS', {
                        count: formatCount(latest.totalCommands),
                      })
                    : undefined
                }
              />
            </GridItem>
            <GridItem md={3} sm={6}>
              <Reading
                label={t('Monitoring.MEMORY')}
                value={latest?.memoryUsedBytes == null ? '—' : formatBytes(latest.memoryUsedBytes)}
                hint={
                  latest?.memoryMaxBytes != null
                    ? t('Monitoring.OF_LIMIT', { limit: formatBytes(latest.memoryMaxBytes) })
                    : t('Monitoring.NO_LIMIT')
                }
              />
            </GridItem>
            <GridItem md={3} sm={6}>
              <Reading
                label={t('Monitoring.HIT_RATIO')}
                // Null is "nothing has been looked up", which is not a ratio of zero.
                value={ratio === null ? '—' : formatPercent(ratio)}
                hint={
                  latest?.keyCount != null
                    ? t('Monitoring.KEYS', { count: formatCount(latest.keyCount) })
                    : undefined
                }
              />
            </GridItem>
            <GridItem md={3} sm={6}>
              <Reading
                label={t('Monitoring.CLIENTS')}
                value={
                  latest?.connectedClients == null ? '—' : formatCount(latest.connectedClients)
                }
                hint={
                  latest?.uptimeSeconds != null
                    ? t('Monitoring.UPTIME', { duration: formatDuration(latest.uptimeSeconds) })
                    : undefined
                }
              />
            </GridItem>

            <GridItem lg={6}>
              <Card isCompact>
                <CardTitle>{t('Monitoring.OPS')}</CardTitle>
                <CardBody>
                  <MetricChart
                    samples={samples}
                    pick={(sample) => sample.opsPerSecond}
                    format={formatCount}
                    label={t('Monitoring.OPS')}
                  />
                </CardBody>
              </Card>
            </GridItem>
            <GridItem lg={6}>
              <Card isCompact>
                <CardTitle>{t('Monitoring.MEMORY')}</CardTitle>
                <CardBody>
                  <MetricChart
                    samples={samples}
                    pick={(sample) => sample.memoryUsedBytes}
                    format={formatBytes}
                    label={t('Monitoring.MEMORY')}
                  />
                </CardBody>
              </Card>
            </GridItem>
            <GridItem lg={6}>
              <Card isCompact>
                <CardTitle>{t('Monitoring.HIT_RATIO')}</CardTitle>
                <CardBody>
                  <MetricChart
                    samples={samples}
                    pick={hitRatio}
                    format={formatPercent}
                    label={t('Monitoring.HIT_RATIO')}
                  />
                </CardBody>
              </Card>
            </GridItem>
            <GridItem lg={6}>
              <Card isCompact>
                <CardTitle>{t('Monitoring.CLIENTS')}</CardTitle>
                <CardBody>
                  <MetricChart
                    samples={samples}
                    pick={(sample) => sample.connectedClients}
                    format={formatCount}
                    label={t('Monitoring.CLIENTS')}
                  />
                </CardBody>
              </Card>
            </GridItem>

            <GridItem lg={6}>
              <SlowLogTable connectionId={connectionId} />
            </GridItem>
            <GridItem lg={6}>
              <BigKeysCard connectionId={connectionId} />
            </GridItem>
            <GridItem>
              <ClientsTable connectionId={connectionId} />
            </GridItem>
          </Grid>
        </div>
      )}
    </PageSection>
  );
};
