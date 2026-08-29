import type { FC } from 'react';
import { useContext, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  Breadcrumb,
  BreadcrumbItem,
  Button,
  EmptyState,
  EmptyStateBody,
  HelperText,
  HelperTextItem,
  Spinner,
  Tooltip,
  TreeView,
} from '@patternfly/react-core';
import { SearchIcon, TrashIcon } from '@patternfly/react-icons';
import type { TreeViewDataItem } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { ServiceContext } from '@app/Shared/Services/Services';
import { keysApi } from './api';
import type { NamespaceNode } from './types';

export interface NamespaceTreeProps {
  /** Which keyspace to walk; absent means the one the profile opens in. */
  database?: number;
  /** Asked to clear a namespace. Undefined when the viewer may not delete anything. */
  onPurge?: (prefix: string, keyCount: number, partial: boolean) => void;
  connectionId: number;
  /** Prefix currently filtering the key list, so the tree can show it as selected. */
  selectedPrefix: string;
  onSelect: (prefix: string) => void;
}

/**
 * How many children of one namespace are drawn before the rest are summarised.
 *
 * <p>A level is not necessarily small: `cache:page:` on a real keyspace has a thousand numbered
 * children, and PatternFly's TreeView draws every node it is given. A thousand nodes is several
 * thousand elements, and two such levels open at once is enough to take the tab down — which is
 * how this limit came to be written.
 *
 * <p>The remainder is not hidden: the level says how many more there are, and the search box is
 * the way to reach them.
 */
const MAX_CHILDREN_SHOWN = 200;

/**
 * The namespace separator.
 *
 * <p>The tree endpoint takes one and defaults to a colon; this client never sends another, so the
 * path above the tree splits on the same character the server grouped by.
 */
const DELIMITER = ':';

/**
 * Namespace navigator built from the key delimiter.
 *
 * <p>Levels are fetched as they are expanded. Loading the whole tree up front would mean walking
 * the entire keyspace before drawing anything, which is precisely what the browser exists to
 * avoid.
 *
 * <p>Counts come from a sample of the keyspace rather than a full walk, so they are a floor, not a
 * census — the alternative is scanning every key before drawing a single node.
 */
