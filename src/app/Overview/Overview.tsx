import type { FC } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  Flex,
  FlexItem,
  Gallery,
  Grid,
  GridItem,
  Label,
  PageSection,
  Progress,
  ProgressMeasureLocation,
  Spinner,
} from '@patternfly/react-core';
import { PlusCircleIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { ConnectionStatusLabel } from '@app/Connections/ConnectionStatusLabel';
import { serverName } from '@app/Connections/serverLogo';
import { useConnections } from '@app/Connections/queries';
import { formatBytes, formatCount, formatDuration } from '@app/Monitoring/format';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { PageHeader } from '@app/Shared/Components/PageHeader';
import { RouterLink } from '@app/Shared/Components/RouterLink';
import { connectionHome } from '@app/routes';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import { AttentionCard } from './AttentionCard';
import { FleetGauge } from './FleetGauge';
import { useFleet } from './useFleet';
import { useAttention } from './useAttention';

/** One headline figure, with what it is under it rather than beside it. */
const Stat: FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <Card isCompact isFullHeight>
    <CardBody>
      <div className="keydra-stat__label">{label}</div>
      <div className="keydra-stat__value pf-v6-u-font-size-2xl">{value}</div>
      {hint ? <div className="keydra-stat__hint">{hint}</div> : null}
    </CardBody>
  </Card>
);

/**
 * Every target at once.
 *
 * <p>The per-connection pages answer "how is this server", and nobody running more than one of them
 * has that question first. This answers "how is the fleet": which targets are answering, where the
 * keys and the memory actually are, and which one is closest to its ceiling — the questions that
 * decide which server to open, asked before opening any of them.
 *
 * <p>Readings are gathered one target at a time rather than from an endpoint that answers for all
 * of them, so a target that is down or behind a tunnel that will not open cannot hold up the rest.
 */
