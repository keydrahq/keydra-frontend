import type { ServerGroupSummary } from './types';

/** A server group and the groups inside it. */
export interface ServerGroupNode {
  group: ServerGroupSummary;
  children: ServerGroupNode[];
}

/**
 * One row of a rendered tree, with everything PatternFly's tree table needs to place it.
 *
 * <p>The table takes a flat list and is told where each row sits, rather than nested markup —
 * which is also what makes a collapsed subtree cheap: its rows are still there, marked hidden.
 */
export interface ServerGroupRow {
  group: ServerGroupSummary;
  /** 1 for a root, 2 for its children, and so on — PatternFly's `aria-level`. */
  level: number;
  /** Which of its siblings this is, counting from one. */
  position: number;
  /** How many siblings it has. */
  siblings: number;
  childCount: number;
  isExpanded: boolean;
  /** True when an ancestor is collapsed, so the row is present but not shown. */
  isHidden: boolean;
}

/**
 * The groups, arranged by what is inside what.
 *
 * <p>A group whose parent is missing is treated as a root rather than dropped. The parent column
 * has no foreign key — a row can outlive the one it names — and a group nobody can see is worse
 * than one drawn at the top level.
 */
export const toTree = (groups: ServerGroupSummary[]): ServerGroupNode[] => {
  const byId = new Map<number, ServerGroupNode>();
  groups.forEach((group) => byId.set(group.id, { group, children: [] }));

  const roots: ServerGroupNode[] = [];
  byId.forEach((node) => {
    const parent = node.group.parentId === null ? undefined : byId.get(node.group.parentId);
    if (parent && parent !== node) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
};

/**
 * The tree flattened into the order it is drawn, one entry per group.
 *
 * @param collapsed the ids whose children are folded away
 */
export const toRows = (
  nodes: ServerGroupNode[],
  collapsed: number[],
  level = 1,
  parentHidden = false,
): ServerGroupRow[] =>
  nodes.flatMap((node, index) => {
    const isExpanded = !collapsed.includes(node.group.id);
    const row: ServerGroupRow = {
      group: node.group,
      level,
      position: index + 1,
      siblings: nodes.length,
      childCount: node.children.length,
      isExpanded,
      isHidden: parentHidden,
    };
    return [row, ...toRows(node.children, collapsed, level + 1, parentHidden || !isExpanded)];
  });

/**
 * The groups in tree order, each with the names of the groups it sits inside.
 *
 * <p>For places that have to show the hierarchy in a flat list — a filter panel has no tree of
 * its own — where indentation would be a lie about a control that is not nested. A path says the
 * same thing without pretending: `production › test` is unambiguous in a list of checkboxes.
 */
export const toPaths = (
  groups: ServerGroupSummary[],
): { group: ServerGroupSummary; path: string[] }[] => {
  const byId = new Map(groups.map((group) => [group.id, group]));

  const ancestors = (group: ServerGroupSummary): string[] => {
    const names: string[] = [];
    let parent = group.parentId === null ? undefined : byId.get(group.parentId);
    // Bounded by the number of groups: a chain longer than that would have to repeat one,
    // and a cycle here would be a hang rather than a wrong label.
    for (let depth = 0; parent && depth < groups.length; depth += 1) {
      names.unshift(parent.name);
      parent = parent.parentId === null ? undefined : byId.get(parent.parentId);
    }
    return names;
  };

  const walk = (nodes: ServerGroupNode[]): { group: ServerGroupSummary; path: string[] }[] =>
    nodes.flatMap((node) => [
      { group: node.group, path: ancestors(node.group) },
      ...walk(node.children),
    ]);

  return walk(toTree(groups));
};
