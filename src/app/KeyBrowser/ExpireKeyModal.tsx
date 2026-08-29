import type { FC, FormEvent } from 'react';
import { useState } from 'react';
import {
  Button,
  Checkbox,
  Form,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { NO_EXPIRY } from './types';

export interface ExpireKeyModalProps {
  keyName: string;
  currentTtl: number;
  isBusy: boolean;
  /** null clears the expiry. */
  onSubmit: (ttlSeconds: number | null) => void;
  onCancel: () => void;
}

export const ExpireKeyModal: FC<ExpireKeyModalProps> = ({
  keyName,
  currentTtl,
  isBusy,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [seconds, setSeconds] = useState(currentTtl === NO_EXPIRY ? 3600 : currentTtl);
  const [clear, setClear] = useState(false);

  const invalid = !clear && (!Number.isFinite(seconds) || seconds <= 0);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!invalid && !isBusy) {
      onSubmit(clear ? null : seconds);
    }
  };

  return (
    <Modal isOpen onClose={onCancel} variant="small" aria-labelledby="expire-key-modal-title">
      <ModalHeader
        labelId="expire-key-modal-title"
        title={t('KeyBrowser.TTL_TITLE')}
        description={keyName}
      />
      <ModalBody>
        <Form id="expire-key-form" onSubmit={submit}>
          <FormGroup label={t('KeyBrowser.TTL_SECONDS')} fieldId="expire-seconds">
            <TextInput
              id="expire-seconds"
              type="number"
              value={seconds}
              isDisabled={clear}
              onChange={(_, value) => setSeconds(Number(value))}
              validated={invalid ? 'error' : 'default'}
            />
          </FormGroup>
          <FormGroup fieldId="expire-clear">
            <Checkbox
              id="expire-clear"
              label={t('KeyBrowser.TTL_CLEAR')}
              isChecked={clear}
              onChange={(_, checked) => setClear(checked)}
            />
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          type="submit"
          form="expire-key-form"
          isDisabled={invalid || isBusy}
          isLoading={isBusy}
        >
          {t('KeyBrowser.SET_TTL')}
        </Button>
        <Button variant="link" onClick={onCancel}>
          {t('CANCEL', { ns: 'common' })}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
