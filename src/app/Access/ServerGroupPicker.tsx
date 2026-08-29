import type { FC } from 'react';
import { useMemo, useState } from 'react';
import { Content, SearchInput, Stack, StackItem } from '@patternfly/react-core';
import { Table, Tbody, Td, TreeRowWrapper } from '@patternfly/react-table';
import type { TdProps } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { groupName } from './names';
import { toPaths, toRows, toTree } from './serverGroupTree';
import type { ServerGroupSummary } from './types';

export interface ServerGroupPickerProps {
  groups: ServerGroupSummary[];
  /** The ids currently chosen. */
  chosen: number[];
  onChange: (chosen: number[]) => void;
  /** Offer a search box. Worth it above a handful; noise below one. */
  isSearchable?: boolean;
}

/**
 * Choosing server groups out of however many there are.
 *
 * <p>A tree, because the groups are one and which sits inside which changes what choosing one
 * means: a grant on a parent reaches the servers in its children. Drawn flat, a group three levels
 * down reads as a peer of the one it is actually inside.
 *
 * <p>Searchable, because a tree stops being a help somewhere around fifty groups and becomes the
 * thing between somebody and the one they are looking for. While a search is running the results
 * are flat with their path spelled out — a tree filtered to its matches is a tree with holes in it,
 * and the holes are what make it unreadable.
 */
export const ServerGroupPicker: FC<ServerGroupPickerProps> = ({
  groups,
  chosen,
  onChange,
  isSearchable = false,
}) => {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState<number[]>([]);
  const [search, setSearch] = useState('');

  const needle = search.trim().toLowerCase();
  const matches = useMemo(
    () =>
      needle
        ? toPaths(groups).filter((entry) => entry.group.name.toLowerCase().includes(needle))
        : [],
    [groups, needle],
  );

  const toggle = (id: number, checked: boolean) =>
    onChange(checked ? [...chosen, id] : chosen.filter((held) => held !== id));

  const rows = toRows(toTree(groups), collapsed);

  return (
    <Stack hasGutter>
      {isSearchable && (
        <StackItem>
          <SearchInput
            aria-label={t('Access.FIND_SERVER_GROUP')}
            placeholder={t('Access.FIND_SERVER_GROUP')}
            value={search}
            onChange={(_event, value) => setSearch(value)}
            onClear={() => setSearch('')}
          />
        </StackItem>
      )}

      <StackItem>
        <Table aria-label={t('Access.SERVER_GROUPS')} variant="compact" isTreeTable={!needle}>
          <Tbody>
            {needle
              ? matches.map(({ group, path }) => (
                  <TreeRowWrapper key={group.id} row={{ props: {} }}>
                    <Td
                      dataLabel={t('Access.SERVER_GROUPS')}
                      select={{
                        rowIndex: group.id,
                        isSelected: chosen.includes(group.id),
                        onSelect: (_event, checked) => toggle(group.id, checked),
                        variant: 'checkbox',
                      }}
                    />
                    <Td dataLabel={t('Access.SERVER_GROUPS')}>
                      {path.length > 0 && (
                        <Content component="small">{path.map(groupName).join(' › ')} › </Content>
                      )}
                      {groupName(group.name)}
                    </Td>
                  </TreeRowWrapper>
                ))
              : rows.map((row, index) => {
                  const treeRow: TdProps['treeRow'] = {
                    onCollapse: () =>
                      setCollapsed((current) =>
                        row.isExpanded
                          ? [...current, row.group.id]
                          : current.filter((id) => id !== row.group.id),
                      ),
                    onCheckChange: (_event: React.FormEvent<HTMLInputElement>, checking: boolean) =>
                      toggle(row.group.id, checking),
                    rowIndex: index,
                    props: {
                      isExpanded: row.isExpanded,
                      isHidden: row.isHidden,
                      'aria-level': row.level,
                      'aria-posinset': row.position,
                      'aria-setsize': row.childCount,
                      isChecked: chosen.includes(row.group.id),
                      checkboxId: `server-group-${row.group.id}`,
                    },
                  };

                  return (
                    <TreeRowWrapper key={row.group.id} row={{ props: treeRow.props }}>
                      <Td dataLabel={t('Access.SERVER_GROUPS')} treeRow={treeRow}>
                        {groupName(row.group.name)}
                      </Td>
                    </TreeRowWrapper>
                  );
                })}
          </Tbody>
        </Table>

        {needle && matches.length === 0 && (
          <Content component="small">{t('Access.NO_MATCHING_GROUPS')}</Content>
        )}
      </StackItem>
    </Stack>
  );
};
