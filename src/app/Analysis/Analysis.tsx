import type { FC } from 'react';
import { useContext, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  EmptyState,
  EmptyStateBody,
  Grid,
  GridItem,
  Label,
  PageSection,
  Progress,
  ProgressMeasureLocation,
  ProgressVariant,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { ChartDonut, ChartThemeColor } from '@patternfly/react-charts/victory';
import { SearchIcon, SyncAltIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';
import { formatBytes, formatCount } from '@app/Monitoring/format';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { ServiceContext } from '@app/Shared/Services/Services';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import type { KeyspaceReport } from './types';

/** The bands in the order they answer "when does this memory come back". */
const BANDS = ['never', 'hour', 'day', 'week', 'longer'] as const;

/**
 * Where a target's memory went.
 *
 * <p>Every Redis console can name the single biggest key. That is rarely the question: a server
 * fills up because one namespace quietly grew, or because a cache was written without expiries, and
 * neither shows up in a list of the top ten keys. This page answers those two, and says how much of
 * the keyspace it looked at so nobody has to guess how far to trust it.
 */
const KEYSPACE = `
  query KeyspaceReport($connectionId: BigInteger, $database: Int) {
    keyspaceReport(connectionId: $connectionId, database: $database) {
      sampled
      keysInDatabase
      bytesSampled
      namespaces {
        prefix
        keys
        bytes
        neverExpires
      }
      types {
        type
        keys
        bytes
      }
      expiry {
        band
        keys
        bytes
      }
      largest {
        key
        type
        bytes
        elements
        ttlMillis
      }
    }
  }
`;

export const Analysis: FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('Analysis.TITLE'));

  const { connectionId: idParam } = useParams();
  const connectionId = Number(idParam);
  const { graphql } = useContext(ServiceContext);
  const [searchParams] = useSearchParams();
  const database = searchParams.get('db');
  const [runs, setRuns] = useState(0);

  const report = useQuery({
    queryKey: ['analysis', connectionId, database, runs],
    queryFn: () =>
      graphql
        .query<{ keyspaceReport: KeyspaceReport }>(KEYSPACE, {
          connectionId,
          database: database === null ? null : Number(database),
        })
        .then((answer) => answer.keyspaceReport),
    // Measuring costs a round trip per key, so it is never refetched on its own.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  if (!Number.isFinite(connectionId)) {
    return (
      <PageSection>
        <EmptyState titleText={t('Analysis.NO_CONNECTION')} headingLevel="h2" icon={SearchIcon} />
      </PageSection>
    );
  }

  if (report.isPending) {
    return <LoadingView />;
  }
  if (report.isError) {
    return (
      <PageSection>
        <ErrorView title={t('Analysis.LOAD_ERROR')} message={report.error.message} />
      </PageSection>
    );
  }

  const data = report.data;
  const never = data.expiry.find((band) => band.band === 'never');
  const neverShare = data.sampled === 0 ? 0 : ((never?.keys ?? 0) / data.sampled) * 100;
  const isCensus = data.keysInDatabase > 0 && data.sampled >= data.keysInDatabase;

  return (
    <PageSection hasBodyWrapper={false} isFilled className="keydra-browser">
      <div className="keydra-monitoring">
        <Toolbar id="analysis-toolbar" inset={{ default: 'insetNone' }}>
          <ToolbarContent>
            <ToolbarItem>
              <Button
                variant="secondary"
                icon={<SyncAltIcon />}
                isLoading={report.isFetching}
                isDisabled={report.isFetching}
                onClick={() => setRuns((n) => n + 1)}
              >
                {t('Analysis.REMEASURE')}
              </Button>
            </ToolbarItem>
            <ToolbarItem align={{ default: 'alignEnd' }} className="pf-v6-u-text-color-subtle">
              {/* Whether this is a census or an estimate is the first thing that decides
                  how far to trust everything below it. */}
              {isCensus
                ? t('Analysis.CENSUS', { count: data.sampled })
                : t('Analysis.SAMPLE', {
                    sampled: formatCount(data.sampled),
                    total: formatCount(data.keysInDatabase),
                  })}
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        <Grid hasGutter>
          {neverShare >= 50 ? (
            <GridItem>
              {/* The finding, not a number to work out: a cache whose entries never expire
                  is not a cache, and the memory it holds is not coming back. */}
              <Alert
                variant={neverShare >= 90 ? 'warning' : 'info'}
                isInline
                component="h3"
                title={t('Analysis.NEVER_EXPIRES_TITLE', { percent: Math.round(neverShare) })}
              >
                {t('Analysis.NEVER_EXPIRES_BODY', { bytes: formatBytes(never?.bytes ?? 0) })}
              </Alert>
            </GridItem>
          ) : null}

          <GridItem lg={5}>
            <Card isCompact isFullHeight>
              <CardTitle>{t('Analysis.BY_TYPE')}</CardTitle>
              <CardBody>
                {data.sampled === 0 ? (
                  <EmptyState titleText={t('Analysis.EMPTY_TITLE')} headingLevel="h3" variant="sm">
                    <EmptyStateBody>{t('Analysis.EMPTY_BODY')}</EmptyStateBody>
                  </EmptyState>
                ) : (
                  <ChartDonut
                    ariaDesc={t('Analysis.BY_TYPE')}
                    ariaTitle={t('Analysis.BY_TYPE')}
                    constrainToVisibleArea
                    themeColor={ChartThemeColor.multiOrdered}
                    data={data.types.map((type) => ({
                      x: type.type,
                      y: type.bytes,
                    }))}
                    labels={({ datum }) => `${datum.x}: ${formatBytes(Number(datum.y))}`}
                    legendData={data.types.map((type) => ({ name: type.type }))}
                    legendOrientation="vertical"
                    legendPosition="right"
                    padding={{ bottom: 20, left: 20, right: 160, top: 20 }}
                    subTitle={t('Analysis.MEASURED')}
                    title={formatBytes(data.bytesSampled)}
                    height={230}
                    width={430}
                  />
                )}
              </CardBody>
            </Card>
          </GridItem>

          <GridItem lg={7}>
            <Card isCompact isFullHeight>
              <CardTitle>{t('Analysis.WHEN_RELEASED')}</CardTitle>
              <CardBody>
                {BANDS.map((band) => {
                  const found = data.expiry.find((entry) => entry.band === band);
                  const share = data.sampled === 0 ? 0 : ((found?.keys ?? 0) / data.sampled) * 100;
                  return (
                    <Progress
                      key={band}
                      value={share}
                      title={t(`Analysis.BAND_${band}` as 'Analysis.BAND_never')}
                      label={`${formatCount(found?.keys ?? 0)} · ${formatBytes(found?.bytes ?? 0)}`}
                      measureLocation={ProgressMeasureLocation.outside}
                      // Never-expiring memory is the only band that is a problem rather
                      // than a fact, and only once it dominates.
                      variant={
                        band === 'never' && share >= 90 ? ProgressVariant.warning : undefined
                      }
                    />
                  );
                })}
              </CardBody>
            </Card>
          </GridItem>

          <GridItem lg={7}>
            <Card isCompact isFullHeight>
              <CardTitle>{t('Analysis.BY_NAMESPACE')}</CardTitle>
              <CardBody>
                <Table aria-label={t('Analysis.BY_NAMESPACE')} variant="compact">
                  <Thead>
                    <Tr>
                      <Th width={20}>{t('Analysis.NAMESPACE')}</Th>
                      <Th width={10}>{t('Analysis.KEYS')}</Th>
                      <Th width={40}>{t('Analysis.MEMORY')}</Th>
                      <Th>{t('Analysis.NEVER_EXPIRES')}</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {data.namespaces.map((namespace) => (
                      <Tr key={namespace.prefix}>
                        <Td
                          dataLabel={t('Analysis.NAMESPACE')}
                          className="pf-v6-u-font-family-monospace"
                        >
                          {namespace.prefix}
                        </Td>
                        <Td dataLabel={t('Analysis.KEYS')}>{formatCount(namespace.keys)}</Td>
                        <Td dataLabel={t('Analysis.MEMORY')}>
                          <Progress
                            title=""
                            value={
                              data.bytesSampled === 0
                                ? 0
                                : (namespace.bytes / data.bytesSampled) * 100
                            }
                            label={formatBytes(namespace.bytes)}
                            measureLocation={ProgressMeasureLocation.outside}
                            aria-label={t('Analysis.MEMORY')}
                          />
                        </Td>
                        <Td dataLabel={t('Analysis.NEVER_EXPIRES')}>
                          {namespace.neverExpires === 0 ? (
                            '—'
                          ) : (
                            <Label
                              isCompact
                              color={namespace.neverExpires === namespace.keys ? 'orange' : 'grey'}
                            >
                              {formatCount(namespace.neverExpires)}
                            </Label>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          </GridItem>

          <GridItem lg={5}>
            <Card isCompact isFullHeight>
              <CardTitle>{t('Analysis.LARGEST')}</CardTitle>
              <CardBody>
                <Table aria-label={t('Analysis.LARGEST')} variant="compact">
                  <Thead>
                    <Tr>
                      <Th>{t('Analysis.KEY')}</Th>
                      <Th width={10}>{t('Analysis.TYPE')}</Th>
                      <Th width={20}>{t('Analysis.SIZE')}</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {data.largest.map((key) => (
                      <Tr key={key.key}>
                        <Td
                          dataLabel={t('Analysis.KEY')}
                          className="pf-v6-u-font-family-monospace"
                          modifier="truncate"
                        >
                          {key.key}
                        </Td>
                        <Td dataLabel={t('Analysis.TYPE')}>
                          <Label isCompact>{key.type}</Label>
                        </Td>
                        <Td dataLabel={t('Analysis.SIZE')}>{formatBytes(key.bytes)}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>
      </div>
    </PageSection>
  );
};
