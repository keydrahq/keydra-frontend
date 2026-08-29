import type { FC } from 'react';
import { useState } from 'react';
import {
  Button,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  FlexItem,
  TextInput,
} from '@patternfly/react-core';
import { MinusCircleIcon, PlusCircleIcon, TrashIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import type { StreamEntry, ValueMutation } from '../valueTypes';
import { ValueText } from './ValueText';

export interface StreamEditorProps {
  keyName: string;
  entries: StreamEntry[];
  isBusy: boolean;
  onMutate: (mutation: ValueMutation) => void;
}

interface DraftField {
  name: string;
  value: string;
}

/**
 * Stream entries.
 *
 * <p>A stream is append-only: an entry can be added or removed but never edited, so there is no
 * inline edit here. Entries carry several fields each, so a row expands to show them rather than
 * flattening them into one cell.
 *
 * <p>New entries get their id from the server — Redis' `*` — because ids must increase and a
 * hand-typed one that does not is rejected.
 */
export const StreamEditor: FC<StreamEditorProps> = ({ keyName, entries, isBusy, onMutate }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [draft, setDraft] = useState<DraftField[]>([{ name: '', value: '' }]);

  const named = draft.filter((field) => field.name.trim() !== '');

  const add = () => {
    if (named.length === 0) {
      return;
    }
    onMutate({
      operation: 'addStreamEntry',
      key: keyName,
      id: null,
      fields: Object.fromEntries(named.map((field) => [field.name, field.value])),
    });
    setDraft([{ name: '', value: '' }]);
  };

  const update = (index: number, patch: Partial<DraftField>) =>
    setDraft((current) =>
      current.map((field, at) => (at === index ? { ...field, ...patch } : field)),
    );

  return (
    <>
      <div className="keydra-value__add keydra-stream-draft">
        {draft.map((field, index) => (
          // Draft rows have no identity beyond their position, and reordering is not
          // possible here, so the index is a stable key for as long as the row exists.
          <Flex
            key={index}
            spaceItems={{ default: 'spaceItemsSm' }}
            alignItems={{ default: 'alignItemsCenter' }}
            className="keydra-stream-draft__row"
          >
            <FlexItem>
              <TextInput
                value={field.name}
                aria-label={t('Value.STREAM_FIELD_NAME', { index: index + 1 })}
                placeholder={t('Value.HASH_FIELD')}
                onChange={(_event, next) => update(index, { name: next })}
              />
            </FlexItem>
            <FlexItem grow={{ default: 'grow' }}>
              <TextInput
                value={field.value}
                aria-label={t('Value.STREAM_FIELD_VALUE', { index: index + 1 })}
                placeholder={t('Value.VALUE')}
                onChange={(_event, next) => update(index, { value: next })}
              />
            </FlexItem>
            <FlexItem>
              <Button
                variant="plain"
                aria-label={t('Value.STREAM_REMOVE_FIELD', { index: index + 1 })}
                icon={<MinusCircleIcon />}
                isDisabled={draft.length === 1}
                onClick={() => setDraft((current) => current.filter((_, at) => at !== index))}
              />
            </FlexItem>
          </Flex>
        ))}
        <Flex spaceItems={{ default: 'spaceItemsSm' }}>
          <FlexItem>
            <Button
              variant="link"
              icon={<PlusCircleIcon />}
              onClick={() => setDraft((current) => [...current, { name: '', value: '' }])}
            >
              {t('Value.STREAM_ADD_FIELD')}
            </Button>
          </FlexItem>
          <FlexItem>
            <Button variant="secondary" isDisabled={named.length === 0 || isBusy} onClick={add}>
              {t('Value.STREAM_ADD_ENTRY')}
            </Button>
          </FlexItem>
        </Flex>
      </div>

      <Table aria-label={t('Value.STREAM_TABLE')} variant="compact">
        <Thead>
          <Tr>
            <Th screenReaderText={t('Value.STREAM_EXPAND')} />
            <Th width={30}>{t('Value.STREAM_ID')}</Th>
            <Th>{t('Value.STREAM_FIELDS')}</Th>
            <Th screenReaderText={t('Value.ROW_ACTIONS')} />
          </Tr>
        </Thead>
        {entries.map((entry, rowIndex) => {
          const isExpanded = expanded.has(entry.id);
          return (
            <Tbody key={entry.id} isExpanded={isExpanded}>
              <Tr>
                <Td
                  expand={{
                    /*
                     * The row's real index, and an id prefix of its own. PatternFly builds
                     * the toggle's accessible name out of these — aria-labelledby pointing
                     * at the row's own cell — so a fixed zero gave every row in the table
                     * the same id and made every toggle announce the first entry.
                     */
                    rowIndex,
                    expandId: `stream-entry-${entry.id}`,
                    isExpanded,
                    onToggle: () =>
                      setExpanded((current) => {
                        const next = new Set(current);
                        if (!next.delete(entry.id)) {
                          next.add(entry.id);
                        }
                        return next;
                      }),
                  }}
                />
                <Td dataLabel={t('Value.STREAM_ID')} className="pf-v6-u-font-family-monospace">
                  {entry.id}
                </Td>
                <Td dataLabel={t('Value.STREAM_FIELDS')}>
                  {t('Value.STREAM_FIELD_COUNT', { count: entry.fields.length })}
                </Td>
                <Td isActionCell>
                  <Button
                    variant="plain"
                    aria-label={t('Value.STREAM_DELETE_ENTRY', { id: entry.id })}
                    icon={<TrashIcon />}
                    isDisabled={isBusy}
                    onClick={() =>
                      onMutate({ operation: 'deleteStreamEntry', key: keyName, id: entry.id })
                    }
                  />
                </Td>
              </Tr>
              <Tr isExpanded={isExpanded}>
                {/* The indent under the expand toggle, and the detail beside it. Both are
                    labelled: stacked on a narrow screen a cell with no label is a value
                    with nothing to say what it is. */}
                <Td dataLabel={t('Value.STREAM_EXPAND')} />
                <Td dataLabel={t('Value.STREAM_FIELDS')} colSpan={3}>
                  <DescriptionList isHorizontal isCompact>
                    {entry.fields.map((field) => (
                      <DescriptionListGroup key={field.name}>
                        <DescriptionListTerm>{field.name}</DescriptionListTerm>
                        <DescriptionListDescription>
                          <ValueText value={field.value} />
                        </DescriptionListDescription>
                      </DescriptionListGroup>
                    ))}
                  </DescriptionList>
                </Td>
              </Tr>
            </Tbody>
          );
        })}
      </Table>
    </>
  );
};
