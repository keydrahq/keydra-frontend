import type { FC } from 'react';
import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Checkbox } from '@patternfly/react-core';
import { useSupports } from '@app/Connections/capabilities';
import { Feature } from '@app/Topology/types';
import { KeyRow } from './KeyRow';
import { useTranslation } from 'react-i18next';
import type { KeyEntry } from './types';

export interface KeyTableProps {
  /** Which target these keys are on, so the row menu can ask what it can do with one. */
  connectionId: number;
  keys: KeyEntry[];
  selected: ReadonlySet<string>;
  /** The key whose detail is open, so the row can show it is the active one. */
  activeKey?: string;
  onToggle: (key: string) => void;
  onSelect: (entry: KeyEntry) => void;
  onToggleAll: () => void;
  onRename: (entry: KeyEntry) => void;
  onDuplicate: (entry: KeyEntry) => void;
  onSetTtl: (entry: KeyEntry) => void;
  onDelete: (entry: KeyEntry) => void;
}

const ROW_HEIGHT = 40;

/**
 * Height assumed until the viewport has been measured.
 *
 * <p>The viewport fills whatever height the page gives it, so this is only a starting guess. It
 * still matters: without it the first paint renders no rows at all, and in an environment with no
 * layout — jsdom under test — it would never render any.
 */
const ASSUMED_HEIGHT = 520;

/**
 * The most rows that will ever be put in the DOM at once.
 *
 * <p>A backstop, not a tuning knob: at a sane viewport height the virtualiser asks for around
 * forty. It asks for more only when the scroll container has been allowed to grow to its content —
 * a CSS regression anywhere up the page can do that — and then it "virtualises" ten thousand rows
 * into ten thousand rows and takes the tab down with it. That has happened once here already.
 *
 * <p>Clamping turns that class of layout bug into a visibly short list, which is a bug report
 * rather than a crash report.
 */
const MAX_RENDERED_ROWS = 200;

/**
 * The key list.
 *
 * <p>Virtualised: only the rows in view exist in the DOM, so a scan returning a million keys costs
 * the same to render as one returning fifty. A plain table would freeze the tab long before the
 * scan finished.
 *
 * <p>Built from divs with explicit grid roles rather than a PatternFly Table, because virtualising
 * requires absolute positioning that a real <table> cannot express.
 */
export const KeyTable: FC<KeyTableProps> = ({
  connectionId,
  keys,
  selected,
  activeKey,
  onToggle,
  onSelect,
  onToggleAll,
  onRename,
  onDuplicate,
  onSetTtl,
  onDelete,
}) => {
  const { t } = useTranslation();
  const viewport = useRef<HTMLDivElement>(null);

  /*
   * Asked once for the whole list rather than per row: it is one cached answer, and reading it
   * inside a memoised row would be a hook call per visible row on every scroll step.
   */
  const supports = useSupports(connectionId);
  const canRename = supports(Feature.RenameKey);
  const canDuplicate = supports(Feature.CopyKey);
  const canSetTtl = supports(Feature.Expiry);

  /*
   * The React compiler will not optimise a component it cannot reason about, and it cannot
   * reason about the virtualiser: the hook reads and writes the DOM directly, which is what
   * lets it measure the scroll container. Silenced with the reason rather than left standing,
   * so the next warning in this file is one worth reading.
   */
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: keys.length,
    getScrollElement: () => viewport.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    initialRect: { width: 0, height: ASSUMED_HEIGHT },
  });

  const allSelected = keys.length > 0 && keys.every((entry) => selected.has(entry.key));

  return (
    <div
      role="grid"
      aria-label={t('KeyBrowser.TABLE_LABEL')}
      aria-rowcount={keys.length}
      className="keydra-key-table"
    >
      <div role="row" className="keydra-key-table__header">
        <span role="columnheader" className="keydra-key-table__cell--select">
          <Checkbox
            id="keydra-select-all"
            aria-label={t('KeyBrowser.SELECT_ALL')}
            isChecked={allSelected}
            onChange={onToggleAll}
          />
        </span>
        <span role="columnheader">{t('KeyBrowser.KEY')}</span>
        <span role="columnheader" className="keydra-key-table__cell--type">
          {t('KeyBrowser.TYPE')}
        </span>
        <span role="columnheader" className="keydra-key-table__cell--ttl">
          {t('KeyBrowser.TTL')}
        </span>
        <span role="columnheader" className="keydra-key-table__cell--actions" />
      </div>

      {/* Height comes from the layout, not from a constant: the table fills the page,
          so a taller window shows more rows rather than more empty space. */}
      <div ref={viewport} className="keydra-key-table__viewport">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer
            .getVirtualItems()
            .slice(0, MAX_RENDERED_ROWS)
            .map((row) => (
              <KeyRow
                key={keys[row.index].key}
                entry={keys[row.index]}
                index={row.index}
                start={row.start}
                height={row.size}
                isSelected={selected.has(keys[row.index].key)}
                isActive={activeKey === keys[row.index].key}
                canRename={canRename}
                canDuplicate={canDuplicate}
                canSetTtl={canSetTtl}
                onToggle={onToggle}
                onSelect={onSelect}
                onRename={onRename}
                onDuplicate={onDuplicate}
                onSetTtl={onSetTtl}
                onDelete={onDelete}
              />
            ))}
        </div>
      </div>
    </div>
  );
};
