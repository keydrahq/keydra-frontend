import type { FC } from 'react';
import { useState } from 'react';
import {
  Button,
  Form,
  FormGroup,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextArea,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import type { ApprovalSummary } from './types';

export interface DeclineDialogProps {
  /** The request being declined, or nothing when the dialog is closed. */
  request?: ApprovalSummary;
  isBusy: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/**
 * Saying no, and saying why.
 *
 * <p>The reason is asked for rather than optional in the interface, because the person who asked
 * reads it and "declined" on its own tells them nothing they can act on. It is not enforced by the
 * server: a refusal to record a decision because somebody left a box empty would leave the request
 * open, which is worse than a terse reason.
 */
export const DeclineDialog: FC<DeclineDialogProps> = ({ request, isBusy, onConfirm, onCancel }) => {
  const { t } = useTranslation('public');
  const [reason, setReason] = useState('');

  // Cleared as the dialog opens, so a reason written for one request is never sitting in the box
  // for the next. Adjusted during render for the reason ConfirmDialog does it.
  const [wasOpen, setWasOpen] = useState(request !== undefined);
  if ((request !== undefined) !== wasOpen) {
    setWasOpen(request !== undefined);
    setReason('');
  }

  return (
    <Modal
      isOpen={request !== undefined}
      onClose={onCancel}
      variant="small"
      aria-label={t('Approvals.DECLINE_TITLE')}
    >
      <ModalHeader title={t('Approvals.DECLINE_TITLE')} />
      <ModalBody>
        <p className="pf-v6-u-mb-md">{request?.summary}</p>
        <Form>
          <FormGroup label={t('Approvals.DECLINE_REASON')} fieldId="approval-decline-reason">
            <TextArea
              id="approval-decline-reason"
              value={reason}
              rows={3}
              onChange={(_, typed) => setReason(typed)}
            />
            <HelperText>
              <HelperTextItem>{t('Approvals.DECLINE_REASON_HELP')}</HelperTextItem>
            </HelperText>
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          isDisabled={isBusy}
          isLoading={isBusy}
          onClick={() => onConfirm(reason)}
        >
          {t('Approvals.DECLINE')}
        </Button>
        <Button variant="link" onClick={onCancel}>
          {t('Approvals.CANCEL')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