export const NamespaceTree: FC<NamespaceTreeProps> = ({
  connectionId,
  selectedPrefix,
  onSelect,
  onPurge,
  database,
}) => {
  const { t } = useTranslation();
  const { graphql } = useContext(ServiceContext);
  const [expanded, setExpanded] = useState<string[]>(['']);

  // One query per expanded prefix: an expanded node keeps its children cached,
  // so collapsing and reopening does not re-scan.
  const results = useQueries({
    queries: expanded.map((prefix) => ({
      // The database is part of the key: db 0 and db 3 are different keyspaces, and a
      // cache that could not tell them apart would draw one under the other's heading.
      queryKey: ['keys', connectionId, database ?? 'default', 'tree', prefix],
      queryFn: () => keysApi.tree(graphql, connectionId, prefix, database),
    })),
  });

  const childrenOf = (prefix: string): NamespaceNode[] | undefined => {
    const index = expanded.indexOf(prefix);
    return index === -1 ? undefined : results[index]?.data;
  };

  /**
   * What a node holds, at least.
   *
   * <p>Every level of this tree is its own walk of the keyspace and every walk stops at a sample
   * limit, so a node's own count is a floor rather than a total. Left at that, a parent counted out
   * of the first ten thousand keys of the whole keyspace sat above a child counted out of the first
   * ten thousand under it, and the child showed the larger number — both true of their own sample,
   * and the pair of them impossible to read.
   *
   * <p>A parent is at least the sum of the children already loaded beneath it, because siblings
   * hold disjoint sets of keys. Taking the larger of the two makes the tree read downwards without
   * inventing anything: every number shown is still something the walks actually saw.
   */
  const floorFor = (node: NamespaceNode): { keys: number; partial: boolean } => {
    const children = childrenOf(node.prefix);
    if (!children?.length) {
      return { keys: node.keyCount, partial: node.partial };
    }
    const beneath = children.map(floorFor);
    return {
      keys: Math.max(
        node.keyCount,
        beneath.reduce((total, child) => total + child.keys, 0),
      ),
      // A total resting on any incomplete walk is itself incomplete, however it was arrived at.
      partial: node.partial || beneath.some((child) => child.partial),
    };
  };

  /** Draws a level, replacing everything past the cap with a note saying how much is left. */
  const toItems = (nodes: NamespaceNode[]): TreeViewDataItem[] => {
    const shown = nodes.slice(0, MAX_CHILDREN_SHOWN).map(toItem);
    const hidden = nodes.length - shown.length;
    if (hidden > 0) {
      shown.push({
        name: t('KeyBrowser.TREE_MORE', { count: hidden }),
        id: `__more__${nodes[0]?.prefix ?? ''}`,
        // Not a namespace, so it must not be selectable as one.
        defaultExpanded: false,
      });
    }
    return shown;
  };

  const toItem = (node: NamespaceNode): TreeViewDataItem => {
    const children = childrenOf(node.prefix);
    const floor = floorFor(node);
    return {
      name: node.name,
      id: node.prefix,
      /*
       * A floor is drawn as a floor. Each level of this tree is its own walk of the keyspace and
       * each walk stops at a sample limit, so two levels are two samples of two different
       * populations — which is how a namespace holding 5,814 keys came to sit above a child
       * holding 10,000. Both numbers were true of the sample that produced them, and the pair of
       * them said something impossible.
       */
      customBadgeContent: floor.partial ? (
        <Tooltip content={t('KeyBrowser.TREE_COUNT_PARTIAL')}>
          <span>{t('KeyBrowser.TREE_COUNT_AT_LEAST', { count: floor.keys })}</span>
        </Tooltip>
      ) : (
        t('KeyBrowser.TREE_COUNT', { count: floor.keys })
      ),
      badgeProps: { isRead: true },
      hasBadge: true,
      // Shown on hover and on focus, which is the tree's own affordance for a row's
      // actions: a button on every row at all times would compete with the names.
      action: onPurge ? (
        <Button
          variant="plain"
          aria-label={t('KeyBrowser.PURGE_NAMESPACE', { prefix: node.prefix })}
          icon={<TrashIcon />}
          onClick={(event) => {
            // The row selects the namespace; the button must not also do that.
            event.stopPropagation();
            onPurge(node.prefix, floor.keys, floor.partial);
          }}
        />
      ) : undefined,
      // Undefined children with hasChildren tells TreeView it is expandable but unloaded.
      children: node.hasChildren ? toItems(children ?? []) : undefined,
      defaultExpanded: expanded.includes(node.prefix),
    };
  };

  const roots = childrenOf('');
  const rootQuery = results[expanded.indexOf('')];

  if (rootQuery?.isPending) {
    return <Spinner aria-label={t('KeyBrowser.TREE_LOADING')} size="md" />;
  }

  /*
   * A target with no keys gets a sentence, not a tree.
   *
   * PatternFly's TreeView reaches for its first item as it mounts and throws on an empty
   * one — "Cannot set properties of undefined (setting 'tabIndex')" — and because that
   * happens in componentDidMount, React unmounts the whole page and the browser shows
   * nothing at all. A new target, or one whose keys have all expired, is an ordinary state
   * and has to look like one.
   */
  if (!roots || roots.length === 0) {
    return (
      <EmptyState
        titleText={t('KeyBrowser.TREE_EMPTY')}
        icon={SearchIcon}
        headingLevel="h3"
        variant="sm"
      >
        <EmptyStateBody>{t('KeyBrowser.TREE_EMPTY_BODY')}</EmptyStateBody>
      </EmptyState>
    );
  }

  // Where in the namespace the list is currently filtered, one crumb per level. A trail
  // rather than a single "all keys" link: three levels down, the useful move is usually up
  // one, and a link back to the root is the only move that was on offer.
  const segments = selectedPrefix.split(DELIMITER).filter(Boolean);

  return (
    <>
      <Breadcrumb className="keydra-tree__path">
        <BreadcrumbItem
          component="button"
          isActive={segments.length === 0}
          onClick={() => onSelect('')}
        >
          {t('KeyBrowser.ALL_KEYS')}
        </BreadcrumbItem>
        {segments.map((segment, index) => (
          <BreadcrumbItem
            key={segment}
            component="button"
            isActive={index === segments.length - 1}
            onClick={() => onSelect(segments.slice(0, index + 1).join(DELIMITER) + DELIMITER)}
          >
            {segment}
          </BreadcrumbItem>
        ))}
      </Breadcrumb>
      {/*
        Said about the level, not only about the numbers.
        <p>Every count already carries "at least this many", which is true and is not the whole
        truth: a walk that stopped at the sample limit did not only undercount the branches it
        found — it can have missed branches entirely. Measured on a keyspace of nine hundred and
        forty thousand keys, the tree drew five namespaces of the seven that were there, and
        nothing on the page said a sixth might exist. A tooltip on a total cannot say that,
        because what is missing has no row to hang one on.
      */}
      {(roots ?? []).some((node) => node.partial) ? (
        <HelperText className="pf-v6-u-mb-sm">
          <HelperTextItem variant="warning">{t('KeyBrowser.TREE_SAMPLED')}</HelperTextItem>
        </HelperText>
      ) : null}
      <TreeView
        aria-label={t('KeyBrowser.TREE_LABEL')}
        data={toItems(roots ?? [])}
        activeItems={selectedPrefix ? [{ id: selectedPrefix, name: selectedPrefix }] : []}
        onSelect={(_, item) => {
          const prefix = String(item.id);
          // The "and N more" row is a note, not a namespace.
          if (prefix.startsWith('__more__')) {
            return;
          }
          setExpanded((current) => (current.includes(prefix) ? current : current.concat(prefix)));
          onSelect(prefix);
        }}
        hasGuides
      />
    </>
  );
};
