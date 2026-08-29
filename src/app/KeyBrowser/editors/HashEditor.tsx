import type { FC } from 'react';
import { useState } from 'react';
import { Button, Flex, FlexItem, TextInput } from '@patternfly/react-core';
import { PlusCircleIcon, TrashIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import type { HashField, ValueMutation } from '../valueTypes';
import { EditableText } from './EditableText';

export interface HashEditorProps {
  keyName: string;
  fields: HashField[];
  isBusy: boolean;
  onMutate: (mutation: ValueMutation) => void;
}

/** Hash fields, editable in place, with a row for adding one. */
export const HashEditor: FC<HashEditorProps> = ({ keyName, fields, isBusy, onMutate }) => {
  const { t } = useTranslation();
  const [newField, setNewField] = useState('');
  const [newValue, setNewValue] = useState('');

  const add = () => {
    if (!newField) {
      return;
    }
    onMutate({ operation: 'setHashField', key: keyName, field: newField, value: newValue });
    setNewField('');
    setNewValue('');
  };

  return (
    <>
      <Flex
        className="keydra-value__add"
        spaceItems={{ default: 'spaceItemsSm' }}
        alignItems={{ default: 'alignItemsCenter' }}
      >
        <FlexItem>
          <TextInput
            value={newField}
            aria-label={t('Value.HASH_NEW_FIELD')}
            placeholder={t('Value.HASH_FIELD')}
            onChange={(_event, next) => setNewField(next)}
          />
        </FlexItem>
        <FlexItem grow={{ default: 'grow' }}>
          <TextInput
            value={newValue}
            aria-label={t('Value.HASH_NEW_VALUE')}
            placeholder={t('Value.VALUE')}
            onChange={(_event, next) => setNewValue(next)}
            onKeyDown={(event) => event.key === 'Enter' && add()}
          />
        </FlexItem>
        <FlexItem>
          <Button
            variant="secondary"
            icon={<PlusCircleIcon />}
            isDisabled={!newField || isBusy}
            onClick={add}
          >
            {t('Value.ADD')}
          </Button>
        </FlexItem>
      </Flex>

      <Table aria-label={t('Value.HASH_TABLE')} variant="compact">
        <Thead>
          <Tr>
            <Th width={30}>{t('Value.HASH_FIELD')}</Th>
            <Th>{t('Value.VALUE')}</Th>
            <Th screenReaderText={t('Value.ROW_ACTIONS')} />
          </Tr>
        </Thead>
        <Tbody>
          {fields.map((field) => (
            <Tr key={field.name}>
              <Td dataLabel={t('Value.HASH_FIELD')} className="pf-v6-u-font-family-monospace">
                {field.name}
              </Td>
              <Td dataLabel={t('Value.VALUE')}>
                <EditableText
                  value={field.value}
                  label={field.name}
                  isDisabled={isBusy}
                  onSave={(next) =>
                    onMutate({
                      operation: 'setHashField',
                      key: keyName,
                      field: field.name,
                      value: next,
                    })
                  }
                />
              </Td>
              <Td isActionCell>
                <Button
                  variant="plain"
                  aria-label={t('Value.DELETE_FIELD', { name: field.name })}
                  icon={<TrashIcon />}
                  isDisabled={isBusy}
                  onClick={() =>
                    onMutate({ operation: 'deleteHashField', key: keyName, field: field.name })
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
