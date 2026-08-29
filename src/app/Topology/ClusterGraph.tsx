import type { CSSProperties, FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import type { Edge, Node, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './clusterGraph.css';
import {
  Card,
  CardBody,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Drawer,
  DrawerActions,
  DrawerCloseButton,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerPanelContent,
  Flex,
  FlexItem,
  Label,
  LabelGroup,
  Title,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { NO_SHARD_COLOR, shardColors } from './palette';
import type { ClusterNode, SentinelMaster } from './types';
import { TOTAL_SLOTS, slotCount } from './types';

export interface ClusterGraphProps {
  nodes: ClusterNode[];
  sentinelMasters: SentinelMaster[];
  height: number;
}

/**
 * How far apart two shards are drawn, and how far a replica sits under its primary.
 *
 * <p>Positions are computed here rather than by a layout engine, and that is a choice the shape of
 * this data earns: a cluster is a row of shards, each a primary with the replicas that follow it.
 * There is no routing problem to solve. Computing it directly makes the picture identical on every
 * reload — which dagre also managed — and removes the whole class of bug where a layout moves a
 * group without moving the edges drawn inside it.
 */
const SHARD_GAP = 288;
const ROW_GAP = 148;

/** Room left around the picture when it is fitted, as a share of the canvas. */
const FIT_PADDING = 0.2;

/** What a node's card is given, beyond where it sits. */
interface ShardData extends Record<string, unknown> {
  address: string;
  /** The shard's colour, or grey for anything that serves no slots. */
  color: string;
  /** Slot ranges as a sentence, or undefined for a node that owns none. */
  ranges?: string;
  /** The share of the keyspace this shard serves, already rounded. */
  share?: number;
  state: string;
  tone: 'green' | 'orange' | 'red';
  /** True for the node Keydra is talking to, which is the one whose answers this all is. */
  isSelf: boolean;
}

/** What a replica's card is given. */
interface FollowerData extends Record<string, unknown> {
  address: string;
  color: string;
  state: string;
  tone: 'green' | 'orange' | 'red';
  isSelf: boolean;
}

type ShardNode = Node<ShardData, 'shard'>;
type FollowerNode = Node<FollowerData, 'follower'>;
type GraphNode = ShardNode | FollowerNode;

/**
 * A node's health, in the cluster's own words.
 *
 * <p>Taken from what the cluster reports about the node rather than from whether Keydra can reach
 * it: what a topology answers is whether the *cluster* thinks a node is there.
 */
const toneOf = (node: ClusterNode): FollowerData['tone'] => {
  if (node.flags.includes('fail') || node.flags.includes('fail?')) {
    return 'red';
  }
  return node.linkState === 'connected' ? 'green' : 'orange';
};

/** Slot ranges as somebody would read them out. */
const rangesOf = (node: ClusterNode): string | undefined =>
  node.slots.length === 0
    ? undefined
    : node.slots.map((range) => `${range.from}–${range.to}`).join(', ');

/**
 * The card every node in the graph is drawn as.
 *
 * <p>A card rather than a shape with a label under it, which is what PatternFly's own React Flow
 * guide reaches for and what makes the difference here: the facts a person opens a topology to
 * find — which address, serving which slots, and is it healthy — are on the node itself instead of
 * one click away. The shape used to carry the role and nothing else, so the picture said less than
 * the table underneath it.
 */
const NodeCard: FC<{
  address: string;
  color: string;
  role: string;
  state: string;
  tone: FollowerData['tone'];
  ranges?: string;
  share?: number;
  isCompact?: boolean;
  isSelf?: boolean;
}> = ({ address, color, role, state, tone, ranges, share, isCompact, isSelf }) => {
  const { t } = useTranslation();
  return (
    <Card
      isCompact
      className="keydra-graph__node keydra-graph__node--accented"
      style={{ '--keydra-shard-color': color } as CSSProperties}
    >
      <CardBody>
        <Flex
          direction={{ default: 'column' }}
          gap={{ default: 'gapXs' }}
          alignItems={{ default: 'alignItemsFlexStart' }}
        >
          <FlexItem>
            <Flex gap={{ default: 'gapXs' }} alignItems={{ default: 'alignItemsCenter' }}>
              <Label isCompact color={isCompact ? 'grey' : 'blue'}>
                {role}
              </Label>
              <Label isCompact color={tone} variant="outline">
                {state}
              </Label>
            </Flex>
          </FlexItem>
          <FlexItem className="keydra-graph__address">{address}</FlexItem>
          {/*
           * Which node answered. Everything on this page is one node's account of the cluster, and
           * knowing whose account it is matters when two nodes disagree — which is exactly the
           * situation somebody opens a topology in.
           */}
          {isSelf ? (
            <FlexItem>
              <Label isCompact variant="outline">
                {t('Topology.THIS_NODE')}
              </Label>
            </FlexItem>
          ) : null}
          {ranges !== undefined && (
            <FlexItem>
              <Content component="small">{ranges}</Content>
            </FlexItem>
          )}
          {share !== undefined && (
            <FlexItem>
              <Content component="small">{share}%</Content>
            </FlexItem>
          )}
        </Flex>
      </CardBody>
    </Card>
  );
};

/**
 * A primary, or a sentinel's master: the node that serves.
 *
 * <p>Memoised because React Flow re-renders every node on a pan, and a card is more than a shape.
 */
const ShardCard = memo(({ data }: NodeProps<ShardNode>) => {
  const { t } = useTranslation();
  return (
    <>
      <NodeCard
        address={data.address}
        color={data.color}
        role={t('Topology.ROLE_PRIMARY')}
        state={data.state}
        tone={data.tone}
        ranges={data.ranges}
        share={data.share}
        isSelf={data.isSelf}
      />
      {/*
       * Three joins, none of them drawn — see the stylesheet. A replica hangs below; a slot on
       * the move leaves one shard's right side and arrives at another's left, which is the
       * direction the shards are laid out in and so the shortest thing to look at.
       */}
      <Handle id="down" type="source" position={Position.Bottom} isConnectable={false} />
      <Handle id="out" type="source" position={Position.Right} isConnectable={false} />
      <Handle id="in" type="target" position={Position.Left} isConnectable={false} />
    </>
  );
});
ShardCard.displayName = 'ShardCard';

/** A replica, drawn quieter than what it follows because that is what it is. */
const FollowerCard = memo(({ data }: NodeProps<FollowerNode>) => {
  const { t } = useTranslation();
  return (
    <>
      <Handle id="up" type="target" position={Position.Top} isConnectable={false} />
      <NodeCard
        address={data.address}
        color={data.color}
        role={t('Topology.ROLE_REPLICA')}
        state={data.state}
        tone={data.tone}
        isCompact
        isSelf={data.isSelf}
      />
    </>
  );
});
FollowerCard.displayName = 'FollowerCard';

const NODE_TYPES = { shard: ShardCard, follower: FollowerCard };

/**
 * The cluster as a picture.
 *
 * <p>A table of nodes says what is there; a graph says how it is arranged, which is the question a
 * topology view is opened to answer. Each shard is a primary card with its replicas beneath it,
 * joined by an edge, and the shard's colour — the same one the slot bar uses — runs down the side
 * of its cards. A primary with no replica is visibly alone, which is worth seeing.
 *
 * <p>Drawn with React Flow, wearing PatternFly's tokens: that pairing is PatternFly's own
 * recommendation, and it replaced a set of flat shapes that carried a label and nothing else. What
 * this file decides is what a node means here and where it goes; the panning, the zooming and the
 * keyboard handling are the library's.
 *
 * <p>No group boxes. The previous drawing put every shard in a box and all the boxes in another
 * one, which is a lot of frame around three cards — an edge from a primary to the replicas under
 * it already says "these belong together", and it says it without a layout engine having to move a
 * box and the lines inside it in step.
 */
const Graph: FC<ClusterGraphProps> = ({ nodes, sentinelMasters, height }) => {
  const { t } = useTranslation();
  /** Which node the reader has asked about. The whole point of selecting one. */
  const [inspecting, setInspecting] = useState<string | undefined>();

  const { flowNodes, flowEdges } = useMemo(() => {
    const colors = shardColors(nodes);
    const built: GraphNode[] = [];
    const edges: Edge[] = [];

    /** "This follows that": a replica and the primary it copies. */
    const follows = (primary: string, replica: string): Edge => ({
      id: `${primary}--${replica}`,
      source: primary,
      sourceHandle: 'down',
      target: replica,
      targetHandle: 'up',
      type: 'smoothstep',
    });

    /*
     * Slots on the move, drawn as an edge that moves.
     *
     * <p>This is the one thing in a cluster that is happening rather than being, and it is what a
     * graph can show that a table cannot: while a reshard runs, an arrow goes from the shard
     * handing slots over to the shard taking them, labelled with how many are still in flight.
     * Both ends report the same move, so the pair is collapsed into one edge by the id.
     */
    const moves = new Map<string, number>();
    nodes.forEach((node) =>
      node.migrations.forEach((migration) => {
        const [from, to] =
          migration.direction === 'OUT' ? [node.id, migration.peerId] : [migration.peerId, node.id];
        const id = `${from}=>${to}`;
        moves.set(id, (moves.get(id) ?? 0) + 1);
      }),
    );

    // Sorted by the slots they serve, so the cards are drawn in the order the bar beneath them
    // reads, and so the same cluster is drawn the same way on every reload.
    const primaries = nodes
      .filter((node) => node.role === 'primary')
      .sort(
        (left, right) =>
          (left.slots[0]?.from ?? TOTAL_SLOTS) - (right.slots[0]?.from ?? TOTAL_SLOTS),
      );

    primaries.forEach((primary, column) => {
      const color = colors.get(primary.id) ?? NO_SHARD_COLOR;
      const slots = slotCount(primary);
      built.push({
        id: primary.id,
        type: 'shard',
        position: { x: column * SHARD_GAP, y: 0 },
        data: {
          address: primary.address,
          color,
          ranges: rangesOf(primary),
          share: slots === 0 ? undefined : Math.round((slots / TOTAL_SLOTS) * 100),
          state: primary.linkState,
          tone: toneOf(primary),
          isSelf: primary.isSelf,
        },
      });

      nodes
        .filter((node) => node.primaryId === primary.id)
        .forEach((replica, row) => {
          built.push({
            id: replica.id,
            type: 'follower',
            position: { x: column * SHARD_GAP, y: (row + 1) * ROW_GAP },
            data: {
              address: replica.address,
              color,
              state: replica.linkState,
              tone: toneOf(replica),
              isSelf: replica.isSelf,
            },
          });
          edges.push(follows(primary.id, replica.id));
        });
    });

    // A sentinel arrangement has no node ids of its own, so the address is the identity.
    sentinelMasters.forEach((master, column) => {
      const masterId = `sentinel-${master.name}`;
      built.push({
        id: masterId,
        type: 'shard',
        position: { x: (primaries.length + column) * SHARD_GAP, y: 0 },
        data: {
          address: master.address,
          color: NO_SHARD_COLOR,
          ranges: master.name,
          state: master.status,
          tone: master.status.includes('down') ? 'red' : 'green',
          isSelf: false,
        },
      });

      master.replicas.forEach((replica, row) => {
        const replicaId = `${masterId}-${replica.address}`;
        built.push({
          id: replicaId,
          type: 'follower',
          position: { x: (primaries.length + column) * SHARD_GAP, y: (row + 1) * ROW_GAP },
          data: {
            address: replica.address,
            color: NO_SHARD_COLOR,
            state: replica.linkStatus,
            tone:
              replica.linkStatus === 'ok' && !replica.status.includes('down') ? 'green' : 'orange',
            isSelf: false,
          },
        });
        edges.push(follows(masterId, replicaId));
      });
    });

    // Added last so a move is drawn over the shards it runs between, and only for ends the
    // picture actually holds: a peer that has left the cluster is named by a move nobody can draw.
    const drawn = new Set(built.map((node) => node.id));
    moves.forEach((count, id) => {
      const [from, to] = id.split('=>');
      if (!drawn.has(from) || !drawn.has(to)) {
        return;
      }
      edges.push({
        id,
        source: from,
        sourceHandle: 'out',
        target: to,
        targetHandle: 'in',
        type: 'smoothstep',
        animated: true,
        label: String(count),
        className: 'keydra-graph__move',
      });
    });

    return { flowNodes: built, flowEdges: edges };
  }, [nodes, sentinelMasters]);

  /** The node the panel is about, found by the id the selection gave. */
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === inspecting),
    [nodes, inspecting],
  );

  const onNodeClick = useCallback(
    (_event: unknown, node: Node) => setInspecting(node.id),
    [setInspecting],
  );

  /*
   * Fitted again whenever the canvas changes size, which it does more often than it looks: opening
   * the detail panel takes a third of the width away, and so does collapsing the application's own
   * navigation. Without this the picture stays where it was and the node on the right ends up
   * behind the panel that was opened to describe it.
   *
   * An observer rather than an effect keyed on the panel, because the panel animates: a fit
   * computed the moment it was asked for would be a fit against the width it is leaving.
   */
  const canvas = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();
  useEffect(() => {
    const element = canvas.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(() => void fitView({ padding: FIT_PADDING }));
    observer.observe(element);
    return () => observer.disconnect();
  }, [fitView]);

  return (
    <Drawer isExpanded={selectedNode !== undefined} isInline position="end">
      <DrawerContent
        panelContent={
          <DrawerPanelContent widths={{ default: 'width_33' }}>
            <DrawerHead>
              <Title headingLevel="h3" size="md">
                {selectedNode?.address ?? t('Topology.SIDEBAR_NOTHING')}
              </Title>
              <DrawerActions>
                <DrawerCloseButton onClick={() => setInspecting(undefined)} />
              </DrawerActions>
            </DrawerHead>
            {selectedNode ? (
              <DrawerContentBody>
                <NodeDetail node={selectedNode} />
              </DrawerContentBody>
            ) : null}
          </DrawerPanelContent>
        }
      >
        <DrawerContentBody>
          {/*
           * The name goes on the region because the graph's own role is "application", and an
           * application with no accessible name is one a screen reader announces as nothing. The
           * table below the graph carries the same facts for anyone who cannot use the picture.
           */}
          <div ref={canvas} className="keydra-graph" style={{ height }}>
            <ReactFlow<GraphNode>
              nodes={flowNodes}
              edges={flowEdges}
              nodeTypes={NODE_TYPES}
              onNodeClick={onNodeClick}
              fitView
              fitViewOptions={{ padding: FIT_PADDING }}
              // Nothing here is edited by dragging: the arrangement is the server's, and a node
              // somebody moved would be a picture that no longer says where anything is.
              nodesDraggable={false}
              nodesConnectable={false}
              edgesFocusable={false}
              proOptions={{ hideAttribution: true }}
              aria-label={t('Topology.GRAPH')}
            >
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        </DrawerContentBody>
      </DrawerContent>
    </Drawer>
  );
};

/**
 * The graph, with the provider React Flow needs above it.
 *
 * <p>Separated so the graph itself can use the library's hooks if it ever needs to: they only work
 * under the provider, and a component that is its own provider cannot call them.
 */
export const ClusterGraph: FC<ClusterGraphProps> = (props) => (
  <ReactFlowProvider>
    <Graph {...props} />
  </ReactFlowProvider>
);

/**
 * What one node is, beside the picture of where it sits.
 *
 * <p>A topology answers "how is this arranged"; the next question is always "and what is that
 * one". The card in the graph carries what can be read at a glance; this carries the rest — the
 * flags the cluster set on it, and the id nothing else shows.
 */
const NodeDetail: FC<{ node: ClusterNode }> = ({ node }) => {
  const { t } = useTranslation();
  return (
    <DescriptionList isCompact>
      <DescriptionListGroup>
        <DescriptionListTerm>{t('Topology.ROLE')}</DescriptionListTerm>
        <DescriptionListDescription>
          <Label isCompact color={node.role === 'primary' ? 'blue' : 'grey'}>
            {t(node.role === 'primary' ? 'Topology.ROLE_PRIMARY' : 'Topology.ROLE_REPLICA')}
          </Label>
        </DescriptionListDescription>
      </DescriptionListGroup>

      <DescriptionListGroup>
        <DescriptionListTerm>{t('Topology.LINK_STATE')}</DescriptionListTerm>
        <DescriptionListDescription>
          <Label isCompact color={node.linkState === 'connected' ? 'green' : 'red'}>
            {node.linkState}
          </Label>
        </DescriptionListDescription>
      </DescriptionListGroup>

      <DescriptionListGroup>
        <DescriptionListTerm>{t('Topology.SLOTS')}</DescriptionListTerm>
        <DescriptionListDescription>
          {node.slots.length === 0 ? (
            <Content component="small">{t('Topology.SHARD_NO_SLOTS')}</Content>
          ) : (
            node.slots.map((range) => `${range.from}–${range.to}`).join(', ')
          )}
        </DescriptionListDescription>
      </DescriptionListGroup>

      {node.flags.length > 0 && (
        <DescriptionListGroup>
          <DescriptionListTerm>{t('Topology.FLAGS')}</DescriptionListTerm>
          <DescriptionListDescription>
            <LabelGroup numLabels={4}>
              {node.flags.map((flag) => (
                <Label key={flag} isCompact variant="outline">
                  {flag}
                </Label>
              ))}
            </LabelGroup>
          </DescriptionListDescription>
        </DescriptionListGroup>
      )}

      <DescriptionListGroup>
        <DescriptionListTerm>{t('Topology.NODE_ID')}</DescriptionListTerm>
        <DescriptionListDescription>
          <Content component="small">{node.id}</Content>
        </DescriptionListDescription>
      </DescriptionListGroup>
    </DescriptionList>
  );
};
