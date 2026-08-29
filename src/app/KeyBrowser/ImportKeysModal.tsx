import type { FC } from 'react';
import { useState } from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  Checkbox,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  MultipleFileUpload,
  MultipleFileUploadMain,
  MultipleFileUploadStatusItem,
} from '@patternfly/react-core';
import { UploadIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { NameToProceed } from '@app/Shared/Components/NameToProceed';
import type { ExportedKey } from './types';

export interface ImportKeysModalProps {
  isBusy: boolean;
  error: string | undefined;
  /** The target's name when it asks to be named before anything writes over it. */
  nameToType?: string;
  onImport: (keys: ExportedKey[], replace: boolean, confirmTarget?: string) => void;
  onCancel: () => void;
}

/**
 * Restores an export file.
 *
 * <p>A drop zone rather than a hidden input behind a menu item: a file is a thing people already
 * have on screen, and dragging it onto the page is the shortest way to say which one. PatternFly's
 * upload accepts a drop or a browse, and shows what it took.
 *
 * <p>The file is parsed here rather than on the server. It has to be read in the browser either
 * way, and parsing it before anything is sent means a file that is not an export is refused
 * without a round trip and without the server seeing it.
 */
export const ImportKeysModal: FC<ImportKeysModalProps> = ({
  isBusy,
  error,
  nameToType,
  onImport,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | undefined>();
  const [keys, setKeys] = useState<ExportedKey[] | undefined>();
  const [readError, setReadError] = useState<string | undefined>();
  const [replace, setReplace] = useState(false);
  const [typed, setTyped] = useState('');

  const take = (chosen: File | undefined) => {
    setFile(chosen);
    setKeys(undefined);
    setReadError(undefined);
    if (!chosen) {
      return;
    }
    void chosen
      .text()
      .then((text) => {
        const parsed: unknown = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          throw new Error(t('ImportKeys.NOT_AN_EXPORT'));
        }
        setKeys(parsed as ExportedKey[]);
      })
      .catch((failure: Error) => setReadError(failure.message));
  };

  return (
    <Modal isOpen variant="medium" onClose={onCancel} aria-labelledby="import-keys-modal-title">
      <ModalHeader
        labelId="import-keys-modal-title"
        title={t('ImportKeys.TITLE')}
        description={t('ImportKeys.DESCRIPTION')}
      />
      <ModalBody>
        <Form>
          {error ? <Alert variant="danger" isInline title={error} /> : null}
          {readError ? <Alert variant="danger" isInline title={readError} /> : null}

          <FormGroup label={t('ImportKeys.FILE')} isRequired fieldId="import-file">
            <MultipleFileUpload
              dropzoneProps={{
                accept: { 'application/json': ['.json'] },
                maxFiles: 1,
              }}
              onFileDrop={(_event, dropped) => take(dropped[0])}
            >
              <MultipleFileUploadMain
                titleIcon={<UploadIcon />}
                titleText={t('ImportKeys.DROP')}
                titleTextSeparator={t('ImportKeys.OR')}
                browseButtonText={t('ImportKeys.BROWSE')}
                infoText={t('ImportKeys.ACCEPTS')}
              />
              {file ? (
                <MultipleFileUploadStatusItem
                  file={file}
                  onClearClick={() => take(undefined)}
                  // Already read above; this only reports what was taken.
                  progressValue={keys ? 100 : 0}
                  progressVariant={readError ? 'danger' : keys ? 'success' : undefined}
                  customFileHandler={() => undefined}
                />
              ) : null}
            </MultipleFileUpload>
          </FormGroup>

          <FormGroup fieldId="import-replace">
            <Checkbox
              id="import-replace"
              label={t('ImportKeys.REPLACE')}
              description={t('ImportKeys.REPLACE_HELP')}
              isChecked={replace}
              onChange={(_event, checked) => setReplace(checked)}
            />
          </FormGroup>
          {nameToType !== undefined ? (
            <NameToProceed
              name={nameToType}
              value={typed}
              onChange={setTyped}
              id="import-keys-name"
            />
          ) : null}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          isDisabled={!keys || isBusy || (nameToType !== undefined && typed !== nameToType)}
          isLoading={isBusy}
          onClick={() =>
            keys && onImport(keys, replace, nameToType === undefined ? undefined : typed)
          }
        >
          {keys ? t('ImportKeys.SUBMIT_COUNT', { count: keys.length }) : t('ImportKeys.SUBMIT')}
        </Button>
        <Button variant="link" onClick={onCancel}>
          {t('ImportKeys.CANCEL')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
