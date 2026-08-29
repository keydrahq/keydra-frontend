import type { FC } from 'react';
import './loginBackdrop.css';

/**
 * One circle in the cluster.
 *
 * @param cx centre, in the 100×100 space the whole motif is drawn in
 * @param r radius, same space
 * @param fill how it is drawn: solid, outlined, or filled with the dot pattern
 * @param drift which of the three drift animations it takes, so neighbours never move together
 */
interface Node {
  cx: number;
  cy: number;
  r: number;
  fill: 'solid' | 'outline' | 'dotted';
  drift: 1 | 2 | 3;
}

/**
 * The cluster, written down rather than generated.
 *
 * <p>Random placement would have to be drawn somewhere React guarantees to run once, and all it
 * would buy is that two people's login pages differ in a way neither can see. Composition is not
 * something to leave to a random number: the large solid circle anchors the corner, the outlined
 * ones open the shape outward, and the small ones carry it up and left so the cluster reads as
 * something arriving rather than a pile in a corner.
 *
 * <p>Three sizes and three treatments, deliberately uneven. A grid of equal circles is a texture; a
 * few large ones among many small is a group of things.
 */
const NODES: Node[] = [
  { cx: 78, cy: 82, r: 11, fill: 'solid', drift: 1 },
  { cx: 93, cy: 90, r: 8, fill: 'outline', drift: 2 },
  { cx: 84, cy: 97, r: 6.5, fill: 'dotted', drift: 3 },
  { cx: 66, cy: 92, r: 3.6, fill: 'solid', drift: 2 },
  { cx: 96, cy: 74, r: 2.6, fill: 'solid', drift: 3 },
  { cx: 90, cy: 66, r: 4.4, fill: 'outline', drift: 1 },
  { cx: 72, cy: 71, r: 3.2, fill: 'dotted', drift: 2 },
  { cx: 62, cy: 79, r: 1.7, fill: 'solid', drift: 3 },
  { cx: 80, cy: 58, r: 2, fill: 'outline', drift: 2 },
  { cx: 56, cy: 89, r: 2.3, fill: 'dotted', drift: 1 },
  { cx: 98, cy: 57, r: 1.3, fill: 'solid', drift: 1 },
  { cx: 69, cy: 62, r: 1.2, fill: 'solid', drift: 3 },
];

/**
 * The threads between them.
 *
 * <p>Short, and only between circles that are already neighbours. A line across the cluster is a
 * scribble; a line between two touching circles is a joint. What they say is that these belong
 * together — which is what a console for a fleet of servers is about, said quietly enough that
 * nobody has to work it out.
 */
const THREADS: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 2],
  [0, 6],
  [5, 4],
  [6, 5],
  [3, 7],
  [8, 5],
];

/**
 * The login page's background.
 *
 * <p>A cluster of circles in the corner, in the brand's own idiom: some solid, some outlined, some
 * filled with a dot pattern, a few threaded together. It is PatternFly's motif rather than an
 * invention, which is the point — Keydra follows Red Hat's design language everywhere else, and a
 * sign-in page is where somebody forms their first impression of which language it speaks.
 *
 * <p>Two attempts came before it and both were legible: a stream of real commands, then traffic
 * crossing to a fleet of targets. Being legible was what was wrong with them — the eye went to the
 * background, and on a sign-in page the one thing worth looking at is the form. There is nothing to
 * read here.
 *
 * <p>Anchored to the bottom-right and drawn from a 100×100 space, so it holds its composition from
 * a laptop to a wall rather than stretching. It moves, slowly: each circle drifts on one of three
 * long cycles that share no common factor, so the arrangement never returns to one the eye has
 * already seen.
 *
 * <p>Inline SVG rather than an image handed to PatternFly as `backgroundImgSrc`. That is not a
 * preference — an image loaded as a CSS background is rendered as a still, so anything animated in
 * it never runs.
 */
export const LoginBackdrop: FC = () => (
  <div className="keydra-backdrop" aria-hidden="true">
    <svg
      className="keydra-backdrop__motif"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMaxYMax slice"
      focusable="false"
    >
      <defs>
        {/*
         * The halftone fill. A pattern rather than drawn dots: one definition, however many
         * circles use it, and the browser tiles it without a node per dot.
         */}
        <pattern id="keydra-dots" width="2.2" height="2.2" patternUnits="userSpaceOnUse">
          <circle cx="1.1" cy="1.1" r="0.42" className="keydra-backdrop__dot" />
        </pattern>
      </defs>

      {/* Threads under the circles, so a solid one covers the join rather than showing a seam. */}
      <g className="keydra-backdrop__threads">
        {THREADS.map(([from, to]) => (
          <line
            key={`${from}-${to}`}
            x1={NODES[from].cx}
            y1={NODES[from].cy}
            x2={NODES[to].cx}
            y2={NODES[to].cy}
          />
        ))}
      </g>

      {NODES.map((node) => (
        <circle
          key={`${node.cx}-${node.cy}-${node.r}`}
          cx={node.cx}
          cy={node.cy}
          r={node.r}
          className={`keydra-backdrop__node keydra-backdrop__node--${node.fill} keydra-backdrop__node--drift-${node.drift}`}
          fill={node.fill === 'dotted' ? 'url(#keydra-dots)' : undefined}
        />
      ))}
    </svg>
  </div>
);
