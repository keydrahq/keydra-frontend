import type { FC } from 'react';
import { Tooltip } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { shardColors } from './palette';
import { TOTAL_SLOTS } from './types';
import type { ClusterNode } from './types';

export interface SlotBarProps {
  nodes: ClusterNode[];
}

/**
 * The whole keyspace as one bar, coloured by which node serves each part.
 *
 * <p>The question a cluster raises is not "which nodes exist" — the table below says that — but
 * "is anything unserved, and is the load spread evenly". Both are visible at a glance here and in
 * neither a list nor a diagram of boxes: a gap in the bar is a gap in the keyspace.
 */
export const SlotBar: FC<SlotBarProps> = ({ nodes }) => {
  const { t } = useTranslation();

  // Only primaries serve slots; a replica's are its primary's. The colours come from the
  // shared palette so that a shard is the same colour here and in the graph above.
  const colors = shardColors(nodes);
  const owners = nodes
    .filter((node) => node.slots.length > 0)
    .flatMap((node) => node.slots.map((range) => ({ node, range, color: colors.get(node.id) })))
    .sort((left, right) => left.range.from - right.range.from);

  return (
    <div
      className="keydra-slots"
      role="img"
      aria-label={t('Topology.SLOT_BAR_LABEL', { total: TOTAL_SLOTS })}
    >
      {owners.map(({ node, range, color }) => (
        <Tooltip
          key={`${node.id}-${range.from}`}
          content={t('Topology.SLOT_RANGE', {
            address: node.address,
            from: range.from,
            to: range.to,
            count: range.to - range.from + 1,
          })}
        >
          <span
            className="keydra-slots__segment"
            style={{
              // Width is the share of the keyspace, so the bar is the distribution.
              inlineSize: `${((range.to - range.from + 1) / TOTAL_SLOTS) * 100}%`,
              background: color,
            }}
          />
        </Tooltip>
      ))}
    </div>
  );
};
