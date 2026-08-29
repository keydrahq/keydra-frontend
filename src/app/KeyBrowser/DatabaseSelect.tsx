import type { FC } from 'react';
import { useState } from 'react';
import { Badge, MenuToggle, Select, SelectList, SelectOption } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import type { DatabaseSummary } from './types';

export interface DatabaseSelectProps {
  databases: DatabaseSummary[];
  selected: number | undefined;
  fallback: number;
  onSelect: (database: number) => void;
}

/**
 * Which of a target's keyspaces the browser is looking at.
 *
 * <p>Every database the server is configured for, with what is in each: sixteen identical numbers
 * say nothing about where somebody's data actually is, and the count is what turns the list into a
 * decision. An empty one is still offered — a list that hid them could not be used to move into
 * one.
 *
 * <p>Hidden entirely for a target with one keyspace. A cluster has exactly one, and a control with
 * a single option is a control that only asks to be clicked.
 */
export const DatabaseSelect: FC<DatabaseSelectProps> = ({
  databases,
  selected,
  fallback,
  onSelect,
}) => {
  const { t } = useTranslation();
  const [isOpen, setOpen] = useState(false);

  if (databases.length <= 1) {
    return null;
  }

  const current = selected ?? fallback;
  const currentKeys = databases.find((database) => database.index === current)?.keys ?? 0;

  return (
    <Select
      isOpen={isOpen}
      selected={current}
      onOpenChange={setOpen}
      onSelect={(_event, value) => {
        onSelect(Number(value));
        setOpen(false);
      }}
      // Sixteen databases is the default configuration, and sixteen two-line entries are
      // taller than the window they open in — the list ran off the bottom of the page and
      // the last few were unreachable. PatternFly's own answer is a scrolling menu with a
      // height cap rather than a taller page.
      isScrollable
      maxMenuHeight="22rem"
      toggle={(toggleRef) => (
        <MenuToggle
          ref={toggleRef}
          isExpanded={isOpen}
          onClick={() => setOpen((open) => !open)}
          aria-label={t('KeyBrowser.DATABASE_SELECT')}
        >
          {t('KeyBrowser.DATABASE', { index: current })}{' '}
          <Badge isRead>{currentKeys.toLocaleString()}</Badge>
        </MenuToggle>
      )}
    >
      <SelectList>
        {databases.map((database) => (
          <SelectOption
            key={database.index}
            value={database.index}
            isSelected={database.index === current}
            description={
              database.keys === 0
                ? t('KeyBrowser.DATABASE_EMPTY')
                : t('KeyBrowser.DATABASE_KEYS', { count: database.keys })
            }
          >
            {t('KeyBrowser.DATABASE', { index: database.index })}
          </SelectOption>
        ))}
      </SelectList>
    </Select>
  );
};
