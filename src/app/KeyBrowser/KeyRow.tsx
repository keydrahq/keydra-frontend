import type { FC } from 'react';
import { memo } from 'react';
import { Checkbox, MenuToggle } from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';
import { ActionsColumn } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { KeyTtlLabel } from './KeyTtlLabel';
import { KeyTypeLabel } from './KeyTypeLabel';
import type { KeyEntry } from './types';

export interface KeyRowProps {
  entry: KeyEntry;
  index: number;
  /** Offset and height from the virtualiser, as numbers so the props stay comparable. */
  start: number;
  height: number;
  isSelected: boolean;
  /** True while this key's detail is the one open in the drawer. */
  isActive: boolean;
  /*
   * What this target can do with a key, as three booleans rather than the capability set itself:
   * a fresh object per row would defeat the memo below, and these change when somebody changes
   * server, which is to say never while the list is on screen.
   */
  canRename: boolean;
  canDuplicate: boolean;
  canSetTtl: boolean;
  onToggle: (key: string) => void;
  onSelect: (entry: KeyEntry) => void;
  onRename: (entry: KeyEntry) => void;
  onDuplicate: (entry: KeyEntry) => void;
  onSetTtl: (entry: KeyEntry) => void;
  onDelete: (entry: KeyEntry) => void;
}

/**
 * One key row.
 *
 * <p>Memoised, and deliberately given only primitives and stable callbacks: a scroll step moves
 * every visible row's index in the virtualiser's output, but the rows themselves rarely change.
 * Without this the whole viewport re-rendered on every wheel tick — thirty-odd PatternFly
 * checkboxes, labels and dropdowns rebuilt per frame, which is enough to drop every frame.
 *
 * <p>The positioning style is built here from numbers rather than passed as an object, because a
 * fresh object each render would defeat the memo it exists to enable.
 */
const Row: FC<KeyRowProps> = ({
  entry,
  index,
  start,
  height,
  isSelected,
  isActive,
  canRename,
  canDuplicate,
  canSetTtl,
  onToggle,
  onSelect,
  onRename,
  onDuplicate,
  onSetTtl,
  onDelete,
}) => {
  const { t } = useTranslation();

  return (
    <div
      role="row"
      aria-rowindex={index + 1}
      className={`keydra-key-table__row${isActive ? ' keydra-key-table__row--active' : ''}`}
      style={{
        position: 'absolute',
        insetBlockStart: 0,
        insetInlineStart: 0,
        inlineSize: '100%',
        blockSize: height,
        transform: `translateY(${start}px)`,
      }}
    >
      <span role="gridcell" className="keydra-key-table__cell--select">
        <Checkbox
          id={`keydra-select-${entry.key}`}
          aria-label={t('KeyBrowser.SELECT_KEY', { name: entry.key })}
          isChecked={isSelected}
          onChange={() => onToggle(entry.key)}
        />
      </span>
      <span role="gridcell" className="keydra-key-table__cell--key">
        {/* A button rather than a click handler on the row: the row also holds a
            checkbox and a menu, and only the name should open the value. */}
        <button
          type="button"
          className="keydra-key-table__key-button"
          title={entry.key}
          aria-current={isActive ? 'true' : undefined}
          onClick={() => onSelect(entry)}
        >
          {entry.key}
        </button>
      </span>
      <span role="gridcell" className="keydra-key-table__cell--type">
        <KeyTypeLabel type={entry.type} />
      </span>
      <span role="gridcell" className="keydra-key-table__cell--ttl">
        <KeyTtlLabel ttl={entry.ttl} />
      </span>
      <span role="gridcell" className="keydra-key-table__cell--actions">
        <ActionsColumn
          popperProps={{
            // The row's menu lives inside the table's own scroll container, which would
            // otherwise cut it off near the bottom of the list.
            enableFlip: true,
            appendTo: () => document.body,
            // Aligned to the toggle's right edge and kept inside the window: the toggle is
            // the last thing in the row, so a menu growing rightwards from it ran off the
            // screen and the longest item was the one cut in half.
            position: 'right',
            preventOverflow: true,
          }}
          actionsToggle={({ onToggle: toggle, isOpen, isDisabled, toggleRef }) => (
            <MenuToggle
              ref={toggleRef}
              variant="plain"
              aria-label={t('KeyBrowser.ROW_ACTIONS_FOR', { name: entry.key })}
              isExpanded={isOpen}
              isDisabled={isDisabled}
              onClick={toggle}
              icon={<EllipsisVIcon />}
            />
          )}
          /*
           * Only what this store can actually do. TiKV has no rename and no copy, and is never
           * asked about expiry at all; Aerospike has expiry but neither of the others. An item
           * offered by a target that has no such operation is a menu entry whose only outcome is
           * an error, which is worse than not being there.
           */
          items={[
            ...(canRename
              ? [{ title: t('KeyBrowser.RENAME'), onClick: () => onRename(entry) }]
              : []),
            ...(canDuplicate
              ? [{ title: t('KeyBrowser.DUPLICATE'), onClick: () => onDuplicate(entry) }]
              : []),
            ...(canSetTtl
              ? [{ title: t('KeyBrowser.SET_TTL'), onClick: () => onSetTtl(entry) }]
              : []),
            ...(canRename || canDuplicate || canSetTtl ? [{ isSeparator: true }] : []),
            { title: t('KeyBrowser.DELETE'), onClick: () => onDelete(entry), isDanger: true },
          ]}
        />
      </span>
    </div>
  );
};

export const KeyRow = memo(Row);
