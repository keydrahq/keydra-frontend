import type { FC } from 'react';
import { useState } from 'react';
import { Button, Flex, FlexItem, TextInput } from '@patternfly/react-core';
import { PlusCircleIcon, TrashIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import type { ScoredMember, ValueMutation } from '../valueTypes';
import { EditableText } from './EditableText';

export interface ZSetEditorProps {
  keyName: string;
  members: ScoredMember[];
  isBusy: boolean;
  onMutate: (mutation: ValueMutation) => void;
}

/**
 * Sorted-set members with their scores.
 *
 * <p>The score is what is editable here, not the member: ZADD with an existing member updates its
 * score, so an inline edit of the score is a single honest operation. Editing the member text
 * would instead mean add-then-remove, which is what the add and delete controls already are.
 */
export const ZSetEditor: FC<ZSetEditorProps> = ({ keyName, members, isBusy, onMutate }) => {
  const { t } = useTranslation();
  const [member, setMember] = useState('');
  const [score, setScore] = useState('0');

  const parsedScore = Number(score);
  const isScoreValid = score.trim() !== '' && Number.isFinite(parsedScore);

  const add = () => {
    if (!member || !isScoreValid) {
      return;
    }
    onMutate({ operation: 'addScoredMember', key: keyName, member, score: parsedScore });
    setMember('');
    setScore('0');
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
            value={member}
            aria-label={t('Value.ZSET_NEW_MEMBER')}
            placeholder={t('Value.MEMBER')}
            onChange={(_event, next) => setMember(next)}
            onKeyDown={(event) => event.key === 'Enter' && add()}
          />
        </FlexItem>
        <FlexItem>
          <TextInput
            value={score}
            type="number"
            aria-label={t('Value.ZSET_NEW_SCORE')}
            validated={isScoreValid ? 'default' : 'error'}
            onChange={(_event, next) => setScore(next)}
            onKeyDown={(event) => event.key === 'Enter' && add()}
          />
        </FlexItem>
        <FlexItem>
          <Button
            variant="secondary"
            icon={<PlusCircleIcon />}
            isDisabled={!member || !isScoreValid || isBusy}
            onClick={add}
          >
            {t('Value.ADD')}
          </Button>
        </FlexItem>
      </Flex>

      <Table aria-label={t('Value.ZSET_TABLE')} variant="compact">
        <Thead>
          <Tr>
            <Th width={20}>{t('Value.SCORE')}</Th>
            <Th>{t('Value.MEMBER')}</Th>
            <Th screenReaderText={t('Value.ROW_ACTIONS')} />
          </Tr>
        </Thead>
        <Tbody>
          {members.map((entry) => (
            <Tr key={entry.value.text}>
              <Td dataLabel={t('Value.SCORE')} className="pf-v6-u-font-family-monospace">
                <EditableText
                  value={{
                    text: String(entry.score),
                    encoding: 'plain',
                    size: 0,
                    truncated: false,
                  }}
                  label={entry.value.text}
                  isDisabled={isBusy || entry.value.truncated}
                  onSave={(next) => {
                    const parsed = Number(next);
                    if (Number.isFinite(parsed)) {
                      onMutate({
                        operation: 'addScoredMember',
                        key: keyName,
                        member: entry.value.text,
                        score: parsed,
                      });
                    }
                  }}
                />
              </Td>
              <Td
                dataLabel={t('Value.MEMBER')}
                className="keydra-value__text pf-v6-u-font-family-monospace"
              >
                {entry.value.text}
              </Td>
              <Td isActionCell>
                <Button
                  variant="plain"
                  aria-label={t('Value.DELETE_MEMBER', { name: entry.value.text })}
                  icon={<TrashIcon />}
                  isDisabled={isBusy || entry.value.truncated}
                  onClick={() =>
                    onMutate({
                      operation: 'removeScoredMember',
                      key: keyName,
                      member: entry.value.text,
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
