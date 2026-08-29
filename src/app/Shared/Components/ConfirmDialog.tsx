import type { FC, ReactNode } from 'react';
import { useState } from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core';
import { NameToProceed } from './NameToProceed';
import { useTranslation } from 'react-i18next';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  isDestructive?: boolean;
  isBusy?: boolean;
  /**
   * The target's name, when this target has to be named before it can be emptied.
   *
   * <p>Absent for everything else, which is most things. Given, the dialog will not confirm until
   * it has been typed exactly — and the value reaches the server, which is where the check that
   * matters happens. What this does is collect it; refusing without it is the server's job.
   */
  nameToType?: string;
  onConfirm: (named?: string) => void;
  onCancel: () => void;
}

/** Generic confirmation for actions that cannot be undone. */
export const ConfirmDialog: FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  children,
  confirmLabel,
  isDestructive = false,
  isBusy = false,
  nameToType,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation('common');
  const [typed, setTyped] = useState('');

  /*
   * Cleared when the dialog opens, so a name typed for one target is never sitting in the box for
   * the next one — which is the confusion this whole thing exists to prevent.
   *
   * Adjusted during render rather than in an effect. React's own answer for state that has to
   * follow a prop: an effect would paint the stale value once before clearing it, and here that
   * stale value is a name that would briefly make the button look ready.
   */
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    setTyped('');
  }

  const named = nameToType === undefined || typed === nameToType;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      variant="small"
      aria-labelledby="confirm-dialog-title"
    >
      <ModalHeader
        labelId="confirm-dialog-title"
        title={title}
        titleIconVariant={isDestructive ? 'warning' : undefined}
      />
      <ModalBody>
        {children}
        {nameToType !== undefined ? (
          <NameToProceed
            name={nameToType}
            value={typed}
            onChange={setTyped}
            id="confirm-dialog-name"
          />
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button
          variant={isDestructive ? 'danger' : 'primary'}
          onClick={() => onConfirm(nameToType === undefined ? undefined : typed)}
          isLoading={isBusy}
          isDisabled={isBusy || !named}
        >
          {confirmLabel}
        </Button>
        <Button variant="link" onClick={onCancel}>
          {t('CANCEL')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
