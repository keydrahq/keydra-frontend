import type { FC } from 'react';
import { useState } from 'react';
import {
  Button,
  Flex,
  FlexItem,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  TextInput,
} from '@patternfly/react-core';
import { PlusCircleIcon, TrashIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import type { ListElement, ValueMutation } from '../valueTypes';
import { EditableText } from './EditableText';

export interface ListEditorProps {
  keyName: string;
  elements: ListElement[];
  isBusy: boolean;
  onMutate: (mutation: ValueMutation) => void;
}

/**
 * List elements in index order.
 *
 * <p>Removal is by value, not by index, because that is the only identity a Redis list element
 * has — LREM takes a value and a count. Removing "the row you clicked" therefore removes the first
 * element equal to it, which is what the count of 1 says.
 */
export const ListEditor: FC<ListEditorProps> = ({ keyName, elements, isBusy, onMutate }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [toHead, setToHead] = useState(false);
  const [isEndOpen, setEndOpen] = useState(false);

  const push = () => {
    if (!draft) {
      return;
    }
    onMutate({ operation: 'pushListElement', key: keyName, value: draft, toHead });
    setDraft('');
  };

  return (
    <>
      <Flex
        className="keydra-value__add"
        spaceItems={{ default: 'spaceItemsSm' }}
        alignItems={{ default: 'alignItemsCenter' }}
      >
        <FlexItem>
          <Select
            isOpen={isEndOpen}
            selected={toHead ? 'head' : 'tail'}
            onSelect={(_event, value) => {
              setToHead(value === 'head');
              setEndOpen(false);
            }}
            onOpenChange={setEndOpen}
            toggle={(toggleRef) => (
              <MenuToggle
                ref={toggleRef}
                onClick={() => setEndOpen((open) => !open)}
                isExpanded={isEndOpen}
              >
                {toHead ? t('Value.LIST_HEAD') : t('Value.LIST_TAIL')}
              </MenuToggle>
            )}
          >
            <SelectList>
              <SelectOption value="head">{t('Value.LIST_HEAD')}</SelectOption>
              <SelectOption value="tail">{t('Value.LIST_TAIL')}</SelectOption>
            </SelectList>
          </Select>
        </FlexItem>
        <FlexItem grow={{ default: 'grow' }}>
          <TextInput
            value={draft}
            aria-label={t('Value.LIST_NEW_ELEMENT')}
            placeholder={t('Value.VALUE')}
            onChange={(_event, next) => setDraft(next)}
            onKeyDown={(event) => event.key === 'Enter' && push()}
          />
        </FlexItem>
        <FlexItem>
          <Button
            variant="secondary"
            icon={<PlusCircleIcon />}
            isDisabled={!draft || isBusy}
            onClick={push}
          >
            {t('Value.ADD')}
          </Button>
        </FlexItem>
      </Flex>

      <Table aria-label={t('Value.LIST_TABLE')} variant="compact">
        <Thead>
          <Tr>
            <Th width={10}>{t('Value.INDEX')}</Th>
            <Th>{t('Value.VALUE')}</Th>
            <Th screenReaderText={t('Value.ROW_ACTIONS')} />
          </Tr>
        </Thead>
        <Tbody>
          {elements.map((element) => (
            <Tr key={element.index}>
              <Td dataLabel={t('Value.INDEX')} className="pf-v6-u-font-family-monospace">
                {element.index}
              </Td>
              <Td dataLabel={t('Value.VALUE')}>
                <EditableText
                  value={element.value}
                  label={String(element.index)}
                  isDisabled={isBusy}
                  onSave={(next) =>
                    onMutate({
                      operation: 'setListElement',
                      key: keyName,
                      index: element.index,
                      value: next,
                    })
                  }
                />
              </Td>
              <Td isActionCell>
                <Button
                  variant="plain"
                  aria-label={t('Value.DELETE_ELEMENT', { index: element.index })}
                  icon={<TrashIcon />}
                  isDisabled={isBusy}
                  // By index, not by value: a list may hold the same text twice, and
                  // removing "every element equal to this one, first match first" from the
                  // third row would take the first — a row other than the one clicked.
                  onClick={() =>
                    onMutate({
                      operation: 'removeListElementAt',
                      key: keyName,
                      index: element.index,
                    })
                  }
                />
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </>
  );
};
