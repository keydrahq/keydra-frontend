import type { FC } from 'react';
import {
  Alert,
  Card,
  CardBody,
  CardTitle,
  Content,
  EmptyState,
  EmptyStateBody,
  Grid,
  GridItem,
  Label,
  LabelGroup,
  PageSection,
} from '@patternfly/react-core';
import { TopologyIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import { ClusterGraph } from './ClusterGraph';
import { ClusterSummary } from './ClusterSummary';
import { SlotBar } from './SlotBar';
import { featureLabelKey, roleLabelKey } from './labels';
import { useTopology } from './queries';
import { TOTAL_SLOTS, slotCount } from './types';
import type { ClusterNode } from './types';

/** A node's share of the keyspace, as a percentage to one decimal. */
const share = (node: ClusterNode): string =>
  `${((slotCount(node) / TOTAL_SLOTS) * 100).toFixed(1)}%`;

/**
 * How a target is arranged, and what it will let Keydra do.
 *
 * <p>Shows what is there rather than what is missing: a standalone server is not a failed cluster,
 * and the page says so plainly instead of drawing an empty diagram.
 */
export const Topology: FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('Topology.TITLE'));

  const { connectionId: idParam } = useParams();
  const connectionId = Number(idParam);
  const topology = useTopology(connectionId);

  if (!Number.isFinite(connectionId)) {
    return (
      <PageSection>
        <EmptyState titleText={t('Topology.NO_CONNECTION')} headingLevel="h2">
          <EmptyStateBody>{t('Topology.NO_CONNECTION_BODY')}</EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  if (topology.isPending) {
    return <LoadingView />;
  }
  if (topology.isError) {
    return (
      <PageSection>
        <ErrorView title={t('Topology.LOAD_ERROR')} message={topology.error.message} />
      </PageSection>
    );
  }

  const { server, capabilities, nodes, sentinelMasters, health } = topology.data;
  const primaries = nodes.filter((node) => node.role === 'primary');
  const covered = primaries.reduce((total, node) => total + slotCount(node), 0);
  /*
   * The same order as the picture and the bar above it. The server lists its nodes in whatever
   * order it holds them, which changes between reloads — so a row moved while nothing about the
   * cluster did, and the third card in the graph was the first row in the table.
   */
  const orderedNodes = [...nodes].sort(
    (left, right) =>
      (left.slots[0]?.from ?? TOTAL_SLOTS) - (right.slots[0]?.from ?? TOTAL_SLOTS) ||
      left.address.localeCompare(right.address),
  );

  return (
    <PageSection className="keydra-browser" isFilled>
      <div className="keydra-monitoring">
        <Grid hasGutter>
          {/*
           * The whole width, and first. What this card carries is the answer to "is this thing
           * all right", which is why somebody opened the page — and half of it is alerts, which
           * are not something to put in a column beside something else.
           */}
          <GridItem>
            <Card isCompact>
              {/* Not "Server" any more: for a cluster this is about all of them. */}
              <CardTitle>{t('Topology.SUMMARY')}</CardTitle>
              <CardBody>
                <ClusterSummary server={server} nodes={nodes} health={health} />
              </CardBody>
            </Card>
          </GridItem>

          <GridItem>
            <Card isCompact isFullHeight>
              <CardTitle>{t('Topology.CAPABILITIES')}</CardTitle>
              <CardBody>
                {capabilities.detected ? (
                  <LabelGroup numLabels={12}>
                    {capabilities.features.map((feature) => (
                      <Label key={feature} isCompact color="green">
                        {featureLabelKey(feature) ? t(featureLabelKey(feature)!) : feature}
                      </Label>
                    ))}
                  </LabelGroup>
                ) : (
                  // Saying nothing was detected is honest; a green list of guesses is not.
                  <Alert
                    variant="info"
                    isInline
                    isPlain
                    component="h3"
                    title={t('Topology.NOT_DETECTED')}
                  >
                    {t('Topology.NOT_DETECTED_BODY')}
                  </Alert>
                )}
              </CardBody>
            </Card>
          </GridItem>

          {nodes.length > 0 || sentinelMasters.length > 0 ? (
            <GridItem>
              <Card isCompact>
                <CardTitle>{t('Topology.GRAPH')}</CardTitle>
                <CardBody>
                  {/* The picture first: a table says what is there, a graph says how it is
                      arranged, and the arrangement is what someone opens this page for. */}
                  <ClusterGraph nodes={nodes} sentinelMasters={sentinelMasters} height={360} />
                </CardBody>
              </Card>
            </GridItem>
          ) : null}

          {nodes.length > 0 ? (
            <>
              <GridItem>
                <Card isCompact>
                  <CardTitle>{t('Topology.SLOTS')}</CardTitle>
                  <CardBody>
                    <SlotBar nodes={nodes} />
                    <Content component="small">
                      {covered === TOTAL_SLOTS
                        ? t('Topology.SLOTS_COVERED', { total: TOTAL_SLOTS })
                        : // An uncovered slot is a key nobody can read or write.
                          t('Topology.SLOTS_UNCOVERED', {
                            missing: TOTAL_SLOTS - covered,
                            total: TOTAL_SLOTS,
                          })}
                    </Content>
                  </CardBody>
                </Card>
              </GridItem>

              <GridItem>
                <Card isCompact>
                  <CardTitle>{t('Topology.NODES', { count: nodes.length })}</CardTitle>
                  <CardBody>
                    <Table aria-label={t('Topology.NODES_TABLE')} variant="compact">
                      <Thead>
                        <Tr>
                          <Th width={20}>{t('Topology.ADDRESS')}</Th>
                          <Th width={10}>{t('Topology.ROLE')}</Th>
                          <Th width={20}>{t('Topology.SLOT_RANGES')}</Th>
                          <Th width={10}>{t('Topology.SHARE')}</Th>
                          <Th width={10}>{t('Topology.LINK')}</Th>
                          <Th>{t('Topology.NODE_ID')}</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {orderedNodes.map((node) => (
                          <Tr key={node.id}>
                            <Td
                              dataLabel={t('Topology.ADDRESS')}
                              className="pf-v6-u-font-family-monospace"
                            >
                              {node.address}
                              {node.isSelf ? (
                                <>
                                  {' '}
                                  <Label isCompact variant="outline">
                                    {t('Topology.THIS_NODE')}
                                  </Label>
                                </>
                              ) : null}
                            </Td>
                            <Td dataLabel={t('Topology.ROLE')}>
                              <Label isCompact color={node.role === 'primary' ? 'blue' : 'grey'}>
                                {t(roleLabelKey(node.role))}
                              </Label>
                            </Td>
                            <Td
                              dataLabel={t('Topology.SLOT_RANGES')}
                              className="pf-v6-u-font-family-monospace"
                            >
                              {node.slots.length === 0
                                ? '—'
                                : node.slots.map((range) => `${range.from}–${range.to}`).join(', ')}
                            </Td>
                            <Td dataLabel={t('Topology.SHARE')}>
                              {node.slots.length === 0 ? '—' : share(node)}
                            </Td>
                            <Td dataLabel={t('Topology.LINK')}>
                              <Label
                                isCompact
                                color={node.linkState === 'connected' ? 'green' : 'red'}
                                status={node.linkState === 'connected' ? 'success' : 'danger'}
                              >
                                {node.linkState}
                              </Label>
                            </Td>
                            <Td
                              dataLabel={t('Topology.NODE_ID')}
                              className="pf-v6-u-font-family-monospace"
                            >
                              {node.id.slice(0, 12)}…
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </CardBody>
                </Card>
              </GridItem>
            </>
          ) : null}

          {sentinelMasters.length > 0 ? (
            <GridItem>
              <Card isCompact>
                <CardTitle>{t('Topology.SENTINEL')}</CardTitle>
                <CardBody>
                  <Table aria-label={t('Topology.SENTINEL')} variant="compact">
                    <Thead>
                      <Tr>
                        <Th width={20}>{t('Topology.MASTER_NAME')}</Th>
                        <Th width={20}>{t('Topology.ADDRESS')}</Th>
                        <Th width={15}>{t('Topology.STATUS')}</Th>
                        <Th width={10}>{t('Topology.QUORUM')}</Th>
                        <Th>{t('Topology.REPLICAS')}</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {sentinelMasters.map((master) => (
                        <Tr key={master.name}>
                          <Td dataLabel={t('Topology.MASTER_NAME')}>{master.name}</Td>
                          <Td
                            dataLabel={t('Topology.ADDRESS')}
                            className="pf-v6-u-font-family-monospace"
                          >
                            {master.address}
                          </Td>
                          <Td dataLabel={t('Topology.STATUS')}>
                            <Label
                              isCompact
                              color={master.status === 'master' ? 'green' : 'orange'}
                            >
                              {master.status}
                            </Label>
                          </Td>
                          <Td dataLabel={t('Topology.QUORUM')}>{master.quorum ?? '—'}</Td>
                          <Td dataLabel={t('Topology.REPLICAS')}>
                            <LabelGroup numLabels={4}>
                              {master.replicas.map((replica) => (
                                <Label key={replica.address} isCompact variant="outline">
                                  {replica.address}
                                </Label>
                              ))}
                            </LabelGroup>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </CardBody>
              </Card>
            </GridItem>
          ) : null}

          {nodes.length === 0 && sentinelMasters.length === 0 ? (
            <GridItem>
              <EmptyState
                titleText={t('Topology.STANDALONE_TITLE')}
                icon={TopologyIcon}
                headingLevel="h2"
              >
                <EmptyStateBody>{t('Topology.STANDALONE_BODY')}</EmptyStateBody>
              </EmptyState>
            </GridItem>
          ) : null}
        </Grid>
      </div>
    </PageSection>
  );
};
