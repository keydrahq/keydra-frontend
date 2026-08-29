import type { FC } from 'react';
import { useState } from 'react';
import { Button, Flex, FlexItem, TextInput } from '@patternfly/react-core';
import { CheckIcon, PencilAltIcon, TimesIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import type { EncodedValue } from '../valueTypes';
import { ValueText } from './ValueText';

export interface EditableTextProps {
  value: EncodedValue;
  /** Names the thing being edited, for screen readers. */
  label: string;
  isDisabled?: boolean;
  onSave: (next: string) => void;
}

/**
 * A value cell that can be edited where it sits.
 *
 * <p>Editing in place rather than in a modal: changing one hash field out of hundreds is a small
 * act, and a dialog per field would put three clicks and a context switch in front of it.
 *
 * <p>A truncated value cannot be edited — saving it back would write the visible prefix over the
 * whole value and silently destroy the rest.
 */
export const EditableText: FC<EditableTextProps> = ({ value, label, isDisabled, onSave }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <Flex
        spaceItems={{ default: 'spaceItemsSm' }}
        alignItems={{ default: 'alignItemsCenter' }}
        flexWrap={{ default: 'nowrap' }}
      >
        <FlexItem grow={{ default: 'grow' }}>
          <ValueText value={value} />
        </FlexItem>
        <FlexItem>
          <Button
            variant="plain"
            aria-label={t('Value.EDIT_LABEL', { name: label })}
            icon={<PencilAltIcon />}
            isDisabled={isDisabled || value.truncated}
            onClick={() => setDraft(value.text)}
          />
        </FlexItem>
      </Flex>
    );
  }

  return (
    <Flex
      spaceItems={{ default: 'spaceItemsSm' }}
      alignItems={{ default: 'alignItemsCenter' }}
      flexWrap={{ default: 'nowrap' }}
    >
      <FlexItem grow={{ default: 'grow' }}>
        <TextInput
          value={draft}
          aria-label={t('Value.EDIT_LABEL', { name: label })}
          onChange={(_event, next) => setDraft(next)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onSave(draft);
              setDraft(null);
            }
            if (event.key === 'Escape') {
              setDraft(null);
            }
          }}
          autoFocus
        />
      </FlexItem>
      <FlexItem>
        <Button
          variant="plain"
          aria-label={t('Value.SAVE')}
          icon={<CheckIcon />}
          onClick={() => {
            onSave(draft);
            setDraft(null);
          }}
        />
        <Button
          variant="plain"
          aria-label={t('Value.CANCEL')}
          icon={<TimesIcon />}
          onClick={() => setDraft(null)}
        />
      </FlexItem>
    </Flex>
  );
};
