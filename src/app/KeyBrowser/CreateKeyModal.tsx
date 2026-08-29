import type { FC } from 'react';
import { useState } from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  NumberInput,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import type { ValueMutation } from './valueTypes';

/** The types a key can be created as. Streams are appended to, never created empty. */
const CREATABLE = ['string', 'hash', 'list', 'set', 'zset'] as const;

type Creatable = (typeof CREATABLE)[number];

export interface CreateKeyModalProps {
  /** Prefilled from the namespace the tree is showing, so a new key lands where you are. */
  prefix: string;
  isBusy: boolean;
  error: string | undefined;
  onCreate: (mutation: ValueMutation, ttlSeconds: number | null) => void;
  onCancel: () => void;
}

/**
 * Creates a key by writing its first value.
 *
 * <p>There is no "create key" command in a key-value store — a key exists because something was
 * written to it — so this dialog asks for the first element rather than pretending a key can be
 * made empty and filled later. That also means the form changes with the type: a hash needs a
 * field name, a sorted set needs a score, and a list needs neither.
 */
export const CreateKeyModal: FC<CreateKeyModalProps> = ({
  prefix,
  isBusy,
  error,
  onCreate,
  onCancel,
}) => {
  const { t } = useTranslation();

  const [key, setKey] = useState(prefix);
  const [type, setType] = useState<Creatable>('string');
  const [value, setValue] = useState('');
  const [field, setField] = useState('');
  const [score, setScore] = useState(0);
  const [ttl, setTtl] = useState('');

  const needsField = type === 'hash';
  const needsScore = type === 'zset';
  const isComplete = key.trim() !== '' && (!needsField || field.trim() !== '');

  const mutationFor = (): ValueMutation => {
    switch (type) {
      case 'hash':
        return { operation: 'setHashField', key, field, value };
      case 'list':
        return { operation: 'pushListElement', key, value, toHead: false };
      case 'set':
        return { operation: 'addSetMember', key, member: value };
      case 'zset':
        return { operation: 'addScoredMember', key, member: value, score };
      default:
        return { operation: 'setString', key, value };
    }
  };

  return (
    <Modal isOpen variant="medium" onClose={onCancel} aria-labelledby="create-key-modal-title">
      <ModalHeader
        labelId="create-key-modal-title"
        title={t('CreateKey.TITLE')}
        description={t('CreateKey.DESCRIPTION')}
      />
      <ModalBody>
        <Form
          id="create-key-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (isComplete && !isBusy) {
              onCreate(mutationFor(), ttl ? Number(ttl) : null);
            }
          }}
        >
          {error ? <Alert variant="danger" isInline title={error} /> : null}

          <FormGroup label={t('CreateKey.KEY')} isRequired fieldId="create-key-name">
            <TextInput
              id="create-key-name"
              value={key}
              autoFocus
              onChange={(_event, next) => setKey(next)}
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>{t('CreateKey.KEY_HELP')}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>

          <FormGroup label={t('CreateKey.TYPE')} isRequired fieldId="create-key-type">
            <FormSelect
              id="create-key-type"
              value={type}
              onChange={(_event, next) => setType(next as Creatable)}
            >
              {CREATABLE.map((candidate) => (
                <FormSelectOption key={candidate} value={candidate} label={candidate} />
              ))}
            </FormSelect>
          </FormGroup>

          {needsField ? (
            <FormGroup label={t('CreateKey.FIELD')} isRequired fieldId="create-key-field">
              <TextInput
                id="create-key-field"
                value={field}
                onChange={(_event, next) => setField(next)}
              />
            </FormGroup>
          ) : null}

          <FormGroup
            label={t(`CreateKey.VALUE_${type.toUpperCase()}` as 'CreateKey.VALUE_STRING')}
            fieldId="create-key-value"
          >
            <TextArea
              id="create-key-value"
              value={value}
              rows={type === 'string' ? 6 : 2}
              onChange={(_event, next) => setValue(next)}
            />
          </FormGroup>

          {needsScore ? (
            <FormGroup label={t('CreateKey.SCORE')} fieldId="create-key-score">
              <NumberInput
                id="create-key-score"
                value={score}
                onMinus={() => setScore((current) => current - 1)}
                onPlus={() => setScore((current) => current + 1)}
                onChange={(event) => setScore(Number((event.target as HTMLInputElement).value))}
              />
            </FormGroup>
          ) : null}

          <FormGroup label={t('CreateKey.TTL')} fieldId="create-key-ttl">
            <TextInput
              id="create-key-ttl"
              type="number"
              value={ttl}
              onChange={(_event, next) => setTtl(next)}
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>{t('CreateKey.TTL_HELP')}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          type="submit"
          form="create-key-form"
          variant="primary"
          isDisabled={!isComplete || isBusy}
          isLoading={isBusy}
        >
          {t('CreateKey.CREATE')}
        </Button>
        <Button variant="link" onClick={onCancel}>
          {t('CreateKey.CANCEL')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
