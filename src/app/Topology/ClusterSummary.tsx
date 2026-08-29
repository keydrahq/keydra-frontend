import type { FC } from 'react';
import {
  Alert,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Label,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import type { ServerInfo } from '@app/Shared/Services/api.types';
import type { ClusterHealth, ClusterNode } from './types';
import { TOTAL_SLOTS, slotCount } from './types';

export interface ClusterSummaryProps {
  server: ServerInfo;
  nodes: ClusterNode[];
  health: ClusterHealth | null;
}

/** How many shards have nobody following them, which is what a failover needs. */
const unreplicated = (nodes: ClusterNode[]): number => {
  const primaries = nodes.filter((node) => node.role === 'primary' && node.slots.length > 0);
  return primaries.filter((primary) => !nodes.some((node) => node.primaryId === primary.id)).length;
};

/**
 * What is worth knowing about an arrangement before looking at the picture of it.
 *
 * <p>The page used to open with two facts — the flavour and the word "cluster" — and then draw
 * three cards. Everything a person actually opens a topology worried about was either further down
 * or nowhere: whether the cluster is serving, whether every slot has an owner that is answering,
 * and whether losing one node loses part of the keyspace.
 *
 * <p>The figures are stated once and the risks are stated as alerts, because those are two
 * different kinds of reading. A number in a row is something you look up; a sentence in an alert is
 * something that found you.
 */
export const ClusterSummary: FC<ClusterSummaryProps> = ({ server, nodes, health }) => {
  const { t } = useTranslation();

  const primaries = nodes.filter((node) => node.role === 'primary');
  const assigned =
    health?.slotsAssigned ?? primaries.reduce((sum, node) => sum + slotCount(node), 0);
  const bare = unreplicated(nodes);
  const shards = health?.size ?? primaries.filter((node) => node.slots.length > 0).length;
  const failing = (health?.slotsFail ?? 0) + (health?.slotsPfail ?? 0);
  /*
   * Counted from one end only. Both nodes in a move report the same slot — one handing it over,
   * one taking it on — so counting every entry would say twice as many slots are moving as are.
   */
  const moving = nodes.reduce(
    (total, node) => total + node.migrations.filter((one) => one.direction === 'OUT').length,
    0,
  );

  return (
    <Stack hasGutter>
      <StackItem>
        {/*
         * Auto-fitting rather than a fixed grid: the same strip carries seven figures for a
         * cluster and three for a standalone server, and a layout that reserved the missing ones
         * would leave labelled holes where there is nothing to say.
         */}
        <DescriptionList isAutoFit isCompact autoFitMinModifier={{ default: '10ch' }}>
          <DescriptionListGroup>
            <DescriptionListTerm>{t('Topology.FLAVOR')}</DescriptionListTerm>
            <DescriptionListDescription>
              <Label isCompact color="blue">
                {server.flavor}
              </Label>{' '}
              {server.version}
            </DescriptionListDescription>
          </DescriptionListGroup>

          <DescriptionListGroup>
            <DescriptionListTerm>{t('Topology.MODE')}</DescriptionListTerm>
            <DescriptionListDescription>{server.mode}</DescriptionListDescription>
          </DescriptionListGroup>

          {health ? (
            <DescriptionListGroup>
              <DescriptionListTerm>{t('Topology.STATE')}</DescriptionListTerm>
              <DescriptionListDescription>
                {/*
                 * The cluster's own word, in its own spelling, next to a status colour. Redis says
                 * "ok" or "fail" and translating that would put a word in its mouth.
                 */}
                <Label
                  isCompact
                  status={health.serving ? 'success' : 'danger'}
                  color={health.serving ? 'green' : 'red'}
                >
                  {health.state}
                </Label>
              </DescriptionListDescription>
            </DescriptionListGroup>
          ) : null}

          {nodes.length > 0 ? (
            <>
              <DescriptionListGroup>
                <DescriptionListTerm>{t('Topology.SHARDS')}</DescriptionListTerm>
                <DescriptionListDescription>{shards}</DescriptionListDescription>
              </DescriptionListGroup>

              <DescriptionListGroup>
                <DescriptionListTerm>{t('Topology.NODE_COUNT')}</DescriptionListTerm>
                <DescriptionListDescription>
                  {health?.knownNodes ?? nodes.length}
                </DescriptionListDescription>
              </DescriptionListGroup>

              <DescriptionListGroup>
                <DescriptionListTerm>{t('Topology.ASSIGNED')}</DescriptionListTerm>
                <DescriptionListDescription>
                  {t('Topology.OF_TOTAL', { count: assigned, total: TOTAL_SLOTS })}
                </DescriptionListDescription>
              </DescriptionListGroup>

              <DescriptionListGroup>
                <DescriptionListTerm>{t('Topology.REPLICATED')}</DescriptionListTerm>
                <DescriptionListDescription>
                  {t('Topology.OF_SHARDS', { count: shards - bare, total: shards })}
                </DescriptionListDescription>
              </DescriptionListGroup>

              {moving > 0 ? (
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Topology.MOVING')}</DescriptionListTerm>
                  <DescriptionListDescription>{moving}</DescriptionListDescription>
                </DescriptionListGroup>
              ) : null}

              {health && health.currentEpoch > 0 ? (
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Topology.EPOCH')}</DescriptionListTerm>
                  <DescriptionListDescription>{health.currentEpoch}</DescriptionListDescription>
                </DescriptionListGroup>
              ) : null}
            </>
          ) : null}
        </DescriptionList>
      </StackItem>

      {/*
       * In the order somebody would want to be told. A cluster that is not serving is not a
       * warning about the future; the rest are.
       */}
      {health && !health.serving ? (
        <StackItem>
          <Alert variant="danger" isInline component="h3" title={t('Topology.NOT_SERVING')}>
            {t('Topology.NOT_SERVING_BODY')}
          </Alert>
        </StackItem>
      ) : null}

      {nodes.length > 0 && assigned < TOTAL_SLOTS ? (
        <StackItem>
          <Alert
            variant="warning"
            isInline
            component="h3"
            title={t('Topology.UNASSIGNED', { count: TOTAL_SLOTS - assigned })}
          >
            {t('Topology.UNASSIGNED_BODY')}
          </Alert>
        </StackItem>
      ) : null}

      {failing > 0 ? (
        <StackItem>
          <Alert
            variant="warning"
            isInline
            component="h3"
            title={t('Topology.SLOTS_FAILING', { count: failing })}
          >
            {t('Topology.SLOTS_FAILING_BODY')}
          </Alert>
        </StackItem>
      ) : null}

      {moving > 0 ? (
        <StackItem>
          {/*
           * Not a warning. A reshard is somebody doing something on purpose, and the reason to
           * say it is that everything else on this page is about to be different — a share that
           * looks wrong is a share that is halfway.
           */}
          <Alert
            variant="info"
            isInline
            component="h3"
            title={t('Topology.RESHARDING', { count: moving })}
          >
            {t('Topology.RESHARDING_BODY')}
          </Alert>
        </StackItem>
      ) : null}

      {bare > 0 ? (
        <StackItem>
          <Alert
            variant="warning"
            isInline
            component="h3"
            title={t('Topology.NO_REPLICA', { count: bare })}
          >
            {t('Topology.NO_REPLICA_BODY')}
          </Alert>
        </StackItem>
      ) : null}
    </Stack>
  );
};
