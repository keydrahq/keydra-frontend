import type { FC } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

/** What an edge is told about the traffic it carries. */
export interface PacketEdgeData extends Record<string, unknown> {
  /** Messages a second, as measured. Zero means a line that is simply there. */
  rate: number;
  /** True when the thing at the far end is not answering, which is drawn instead of traffic. */
  broken: boolean;
  /** The rate as somebody reads it, or empty when there is nothing to say. */
  label: string;
}

/**
 * How busy an edge is, as one of six levels rather than as the measured number.
 *
 * <p>Levels because the drawing has to hold still while the figure moves. An SVG animation restarts
 * whenever its duration changes, and a duration read straight off the rate was a different number
 * every five seconds — 0.67 s, then 0.70 s, then 0.65 s — so every refetch snapped every dot back to
 * the start of its line. Nothing about the traffic had changed; only the fourth digit of it had.
 *
 * <p>Rounded into levels, an edge that stays busy keeps exactly the animation it already had, and
 * the picture only changes when the traffic actually did. The rate itself is still printed beside
 * the line, which is where a number belongs.
 *
 * <p>Both ends are capped for the same reason they always were: past a point more dots is a solid
 * line and a faster one is a blur, and an edge at two hundred a second and one at two thousand
 * should look busy rather than different.
 */
const LEVELS = [1, 4, 15, 60, 250];
const PACKETS = [1, 2, 3, 4, 5, 6];
const SECONDS = [3, 2.2, 1.6, 1.1, 0.8, 0.6];

const levelOf = (rate: number): number => LEVELS.filter((least) => rate >= least).length;

/**
 * Below this an edge is drawn as a line rather than as traffic.
 *
 * <p>The same floor the label uses: a rate too small to print is a rate too small to draw, and a
 * dot creeping along a line once every ten seconds says "something is wrong here" when the answer
 * is "almost nothing is happening here".
 */
const ENOUGH = 0.1;

/**
 * An edge with the traffic drawn on it.
 *
 * <p>Dots that travel the path, which is the thing a dashed line only gestures at: a dashed line
 * says "something is happening here", and a dot leaving one node and arriving at another says what
 * and in which direction. Every dot on this page is a measured message — the notification bus
 * counts what it publishes, the engine counts every command it sends — so an edge at rest is an
 * edge nothing is going through rather than one nobody wired up.
 *
 * <p>SVG's own {@code animateMotion} rather than a JavaScript loop. The browser runs it on the
 * compositor, so a graph with a hundred dots on it costs no frames and keeps moving while React is
 * busy doing something else — which, on a page that refetches every five seconds, it regularly is.
 */
export const PacketEdge: FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}) => {
  const traffic = (data ?? {}) as PacketEdgeData;
  /*
   * A curve rather than the right angles of a step path. The dependencies are on a ring, so an edge
   * leaves the middle heading outwards and arrives pointing inwards; a path that insists on
   * horizontal and vertical runs draws a staircase across a picture that has no grid in it.
   */
  const [path, labelX, labelY] = getBezierPath({
    // Whole pixels, so the path is the same string it was a moment ago. React Flow measures the
    // cards, and a measurement that lands a fraction of a pixel from the last one would otherwise
    // hand every dot a new path to follow — which, to the browser, is a new animation.
    sourceX: Math.round(sourceX),
    sourceY: Math.round(sourceY),
    sourcePosition,
    targetX: Math.round(targetX),
    targetY: Math.round(targetY),
    targetPosition,
  });

  const level = levelOf(traffic.rate);
  const moving = !traffic.broken && traffic.rate >= ENOUGH;
  const packets = moving ? PACKETS[level] : 0;
  const seconds = SECONDS[level];

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        className={
          traffic.broken ? 'keydra-flow__edge keydra-flow__edge--broken' : 'keydra-flow__edge'
        }
      />

      {/*
       * A broken link is drawn as a break rather than as traffic: nothing is flowing, and dots on
       * it would say the opposite of what is true. The line itself carries that, in red and
       * dashed, from the stylesheet.
       */}
      {Array.from({ length: packets }, (_unused, index) => (
        <circle key={index} r="3" className="keydra-flow__packet">
          <animateMotion
            dur={`${seconds}s`}
            repeatCount="indefinite"
            path={path}
            // Spread across the path rather than released together, so a busy edge reads as a
            // stream and not as a pulse.
            begin={`${((index * seconds) / Math.max(packets, 1)).toFixed(2)}s`}
          />
        </circle>
      ))}

      {traffic.label ? (
        <EdgeLabelRenderer>
          <div
            className="keydra-flow__rate"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {traffic.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
};
