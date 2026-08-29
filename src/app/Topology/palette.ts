import { t_global_color_nonstatus_blue_300 as blue } from '@patternfly/react-tokens/dist/esm/t_global_color_nonstatus_blue_300';
import { t_global_color_nonstatus_green_300 as green } from '@patternfly/react-tokens/dist/esm/t_global_color_nonstatus_green_300';
import { t_global_color_nonstatus_purple_300 as purple } from '@patternfly/react-tokens/dist/esm/t_global_color_nonstatus_purple_300';
import { t_global_color_nonstatus_orange_300 as orange } from '@patternfly/react-tokens/dist/esm/t_global_color_nonstatus_orange_300';
import { t_global_color_nonstatus_teal_300 as teal } from '@patternfly/react-tokens/dist/esm/t_global_color_nonstatus_teal_300';
import { t_global_color_nonstatus_yellow_300 as yellow } from '@patternfly/react-tokens/dist/esm/t_global_color_nonstatus_yellow_300';
import { t_global_color_nonstatus_gray_300 as gray } from '@patternfly/react-tokens/dist/esm/t_global_color_nonstatus_gray_300';
import { t_global_text_color_inverse as inverse } from '@patternfly/react-tokens/dist/esm/t_global_text_color_inverse';
import { t_global_icon_color_subtle as subtleIcon } from '@patternfly/react-tokens/dist/esm/t_global_icon_color_subtle';
import type { ClusterNode } from './types';

/**
 * Distinct colours for consecutive shards, from PatternFly's categorical palette.
 *
 * <p>The "nonstatus" families are what that palette is for: telling one thing from another where
 * the difference carries no meaning of its own. Taken from `@patternfly/react-tokens` rather than
 * written as `var(...)` strings so that a token PatternFly does not define fails the build — the
 * previous set named chart tokens that do not exist in v6, and every colour silently fell through
 * to the hardcoded hex beside it.
 */
const SHARD_COLORS = [blue, green, purple, orange, teal, yellow].map((token) => token.var);

/** For anything that owns no slots, and so belongs to no shard. */
export const NO_SHARD_COLOR = gray.var;

/** Text laid over one of the colours above, which are dark enough to need it. */
export const INVERSE_TEXT = inverse.var;

/** An icon that names something rather than drawing attention to it. */
export const SUBTLE_ICON = subtleIcon.var;

/** The first slot a node serves, which is the order shards are read in. */
const firstSlot = (node: ClusterNode): number => Math.min(...node.slots.map((range) => range.from));

/**
 * Which colour stands for which slot owner.
 *
 * <p>Shared by the slot bar and the graph on purpose: a colour is only a name for a shard, and it
 * is worth nothing if the bar and the picture beside it call the same shard by different names.
 *
 * <p>Handed out in slot order rather than in the order the server listed its nodes, which is not
 * fixed — the same cluster comes back in a different order from one reload to the next, and a
 * shard that changes colour while nothing about it changed is worse than no colour at all.
 */
export const shardColors = (nodes: ClusterNode[]): ReadonlyMap<string, string> =>
  new Map(
    nodes
      .filter((node) => node.slots.length > 0)
      .sort((left, right) => firstSlot(left) - firstSlot(right))
      .map((node, index) => [node.id, SHARD_COLORS[index % SHARD_COLORS.length]] as const),
  );
