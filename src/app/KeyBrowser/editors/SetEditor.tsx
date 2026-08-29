import type { FC } from 'react';
import { useState } from 'react';
import { Button, Flex, FlexItem, TextInput } from '@patternfly/react-core';
import { PlusCircleIcon, TrashIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import type { EncodedValue, ValueMutation } from '../valueTypes';
import { ValueText } from './ValueText';

export interface SetEditorProps {
  keyName: string;
  members: EncodedValue[];
  isBusy: boolean;
  onMutate: (mutation: ValueMutation) => void;
}

/**
 * Set members.
 *
 * <p>A member is its own identity, so there is nothing to edit in place: changing one is adding a
 * new member and removing the old, and pretending otherwise would hide a two-step operation behind
 * a pencil. Add and remove are therefore the only actions.
 */
export const SetEditor: FC<SetEditorProps> = ({ keyName, members, isBusy, onMutate }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');

  const add = () => {
    if (!draft) {
      return;
    }
    onMutate({ operation: 'addSetMember', key: keyName, member: draft });
    setDraft('');
  };

  return (
    <>
      <Flex
        className="keydra-value__add"
        spaceItems={{ default: 'spaceItemsSm' }}
        alignItems={{ default: 'alignItemsCenter' }}
      >
        <FlexItem grow={{ default: 'grow' }}>
          <TextInput
            value={draft}
            aria-label={t('Value.SET_NEW_MEMBER')}
            placeholder={t('Value.MEMBER')}
            onChange={(_event, next) => setDraft(next)}
            onKeyDown={(event) => event.key === 'Enter' && add()}
          />
        </FlexItem>
        <FlexItem>
          <Button
            variant="secondary"
            icon={<PlusCircleIcon />}
            isDisabled={!draft || isBusy}
            onClick={add}
          >
            {t('Value.ADD')}
          </Button>
        </FlexItem>
      </Flex>

      <Table aria-label={t('Value.SET_TABLE')} variant="compact">
        <Thead>
          <Tr>
            <Th>{t('Value.MEMBER')}</Th>
            <Th screenReaderText={t('Value.ROW_ACTIONS')} />
          </Tr>
        </Thead>
        <Tbody>
          {members.map((member) => (
            <Tr key={member.text}>
              <Td dataLabel={t('Value.MEMBER')}>
                <ValueText value={member} />
              </Td>
              <Td isActionCell>
                <Button
                  variant="plain"
                  aria-label={t('Value.DELETE_MEMBER', { name: member.text })}
                  icon={<TrashIcon />}
                  isDisabled={isBusy || member.truncated}
                  onClick={() =>
                    onMutate({ operation: 'removeSetMember', key: keyName, member: member.text })
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