export const Overview: FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('Overview.TITLE'));

  const { data, isPending, isError, error, refetch } = useConnections();
  // Status changes arrive over the notification hub, so the page updates without polling.
  const profiles = data ?? [];
  const fleet = useFleet(profiles);
  // Everything currently wrong, from wherever it is recorded: a rule firing, a target that
  // has stopped answering, work that did not run, a migration that stopped halfway.
  const attention = useAttention(profiles);

  if (isPending) {
    return <LoadingView />;
  }

  if (isError) {
    return (
      <PageSection>
        <ErrorView
          title={t('Connections.LOAD_ERROR_TITLE')}
          failure={error}
          onRetry={() => void refetch()}
        />
      </PageSection>
    );
  }

  if (profiles.length === 0) {
    return (
      <>
        <PageHeader title={t('Overview.TITLE')} description={t('Overview.DESCRIPTION')} />
        <PageSection isFilled>
          <EmptyState titleText={t('Overview.EMPTY_TITLE')} icon={PlusCircleIcon} headingLevel="h2">
            <EmptyStateBody>{t('Overview.EMPTY_BODY')}</EmptyStateBody>
            <EmptyStateFooter>
              <EmptyStateActions>
                <Button variant="primary" component={RouterLink} href="/connections">
                  {t('Overview.GO_TO_CONNECTIONS')}
                </Button>
              </EmptyStateActions>
            </EmptyStateFooter>
          </EmptyState>
        </PageSection>
      </>
    );
  }

  // Only targets that reported a ceiling can be shown as a proportion of one; the rest are
  // not at zero percent, they are simply unbounded.
  const bounded = fleet.members.filter(
    (member) => (member.sample?.memoryMaxBytes ?? 0) > 0 && member.sample?.memoryUsedBytes != null,
  );
  const fullest = bounded.sort(
    (left, right) =>
      right.sample!.memoryUsedBytes! / right.sample!.memoryMaxBytes! -
      left.sample!.memoryUsedBytes! / left.sample!.memoryMaxBytes!,
  )[0];

  return (
    <>
      <PageHeader
        title={t('Overview.TITLE')}
        description={t('Overview.SUMMARY', {
          count: profiles.length,
          up: fleet.reachable,
        })}
      />

      <PageSection isFilled>
        <Grid hasGutter>
          <GridItem>
            <AttentionCard items={attention} />
          </GridItem>

          <GridItem>
            <Gallery hasGutter minWidths={{ default: '14rem' }}>
              <Stat
                label={t('Overview.REACHABLE')}
                value={`${fleet.reachable}/${profiles.length}`}
                hint={
                  fleet.unreachable > 0
                    ? t('Overview.UNREACHABLE', { count: fleet.unreachable })
                    : t('Overview.ALL_ANSWERING')
                }
              />
              <Stat
                label={t('Overview.KEYS')}
                value={formatCount(fleet.keys)}
                hint={t('Overview.ACROSS', { count: fleet.reporting })}
              />
              <Stat
                label={t('Overview.MEMORY')}
                value={formatBytes(fleet.memoryBytes)}
                hint={t('Overview.ACROSS', { count: fleet.reporting })}
              />
              <Stat
                label={t('Overview.OPS')}
                value={formatCount(fleet.opsPerSecond)}
                hint={t('Overview.CLIENTS', { count: fleet.clients })}
              />
            </Gallery>
          </GridItem>

          {fullest ? (
            <GridItem lg={4}>
              <Card isCompact isFullHeight>
                <CardTitle>{t('Overview.FULLEST')}</CardTitle>
                <CardBody>
                  <Flex
                    direction={{ default: 'column' }}
                    alignItems={{ default: 'alignItemsCenter' }}
                  >
                    <FlexItem>
                      <FleetGauge
                        used={fullest.sample!.memoryUsedBytes!}
                        total={fullest.sample!.memoryMaxBytes!}
                        label={fullest.profile.name}
                      />
                    </FlexItem>
                    <FlexItem>
                      <Button
                        variant="link"
                        component={RouterLink}
                        href={connectionHome(fullest.profile.id)}
                      >
                        {fullest.profile.name}
                      </Button>
                    </FlexItem>
                  </Flex>
                </CardBody>
              </Card>
            </GridItem>
          ) : null}

          <GridItem lg={fullest ? 8 : 12}>
            <Card isCompact isFullHeight>
              <CardTitle>{t('Overview.TARGETS')}</CardTitle>
              <CardBody>
                <Table aria-label={t('Overview.TARGETS')} variant="compact">
                  <Thead>
                    <Tr>
                      <Th width={20}>{t('Overview.TARGET')}</Th>
                      <Th width={15}>{t('Overview.STATUS')}</Th>
                      <Th width={10}>{t('Overview.SERVER')}</Th>
                      <Th width={10}>{t('Overview.KEYS')}</Th>
                      <Th width={25}>{t('Overview.MEMORY')}</Th>
                      <Th>{t('Overview.UPTIME')}</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {fleet.members.map(({ profile, sample, isLoading }) => (
                      <Tr key={profile.id}>
                        <Td dataLabel={t('Overview.TARGET')}>
                          <Button
                            variant="link"
                            isInline
                            component={RouterLink}
                            href={connectionHome(profile.id)}
                          >
                            {profile.name}
                          </Button>
                        </Td>
                        <Td dataLabel={t('Overview.STATUS')}>
                          <ConnectionStatusLabel status={profile.status} />
                        </Td>
                        <Td dataLabel={t('Overview.SERVER')}>
                          {profile.status.server ? (
                            <Label isCompact variant="outline">
                              {serverName(profile.status.server.flavor)}
                            </Label>
                          ) : (
                            '—'
                          )}
                        </Td>
                        <Td dataLabel={t('Overview.KEYS')}>
                          {sample?.keyCount != null ? formatCount(sample.keyCount) : '—'}
                        </Td>
                        <Td dataLabel={t('Overview.MEMORY')}>
                          {isLoading && !sample ? (
                            <Spinner size="sm" aria-valuetext={t('Overview.READING')} />
                          ) : sample?.memoryUsedBytes == null ? (
                            '—'
                          ) : sample.memoryMaxBytes ? (
                            // A bar only where there is a ceiling to fill: without one the
                            // proportion is undefined rather than zero.
                            <Progress
                              value={(sample.memoryUsedBytes / sample.memoryMaxBytes) * 100}
                              title=""
                              aria-label={t('Overview.MEMORY_OF', {
                                used: formatBytes(sample.memoryUsedBytes),
                                total: formatBytes(sample.memoryMaxBytes),
                              })}
                              label={`${formatBytes(sample.memoryUsedBytes)} / ${formatBytes(sample.memoryMaxBytes)}`}
                              measureLocation={ProgressMeasureLocation.outside}
                              isTitleTruncated
                            />
                          ) : (
                            formatBytes(sample.memoryUsedBytes)
                          )}
                        </Td>
                        <Td dataLabel={t('Overview.UPTIME')}>
                          {sample?.uptimeSeconds != null
                            ? formatDuration(sample.uptimeSeconds)
                            : '—'}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>
      </PageSection>
    </>
  );
};
