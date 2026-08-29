import type { ComponentType, FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import type { Edge, Node, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '@app/Topology/clusterGraph.css';
import './instanceGraph.css';
import { Card, CardBody, Content, Flex, FlexItem, Label, Timestamp } from '@patternfly/react-core';
import {
  BellIcon,
  ClusterIcon,
  DatabaseIcon,
  EnvelopeIcon,
  KeyIcon,
  MonitoringIcon,
  NetworkIcon,
  OutlinedEyeIcon,
  OutlinedHddIcon,
  ServerIcon,
  StorageDomainIcon,
} from '@patternfly/react-icons';
import type { SVGIconProps } from '@patternfly/react-icons/dist/esm/createIcon';
import { useTranslation } from 'react-i18next';
import { dependencyKind, dependencyName } from './dependencyText';
import type { DependencyState, InstanceSummary } from './queries';
import { PacketEdge } from './PacketEdge';
import { formatRate } from './traffic';
import type { BusRate } from './traffic';

export interface InstanceGraphProps {
  instances: InstanceSummary[];
  dependencies: DependencyState[];
  rates: Map<string, BusRate>;
  height: number;
}

/**
 * How far out the ring of dependencies sits, and how far apart two instances are.
 *
 * <p>A ring rather than rows, and that is the whole layout: what an installation reaches is a set of
 * things one process talks to, not a hierarchy, and rows of cards under a card is a picture that
 * says one of them is above the others. Arranged around the middle, nothing is first.
 *
 * <p>An ellipse rather than a circle because a browser window is wider than it is tall, and a circle
 * drawn in a wide frame is a circle with two empty margins.
 */
const RADIUS_X = 520;
const RADIUS_Y = 300;
const INSTANCE_GAP = 300;

/**
 * Roughly how big a card is.
 *
 * <p>Only used to turn a point on the ring into a top-left corner, which is what React Flow
 * positions by. Approximate on purpose: the cards are not all the same height, and being a few
 * pixels out is invisible while measuring every one of them first would mean laying out twice.
 */
const NODE_W = 216;
const NODE_H = 128;
const INSTANCE_W = 240;

/** Room left around the picture when it is fitted, as a share of the canvas. */
const FIT_PADDING = 0.16;

/** More nodes than this and a minimap starts earning its corner. */
const MINIMAP_FROM = 8;

interface KeydraNodeData extends Record<string, unknown> {
  id: string;
  version: string;
  commit: string | null;
  lastSeenAt: string;
  leader: boolean;
  self: boolean;
}

interface RestNodeData extends Record<string, unknown> {
  /** The stable id, which is what the icon and the translated name are looked up by. */
  id: string;
  name: string;
  kind: string;
  configured: boolean;
  reachable: boolean;
  count: number;
  healthy: number;
}

type KeydraNode = Node<KeydraNodeData, 'keydra'>;
type RestNode = Node<RestNodeData, 'rest'>;
type GraphNode = KeydraNode | RestNode;

/**
 * Which of these is the bus, and which is the fleet.
 *
 * <p>Matched by the stable id, which is the one thing this file and the backend have to agree
 * about. It used to be the English display name, which meant agreeing about a sentence — and made
 * the agreement break the moment the sentence was translated. Getting it wrong costs an edge that
 * does not animate, not a wrong picture.
 */
const BUS = 'shared-store';
const TARGETS = 'targets';

/**
 * An icon per kind of thing.
 *
 * <p>Not decoration: with ten cards around a ring, the icon is what somebody finds one by before
 * they have read any of them. Matched on the id, and anything unmatched gets the plain one rather
 * than a wrong one.
 */
const ICONS: Record<string, ComponentType<SVGIconProps>> = {
  database: DatabaseIcon,
  'shared-store': StorageDomainIcon,
  'metrics-history': MonitoringIcon,
  'identity-providers': KeyIcon,
  'backup-destinations': OutlinedHddIcon,
  'alert-channels': BellIcon,
  mail: EnvelopeIcon,
  'ssh-tunnels': NetworkIcon,
  targets: ServerIcon,
  observability: OutlinedEyeIcon,
};

/** One running Keydra: the subject the rest of the picture is arranged around. */
const KeydraCard = memo(({ data }: NodeProps<KeydraNode>) => {
  const { t } = useTranslation();
  return (
    <>
      {/* Four joins, one per side, so an edge leaves towards wherever it is going. */}
      <Handle id="t" type="source" position={Position.Top} isConnectable={false} />
      <Handle id="r" type="source" position={Position.Right} isConnectable={false} />
      <Handle id="b" type="source" position={Position.Bottom} isConnectable={false} />
      <Handle id="l" type="source" position={Position.Left} isConnectable={false} />
      <Card
        isCompact
        className={`keydra-flow__node keydra-flow__node--instance ${
          data.leader ? 'keydra-flow__node--leader' : 'keydra-flow__node--quiet'
        }`}
      >
        <CardBody>
          <Flex
            direction={{ default: 'column' }}
            gap={{ default: 'gapXs' }}
            alignItems={{ default: 'alignItemsFlexStart' }}
          >
            <FlexItem>
              <Flex gap={{ default: 'gapXs' }} alignItems={{ default: 'alignItemsCenter' }}>
                <ClusterIcon />
                <Label isCompact color={data.leader ? 'blue' : 'grey'}>
                  {t(data.leader ? 'Instances.LEADER' : 'Instances.FOLLOWER')}
                </Label>
                {data.self ? (
                  <Label isCompact variant="outline">
                    {t('Instances.THIS_ONE')}
                  </Label>
                ) : null}
              </Flex>
            </FlexItem>
            <FlexItem className="keydra-flow__id">{data.id}</FlexItem>
            <FlexItem>
              <Content component="small">
                {data.version}
                {data.commit ? ` · ${data.commit}` : ''}
              </Content>
            </FlexItem>
            <FlexItem>
              <Content component="small">
                {t('Instances.LAST_SEEN')}{' '}
                <Timestamp date={new Date(data.lastSeenAt)} dateFormat="short" timeFormat="short" />
              </Content>
            </FlexItem>
          </Flex>
        </CardBody>
      </Card>
    </>
  );
});
KeydraCard.displayName = 'KeydraCard';

/** Something the instances reach. */
const RestCard = memo(({ data }: NodeProps<RestNode>) => {
  const { t } = useTranslation();
  const Icon = ICONS[data.id] ?? ServerIcon;
  const state = !data.configured ? 'quiet' : data.reachable ? 'ok' : 'bad';
  return (
    <>
      <Handle id="t" type="target" position={Position.Top} isConnectable={false} />
      <Handle id="r" type="target" position={Position.Right} isConnectable={false} />
      <Handle id="b" type="target" position={Position.Bottom} isConnectable={false} />
      <Handle id="l" type="target" position={Position.Left} isConnectable={false} />
      <Card isCompact className={`keydra-flow__node keydra-flow__node--${state}`}>
        <CardBody>
          <Flex
            direction={{ default: 'column' }}
            gap={{ default: 'gapXs' }}
            alignItems={{ default: 'alignItemsFlexStart' }}
          >
            <FlexItem>
              <Flex gap={{ default: 'gapXs' }} alignItems={{ default: 'alignItemsCenter' }}>
                <Icon />
                <span>{dependencyName(data, t)}</span>
              </Flex>
            </FlexItem>
            <FlexItem>
              <Content component="small">{dependencyKind(data, t)}</Content>
            </FlexItem>
            {/*
             * The count only where there is more than one. "1 of 1 in good order" is a sentence
             * nobody needed; "9 of 10" is the one somebody opened the page for.
             */}
            {data.count > 1 ? (
              <FlexItem>
                <Content component="small">
                  {t('Instances.OF_MANY', { healthy: data.healthy, count: data.count })}
                </Content>
              </FlexItem>
            ) : null}
            {!data.configured ? (
              <FlexItem>
                <Label isCompact color="grey">
                  {t('Instances.NOT_CONFIGURED')}
                </Label>
              </FlexItem>
            ) : !data.reachable ? (
              <FlexItem>
                <Label isCompact color="red" status="danger">
                  {t('Instances.UNREACHABLE')}
                </Label>
              </FlexItem>
            ) : null}
          </Flex>
        </CardBody>
      </Card>
    </>
  );
});
RestCard.displayName = 'RestCard';

const NODE_TYPES = { keydra: KeydraCard, rest: RestCard };
const EDGE_TYPES = { packet: PacketEdge };

const NOTHING: BusRate = { published: 0, received: 0, commands: 0 };

/**
 * Which side of a card an edge should leave and arrive on, given where the two are.
 *
 * <p>Worked out rather than fixed, because the dependencies are on a ring: an edge to the card
 * directly above should leave the top and one to the card on the right should leave the right, and
 * an edge that always left the bottom would loop around half the picture to get there.
 */
const sidesFor = (dx: number, dy: number): [string, string] =>
  Math.abs(dx) > Math.abs(dy)
    ? dx > 0
      ? ['r', 'l']
      : ['l', 'r']
    : dy > 0
      ? ['b', 't']
      : ['t', 'b'];

/** What the minimap paints a node, which has to say the same thing the card does. */
const miniColour = (node: GraphNode): string => {
  if (node.type === 'keydra') {
    return node.data.leader
      ? 'var(--pf-t--global--color--brand--default)'
      : 'var(--pf-t--global--border--color--default)';
  }
  if (!node.data.configured) {
    return 'var(--pf-t--global--border--color--default)';
  }
  return node.data.reachable
    ? 'var(--pf-t--global--color--status--success--default)'
    : 'var(--pf-t--global--color--status--danger--default)';
};

/**
 * Keydra's own shape, with its own traffic on it.
 *
 * <p>The instances in the middle and everything they reach on a ring around them, because that is
 * what the arrangement is: a set of things one process talks to, none of them above the others. The
 * drawing this replaced was rows under rows, which is a picture of a hierarchy that does not exist.
 *
 * <p>Every dot travelling an edge is a measured message. The notification bus counts what it
 * publishes and takes off — that is the only conversation instances have with each other, since two
 * Keydras never connect directly — and the engine counts every command it sends to a target. An
 * edge at rest is an edge nothing is going through, rather than one nobody wired up.
 *
 * <p>The colour is a verdict here rather than a name, which is why it is a ring around a card
 * instead of a stripe beside one. The cluster graph does the opposite, and for the opposite reason.
 */
const Graph: FC<InstanceGraphProps> = ({ instances, dependencies, rates, height }) => {
  const { t } = useTranslation();

  const howMany = instances.length;
  const howManyReached = dependencies.length;

  /*
   * Where everything sits, which depends on how many things there are and on nothing else.
   *
   * <p>Worked out apart from the cards and the lines because both need it and neither should be
   * rebuilt when the other changes. A rate that moved is a reason to redraw a line; it is not a
   * reason to re-place a card.
   */
  const places = useMemo(
    () => ({
      middles: Array.from(
        { length: howMany },
        (_one, index) => index * INSTANCE_GAP - ((howMany - 1) * INSTANCE_GAP) / 2,
      ),
      // Around the ring, starting at the top and going clockwise.
      ring: Array.from({ length: howManyReached }, (_one, index) => {
        const angle = (index / howManyReached) * Math.PI * 2 - Math.PI / 2;
        return { x: Math.cos(angle) * RADIUS_X, y: Math.sin(angle) * RADIUS_Y };
      }),
    }),
    [howMany, howManyReached],
  );

  const laidOut = useMemo(() => {
    const built: GraphNode[] = [];

    instances.forEach((instance, index) => {
      built.push({
        id: `keydra-${instance.id}`,
        type: 'keydra',
        position: { x: places.middles[index] - INSTANCE_W / 2, y: -NODE_H / 2 },
        // Stated as well as measured: the minimap draws nodes whose size it knows, and a card
        // that has not been measured yet — or has just been handed over as a fresh object — is a
        // card it silently leaves out.
        initialWidth: INSTANCE_W,
        initialHeight: NODE_H,
        data: {
          id: instance.id,
          version: instance.version,
          commit: instance.commit,
          lastSeenAt: instance.lastSeenAt,
          leader: instance.leader,
          self: instance.self,
        },
      });
    });

    dependencies.forEach((dependency, index) => {
      const { x, y } = places.ring[index];
      built.push({
        id: `rest-${dependency.id}`,
        type: 'rest',
        position: { x: x - NODE_W / 2, y: y - NODE_H / 2 },
        initialWidth: NODE_W,
        initialHeight: NODE_H,
        data: {
          id: dependency.id,
          name: dependency.name,
          kind: dependency.kind,
          configured: dependency.configured,
          reachable: dependency.reachable,
          count: dependency.count,
          healthy: dependency.healthy,
        },
      });
    });

    return built;
  }, [instances, dependencies, places]);

  const flowEdges = useMemo(() => {
    const edges: Edge[] = [];

    dependencies.forEach((dependency, index) => {
      const { x, y } = places.ring[index];
      const broken = dependency.configured && !dependency.reachable;

      instances.forEach((instance, column) => {
        const rate = rates.get(instance.id) ?? NOTHING;
        /*
         * Two edges carry measured traffic and the rest are links. The bus is how instances reach
         * each other; the targets are what Keydra is for. Everything else — the database, the mail
         * server, a backup destination — is reached when something happens rather than
         * continuously, so a dot on it would be an invention.
         */
        const carried =
          dependency.id === BUS
            ? rate.published + rate.received
            : dependency.id === TARGETS
              ? rate.commands
              : 0;

        const [from, to] = sidesFor(x - places.middles[column], y);
        edges.push({
          id: `${instance.id}--${dependency.id}`,
          source: `keydra-${instance.id}`,
          sourceHandle: from,
          target: `rest-${dependency.id}`,
          targetHandle: to,
          type: 'packet',
          data: { rate: carried, broken, label: formatRate(carried) },
        });
      });
    });

    return edges;
  }, [instances, dependencies, places, rates]);

  /*
   * Handed to React Flow as its own state, and merged rather than replaced.
   *
   * <p>Because React Flow writes what it measured back onto the node objects it was given, and this
   * page hands it new ones every five seconds — a card says when its instance was last heard from,
   * which is a different sentence every beat. Replacing the array outright throws those
   * measurements away, and nothing measures the cards again since none of them actually changed
   * size, so the picture would spend its life on the stated sizes above rather than the real ones.
   */
  const [flowNodes, setNodes] = useNodesState<GraphNode>([]);
  useEffect(() => {
    setNodes((current) => {
      const measured = new Map(current.map((node) => [node.id, node]));
      return laidOut.map((node) => {
        const before = measured.get(node.id);
        return before ? ({ ...before, ...node } as GraphNode) : node;
      });
    });
  }, [laidOut, setNodes]);

  /** The whole installation's traffic, which is what the corner reports. */
  const total = useMemo(() => {
    let bus = 0;
    let commands = 0;
    for (const rate of rates.values()) {
      bus += rate.published + rate.received;
      commands += rate.commands;
    }
    return { bus, commands };
  }, [rates]);

  /*
   * Fitted again whenever the canvas changes size — the application's own navigation can be
   * collapsed, and the window can be anything. A fit computed once is a fit against a width that
   * has since changed.
   */
  const canvas = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();
  const refit = useCallback(() => void fitView({ padding: FIT_PADDING }), [fitView]);
  useEffect(() => {
    const element = canvas.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(refit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [refit]);

  return (
    <div ref={canvas} className="keydra-graph keydra-flow" style={{ height }}>
      <ReactFlow<GraphNode>
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        fitView
        fitViewOptions={{ padding: FIT_PADDING }}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        proOptions={{ hideAttribution: true }}
        aria-label={t('Instances.GRAPH')}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls showInteractive={false} />
        {/* Only once there is enough to get lost in. */}
        {flowNodes.length >= MINIMAP_FROM ? (
          <MiniMap pannable zoomable nodeColor={miniColour} nodeStrokeWidth={0} />
        ) : null}
        {/*
         * The two numbers the dots are drawn from, written out.
         *
         * <p>Because an animation is a feeling and a number is a fact: somebody watching dots move
         * can tell that something is happening, and only the figure tells them whether it is four
         * a second or four hundred.
         */}
        <Panel position="top-left" className="keydra-flow__meter">
          <div className="keydra-flow__meter-title">{t('Instances.LIVE_TRAFFIC')}</div>
          <dl>
            <dt>{t('Instances.TARGET_COMMANDS')}</dt>
            <dd>{formatRate(total.commands) || t('Instances.IDLE')}</dd>
            <dt>{t('Instances.BUS_MESSAGES')}</dt>
            <dd>{formatRate(total.bus) || t('Instances.IDLE')}</dd>
          </dl>
        </Panel>
      </ReactFlow>
    </div>
  );
};

/** The graph, with the provider React Flow's hooks need above it. */
export const InstanceGraph: FC<InstanceGraphProps> = (props) => (
  <ReactFlowProvider>
    <Graph {...props} />
  </ReactFlowProvider>
);
