import type { FC } from 'react';
import { useState } from 'react';
import { Alert, Button, Flex, FlexItem, Stack, StackItem, TextArea } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import type { StringPage } from '../valueTypes';

export interface StringEditorProps {
  page: StringPage;
  isBusy: boolean;
  onSave: (value: string) => void;
}

/**
 * A whole string value.
 *
 * <p>Edited in a text area rather than a single-line input because strings hold JSON documents and
 * serialized blobs as often as they hold words, and those need room and line breaks.
 *
 * <p>Saving is explicit. The other editors save a field as soon as it is confirmed, but a string is
 * the entire value: an accidental keystroke followed by a blur would overwrite it.
 */
export const StringEditor: FC<StringEditorProps> = ({ page, isBusy, onSave }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(page.value.text);
  const [shownText, setShownText] = useState(page.value.text);

  // A refetch, an encoding change or a jump to another key all replace the value under
  // the editor; an untouched draft must follow it rather than stay behind. Adjusted
  // during render rather than in an effect, so the new value is what gets painted —
  // an effect would show the stale draft for one frame first.
  if (shownText !== page.value.text) {
    setShownText(page.value.text);
    setDraft(page.value.text);
  }

  const isDirty = draft !== page.value.text;

  return (
    <Stack hasGutter>
      {page.value.truncated ? (
        <StackItem>
          <Alert variant="warning" isInline title={t('Value.TRUNCATED_TITLE')} component="h3">
            {t('Value.TRUNCATED_HELP')}
          </Alert>
        </StackItem>
      ) : null}

      <StackItem>
        <TextArea
          value={draft}
          aria-label={t('Value.STRING_LABEL')}
          rows={18}
          resizeOrientation="vertical"
          className="pf-v6-u-font-family-monospace"
          // Editing a truncated value would write the visible prefix over the whole thing.
          isDisabled={page.value.truncated}
          onChange={(_event, next) => setDraft(next)}
        />
      </StackItem>

      <StackItem>
        <Flex spaceItems={{ default: 'spaceItemsSm' }}>
          <FlexItem>
            <Button
              variant="primary"
              isDisabled={!isDirty || isBusy || page.value.truncated}
              isLoading={isBusy}
              onClick={() => onSave(draft)}
            >
              {t('Value.SAVE')}
            </Button>
          </FlexItem>
          <FlexItem>
            <Button
              variant="link"
              isDisabled={!isDirty || isBusy}
              onClick={() => setDraft(page.value.text)}
            >
              {t('Value.RESET')}
            </Button>
          </FlexItem>
        </Flex>
      </StackItem>
    </Stack>
  );
};
