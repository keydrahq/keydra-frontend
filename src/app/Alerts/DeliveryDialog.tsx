import type { FC } from 'react';
import { useState } from 'react';
import {
  Button,
  Form,
  FormGroup,
  FormHelperText,
  FormSection,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Switch,
  TextInput,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { PasswordInput } from '@app/Shared/Components/PasswordInput';
import { useSaveAlertDelivery } from './queries';
import { DeliveryKind } from './types';
import type { AlertDeliverySummary } from './types';

export interface DeliveryDialogProps {
  /** Absent for a new delivery. */
  delivery?: AlertDeliverySummary;
  onClose: () => void;
}

/**
 * Writing down somewhere alerts can go.
 *
 * <p>The address field behaves like a password, because it is one: a Slack or Discord webhook
 * carries its authorisation in its path, so anybody holding the string can post as this
 * application. It is never returned, the form therefore starts empty even when editing, and leaving
 * it empty keeps what is stored rather than clearing it.
 */
export const DeliveryDialog: FC<DeliveryDialogProps> = ({ delivery, onClose }) => {
  const { t } = useTranslation();
  const save = useSaveAlertDelivery();

  const [name, setName] = useState(delivery?.name ?? '');
  const [kind, setKind] = useState<DeliveryKind>(delivery?.kind ?? DeliveryKind.Webhook);
  const [enabled, setEnabled] = useState(delivery?.enabled ?? true);
  const [url, setUrl] = useState('');
  const [headerName, setHeaderName] = useState(delivery?.headerName ?? '');
  const [headerValue, setHeaderValue] = useState('');
  const [smtpHost, setSmtpHost] = useState(delivery?.smtpHost ?? '');
  const [smtpPort, setSmtpPort] = useState(delivery?.smtpPort ? String(delivery.smtpPort) : '587');
  const [smtpTls, setSmtpTls] = useState(delivery?.smtpTls ?? true);
  const [username, setUsername] = useState(delivery?.username ?? '');
  const [password, setPassword] = useState('');
  const [fromAddress, setFromAddress] = useState(delivery?.fromAddress ?? '');
  const [toAddresses, setToAddresses] = useState(delivery?.toAddresses ?? '');
  const [apiToken, setApiToken] = useState('');
  const [recipient, setRecipient] = useState(delivery?.recipient ?? '');
  const [senderId, setSenderId] = useState(delivery?.senderId ?? '');

  const isWebhook = kind === DeliveryKind.Webhook;
  const isEmail = kind === DeliveryKind.Email;
  /** The three that are a token and somewhere to put the message. */
  const isChat = !isWebhook && !isEmail;

  /** A token is kept when the form leaves it empty, exactly as the webhook address is. */
  const tokenReady = !!apiToken.trim() || (delivery?.hasApiToken ?? false);
  const ready =
    !!name.trim() &&
    (isWebhook
      ? !!url.trim() || (delivery?.hasUrl ?? false)
      : isEmail
        ? !!smtpHost.trim() && !!toAddresses.trim() && !!fromAddress.trim()
        : tokenReady &&
          !!recipient.trim() &&
          (kind !== DeliveryKind.WhatsApp || !!senderId.trim()));

  /** What each chat tool calls the place a message lands, and what one looks like. */
  const recipientWording = {
    [DeliveryKind.Telegram]: {
      label: t('Alerts.CHAT_ID'),
      placeholder: '-1001234567890',
      hint: t('Alerts.CHAT_ID_HINT'),
    },
    [DeliveryKind.Slack]: {
      label: t('Alerts.CHANNEL'),
      placeholder: '#alerts',
      hint: t('Alerts.CHANNEL_HINT'),
    },
    [DeliveryKind.WhatsApp]: {
      label: t('Alerts.PHONE_NUMBER'),
      placeholder: '+905551112233',
      hint: t('Alerts.PHONE_NUMBER_HINT'),
    },
  };

  const submit = () =>
    save.mutate(
      {
        id: delivery?.id,
        request: {
          name: name.trim(),
          kind,
          enabled,
          // Absent rather than empty when untouched: an empty string means "clear it".
          url: url.trim() === '' ? undefined : url.trim(),
          headerName: headerName.trim(),
          headerValue: headerValue === '' ? undefined : headerValue,
          smtpHost: smtpHost.trim(),
          smtpPort: smtpPort === '' ? null : Number(smtpPort),
          smtpTls,
          username: username.trim(),
          password: password === '' ? undefined : password,
          fromAddress: fromAddress.trim(),
          toAddresses: toAddresses.trim(),
          apiToken: apiToken === '' ? undefined : apiToken.trim(),
          recipient: recipient.trim(),
          senderId: senderId.trim(),
        },
      },
      { onSuccess: onClose },
    );

  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-label={t('Alerts.DELIVERY_ADD_TITLE')}>
      <ModalHeader
        title={delivery ? t('Alerts.DELIVERY_EDIT_TITLE') : t('Alerts.DELIVERY_ADD_TITLE')}
      />
      <ModalBody>
        <Form
          id="alert-delivery-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) {
              submit();
            }
          }}
        >
          <FormGroup label={t('Alerts.NAME')} isRequired fieldId="alert-delivery-name">
            <TextInput
              id="alert-delivery-name"
              value={name}
              onChange={(_event, value) => setName(value)}
              placeholder={t('Alerts.DELIVERY_NAME_PLACEHOLDER')}
            />
          </FormGroup>

          <FormGroup label={t('Alerts.KIND')} isRequired fieldId="alert-delivery-kind">
            <FormSelect
              id="alert-delivery-kind"
              value={kind}
              onChange={(_event, value) => setKind(value as DeliveryKind)}
            >
              <FormSelectOption value={DeliveryKind.Webhook} label={t('Alerts.KIND_WEBHOOK')} />
              <FormSelectOption value={DeliveryKind.Email} label={t('Alerts.KIND_EMAIL')} />
              <FormSelectOption value={DeliveryKind.Telegram} label={t('Alerts.KIND_TELEGRAM')} />
              <FormSelectOption value={DeliveryKind.Slack} label={t('Alerts.KIND_SLACK')} />
              <FormSelectOption value={DeliveryKind.WhatsApp} label={t('Alerts.KIND_WHATSAPP')} />
            </FormSelect>
            <FormHelperText>
              <HelperText>
                <HelperTextItem>{t(`Alerts.KIND_${kind}_HINT` as const)}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>

          {isChat ? (
            <FormSection title={t(`Alerts.KIND_${kind}` as const)}>
              <FormGroup
                label={t('Alerts.API_TOKEN')}
                isRequired={!delivery?.hasApiToken}
                fieldId="alert-delivery-token"
              >
                <PasswordInput
                  id="alert-delivery-token"
                  value={apiToken}
                  onChange={(_event, value) => setApiToken(value)}
                  placeholder={delivery?.hasApiToken ? t('Alerts.SECRET_KEPT') : ''}
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>{t(`Alerts.API_TOKEN_${kind}_HINT` as const)}</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
              <FormGroup
                label={recipientWording[kind].label}
                isRequired
                fieldId="alert-delivery-recipient"
              >
                <TextInput
                  id="alert-delivery-recipient"
                  value={recipient}
                  onChange={(_event, value) => setRecipient(value)}
                  placeholder={recipientWording[kind].placeholder}
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>{recipientWording[kind].hint}</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
              {kind === DeliveryKind.WhatsApp ? (
                <FormGroup label={t('Alerts.SENDER_ID')} isRequired fieldId="alert-delivery-sender">
                  <TextInput
                    id="alert-delivery-sender"
                    value={senderId}
                    onChange={(_event, value) => setSenderId(value)}
                    placeholder="123456789012345"
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>{t('Alerts.SENDER_ID_HINT')}</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
              ) : null}
            </FormSection>
          ) : isWebhook ? (
            <FormSection title={t('Alerts.KIND_WEBHOOK')}>
              <FormGroup
                label={t('Alerts.URL')}
                isRequired={!delivery?.hasUrl}
                fieldId="alert-delivery-url"
              >
                <TextInput
                  id="alert-delivery-url"
                  value={url}
                  onChange={(_event, value) => setUrl(value)}
                  placeholder={
                    delivery?.hasUrl
                      ? t('Alerts.URL_KEPT', { host: delivery.urlHost ?? '' })
                      : 'https://hooks.slack.com/services/...'
                  }
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>{t('Alerts.URL_HINT')}</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
              <FormGroup label={t('Alerts.HEADER_NAME')} fieldId="alert-delivery-header">
                <TextInput
                  id="alert-delivery-header"
                  value={headerName}
                  onChange={(_event, value) => setHeaderName(value)}
                  placeholder="Authorization"
                />
              </FormGroup>
              <FormGroup label={t('Alerts.HEADER_VALUE')} fieldId="alert-delivery-header-value">
                <PasswordInput
                  id="alert-delivery-header-value"
                  value={headerValue}
                  onChange={(_event, value) => setHeaderValue(value)}
                  placeholder={delivery?.hasSecret ? t('Alerts.SECRET_KEPT') : ''}
                />
              </FormGroup>
            </FormSection>
          ) : (
            <FormSection title={t('Alerts.KIND_EMAIL')}>
              <FormGroup label={t('Alerts.SMTP_HOST')} isRequired fieldId="alert-delivery-smtp">
                <TextInput
                  id="alert-delivery-smtp"
                  value={smtpHost}
                  onChange={(_event, value) => setSmtpHost(value)}
                  placeholder="smtp.example.com"
                />
              </FormGroup>
              <FormGroup label={t('Alerts.SMTP_PORT')} fieldId="alert-delivery-smtp-port">
                <TextInput
                  id="alert-delivery-smtp-port"
                  type="number"
                  value={smtpPort}
                  onChange={(_event, value) => setSmtpPort(value)}
                />
              </FormGroup>
              <FormGroup fieldId="alert-delivery-tls">
                <Switch
                  id="alert-delivery-tls"
                  label={t('Alerts.SMTP_TLS')}
                  isChecked={smtpTls}
                  onChange={(_event, checked) => setSmtpTls(checked)}
                />
              </FormGroup>
              <FormGroup label={t('Alerts.USERNAME')} fieldId="alert-delivery-username">
                <TextInput
                  id="alert-delivery-username"
                  value={username}
                  onChange={(_event, value) => setUsername(value)}
                />
              </FormGroup>
              <FormGroup label={t('Alerts.PASSWORD')} fieldId="alert-delivery-password">
                <PasswordInput
                  id="alert-delivery-password"
                  value={password}
                  onChange={(_event, value) => setPassword(value)}
                  placeholder={delivery?.hasPassword ? t('Alerts.SECRET_KEPT') : ''}
                />
              </FormGroup>
              <FormGroup label={t('Alerts.FROM')} isRequired fieldId="alert-delivery-from">
                <TextInput
                  id="alert-delivery-from"
                  value={fromAddress}
                  onChange={(_event, value) => setFromAddress(value)}
                  placeholder="keydra@example.com"
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>{t('Alerts.FROM_HINT')}</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
              <FormGroup label={t('Alerts.TO')} isRequired fieldId="alert-delivery-to">
                <TextInput
                  id="alert-delivery-to"
                  value={toAddresses}
                  onChange={(_event, value) => setToAddresses(value)}
                  placeholder="on-call@example.com, ops@example.com"
                />
              </FormGroup>
            </FormSection>
          )}

          <FormGroup fieldId="alert-delivery-enabled">
            <Switch
              id="alert-delivery-enabled"
              label={t('Alerts.ENABLED')}
              isChecked={enabled}
              onChange={(_event, checked) => setEnabled(checked)}
            />
          </FormGroup>

          {save.isError && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error">{save.error.message}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          form="alert-delivery-form"
          onClick={submit}
          isDisabled={!ready || save.isPending}
          isLoading={save.isPending}
        >
          {t('Alerts.SAVE')}
        </Button>
        <Button variant="link" onClick={onClose}>
          {t('Alerts.CANCEL')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
