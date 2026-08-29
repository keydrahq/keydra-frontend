import type { FC, FormEvent } from 'react';
import { useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  FormAlert,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';

/** Which operation the destination is being collected for. */
export type KeyDestination = 'rename' | 'copy';

export interface KeyDestinationModalProps {
  operation: KeyDestination;
  keyName: string;
  isBusy: boolean;
  /** Set when the target already existed and overwrite was not requested. */
  refused: boolean;
  onSubmit: (to: string, replace: boolean) => void;
  onCancel: () => void;
}

/**
 * Collects a destination key name and whether to overwrite what is there.
 *
 * <p>Rename and copy ask exactly the same question and refuse in exactly the same way — Redis'
 * RENAMENX and COPY-without-REPLACE both answer 0 rather than failing — so they share a form. What
 * differs is what the caller does with the answer.
 */
export const KeyDestinationModal: FC<KeyDestinationModalProps> = ({
  operation,
  keyName,
  isBusy,
  refused,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [to, setTo] = useState(keyName);
  const [replace, setReplace] = useState(false);

  const labels =
    operation === 'copy'
      ? {
          title: t('KeyBrowser.COPY_TITLE'),
          refused: t('KeyBrowser.COPY_REFUSED'),
          submit: t('KeyBrowser.COPY'),
        }
      : {
          title: t('KeyBrowser.RENAME_TITLE'),
          refused: t('KeyBrowser.RENAME_REFUSED'),
          submit: t('KeyBrowser.RENAME'),
        };

  // The destination must differ from the source for both operations: a rename to the
  // same name is a no-op, and a copy onto itself is one Redis refuses outright.
  const invalid = to.trim() === '' || to === keyName;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!invalid && !isBusy) {
      onSubmit(to, replace);
    }
  };

  return (
    <Modal isOpen onClose={onCancel} variant="small" aria-labelledby="key-destination-modal-title">
      <ModalHeader labelId="key-destination-modal-title" title={labels.title} />
      <ModalBody>
        <Form id="key-destination-form" onSubmit={submit}>
          {/* FormAlert, not an Alert with a margin: the space between a form's alert and its
              first field is the form's decision, and PatternFly already makes it. */}
          {refused ? (
            <FormAlert>
              <Alert variant="warning" isInline title={labels.refused} />
            </FormAlert>
          ) : null}
          <FormGroup label={t('KeyBrowser.DESTINATION_FROM')} fieldId="key-destination-from">
            <TextInput id="key-destination-from" value={keyName} readOnlyVariant="default" />
          </FormGroup>
          <FormGroup label={t('KeyBrowser.DESTINATION_TO')} isRequired fieldId="key-destination-to">
            <TextInput
              id="key-destination-to"
              value={to}
              onChange={(_, value) => setTo(value)}
              validated={invalid ? 'error' : 'default'}
              isRequired
            />
          </FormGroup>
          <FormGroup fieldId="key-destination-replace">
            <Checkbox
              id="key-destination-replace"
              label={t('KeyBrowser.DESTINATION_REPLACE')}
              isChecked={replace}
              onChange={(_, checked) => setReplace(checked)}
            />
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          type="submit"
          form="key-destination-form"
          isDisabled={invalid || isBusy}
          isLoading={isBusy}
        >
          {labels.submit}
        </Button>
        <Button variant="link" onClick={onCancel}>
          {t('CANCEL', { ns: 'common' })}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
