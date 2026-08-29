import type { FC } from 'react';
import { useState } from 'react';
import {
  Alert,
  Button,
  FileUpload,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalHeader,
  TextInput,
  Wizard,
  WizardStep,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { PasswordInput } from '@app/Shared/Components/PasswordInput';
import { useCheckTunnelDraft, useSaveTunnel } from './queries';
import type { TunnelRequest, TunnelSummary } from './types';

export interface TunnelDialogProps {
  /** Absent for a new tunnel. */
  tunnel?: TunnelSummary;
  /** A fingerprint a check just saw, offered so pinning it is one click. */
  suggestedFingerprint?: string;
  onClose: () => void;
}

/**
 * Describing a jump host, one question at a time.
 *
 * <p>A wizard rather than one long form, because the three questions are answered by different
 * things: where the jump host is comes from an inventory, how to log in comes from a key file
 * somebody has on disk, and which host key to expect comes from the jump host itself — which is
 * why the last step can go and ask it.
 *
 * <p>Secrets start empty even when editing, and an empty one leaves the stored one alone: nothing
 * can read a secret back to prefill it, and treating empty as "clear it" would take every target
 * behind this jump host offline the next time somebody corrected a label.
 */
export const TunnelDialog: FC<TunnelDialogProps> = ({ tunnel, suggestedFingerprint, onClose }) => {
  const { t } = useTranslation();
  const save = useSaveTunnel();
  const check = useCheckTunnelDraft();

  const [name, setName] = useState(tunnel?.name ?? '');
  const [host, setHost] = useState(tunnel?.host ?? '');
  const [port, setPort] = useState(String(tunnel?.port ?? 22));
  const [username, setUsername] = useState(tunnel?.username ?? '');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [keyFilename, setKeyFilename] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [fingerprint, setFingerprint] = useState(
    suggestedFingerprint ?? tunnel?.hostKeyFingerprint ?? '',
  );

  const hasStoredCredential = (tunnel?.hasPassword ?? false) || (tunnel?.hasPrivateKey ?? false);
  const reachable = !!name.trim() && !!host.trim() && !!username.trim();
  const ready = reachable && (hasStoredCredential || !!password || !!privateKey);

  const asRequest = (): TunnelRequest => ({
    name: name.trim(),
    host: host.trim(),
    port: Number(port) || 22,
    username: username.trim(),
    hostKeyFingerprint: fingerprint.trim() || null,
    ...(password ? { password } : {}),
    ...(privateKey ? { privateKey } : {}),
    ...(passphrase ? { passphrase } : {}),
  });

  const submit = () =>
    save.mutate({ id: tunnel?.id, request: asRequest() }, { onSuccess: onClose });

  const title = tunnel ? t('Tunnels.EDIT') : t('Tunnels.ADD');

  /** Spread into every step's footer: a step's footer replaces the wizard's rather than
      merging with it, so a step that only disables Next loses the labels. */
  const footerLabels = {
    nextButtonText: t('Tunnels.NEXT'),
    backButtonText: t('Tunnels.BACK'),
    cancelButtonText: t('Tunnels.CANCEL'),
  };
  const result = check.data;

  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-label={title}>
      <ModalHeader title={title} description={t('Tunnels.INTRO')} />
      <ModalBody>
        <Wizard
          onClose={onClose}
          onSave={submit}
          isVisitRequired
          title={title}
          navAriaLabel={title}
          // The wizard's own buttons, said in the application's language: PatternFly ships
          // English defaults, and a Turkish form with an English "Next" in it is a form that
          // was translated by somebody who stopped halfway.
          footer={footerLabels}
        >
          <WizardStep
            name={t('Tunnels.STEP_WHERE')}
            id="tunnel-where"
            footer={{ ...footerLabels, isNextDisabled: !reachable }}
          >
            <Form>
              <FormGroup label={t('Tunnels.NAME')} isRequired fieldId="tunnel-name">
                <TextInput
                  id="tunnel-name"
                  value={name}
                  onChange={(_event, value) => setName(value)}
                  isRequired
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>{t('Tunnels.NAME_HELP')}</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>

              <FormGroup label={t('Tunnels.HOST')} isRequired fieldId="tunnel-host">
                <TextInput
                  id="tunnel-host"
                  value={host}
                  onChange={(_event, value) => setHost(value)}
                  placeholder="jump.internal"
                  isRequired
                />
              </FormGroup>

              <FormGroup label={t('Tunnels.PORT')} fieldId="tunnel-port">
                <TextInput
                  id="tunnel-port"
                  type="number"
                  value={port}
                  onChange={(_event, value) => setPort(value)}
                  placeholder="22"
                />
              </FormGroup>

              <FormGroup label={t('Tunnels.USERNAME')} isRequired fieldId="tunnel-username">
                <TextInput
                  id="tunnel-username"
                  value={username}
                  onChange={(_event, value) => setUsername(value)}
                  isRequired
                />
              </FormGroup>
            </Form>
          </WizardStep>

          <WizardStep
            name={t('Tunnels.STEP_LOGIN')}
            id="tunnel-login"
            footer={{ ...footerLabels, isNextDisabled: !ready }}
          >
            <Form>
              <FormGroup label={t('Tunnels.PRIVATE_KEY')} fieldId="tunnel-private-key">
                {/* Typed or dropped: a private key lives in a file on somebody's machine, and
                    asking them to open it in an editor and paste it is asking them to put it
                    on a clipboard. Read in the browser — the file never goes anywhere except
                    into the request that stores the key encrypted. */}
                <FileUpload
                  id="tunnel-private-key"
                  type="text"
                  value={privateKey}
                  filename={keyFilename}
                  filenamePlaceholder={t('Tunnels.KEY_FILE_PLACEHOLDER')}
                  browseButtonText={t('Tunnels.BROWSE')}
                  clearButtonText={t('Tunnels.CLEAR')}
                  onFileInputChange={(_event, file) => setKeyFilename(file.name)}
                  onDataChange={(_event, value) => setPrivateKey(value)}
                  onTextChange={(_event, value) => setPrivateKey(value)}
                  onClearClick={() => {
                    setKeyFilename('');
                    setPrivateKey('');
                  }}
                  allowEditingUploadedText
                  hideDefaultPreview={false}
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>
                      {tunnel?.hasPrivateKey
                        ? t('Tunnels.PRIVATE_KEY_STORED')
                        : t('Tunnels.PRIVATE_KEY_HELP')}
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>

              <FormGroup label={t('Tunnels.PASSPHRASE')} fieldId="tunnel-passphrase">
                <PasswordInput
                  id="tunnel-passphrase"
                  value={passphrase}
                  onChange={(_event, value) => setPassphrase(value)}
                />
              </FormGroup>

              <FormGroup label={t('Tunnels.PASSWORD')} fieldId="tunnel-password">
                <PasswordInput
                  id="tunnel-password"
                  value={password}
                  onChange={(_event, value) => setPassword(value)}
                  placeholder={
                    tunnel?.hasPassword ? t('Tunnels.STORED') : t('Tunnels.PASSWORD_PLACEHOLDER')
                  }
                />
                <FormHelperText>
                  <HelperText>
                    {/* "Leave it empty to keep what is stored" is advice about a secret that
                        exists. On a tunnel being created there is nothing to keep, and the
                        sentence describes a state the form is not in. */}
                    <HelperTextItem>
                      {tunnel?.hasPassword
                        ? t('Tunnels.SECRET_HELP')
                        : t('Tunnels.SECRET_NEW_HELP')}
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
            </Form>
          </WizardStep>

          <WizardStep
            name={t('Tunnels.STEP_HOST_KEY')}
            id="tunnel-host-key"
            footer={{
              ...footerLabels,
              nextButtonText: t('Tunnels.SAVE'),
              isNextDisabled: !ready || save.isPending,
            }}
          >
            <Form>
              <FormGroup label={t('Tunnels.FINGERPRINT')} fieldId="tunnel-fingerprint">
                <TextInput
                  id="tunnel-fingerprint"
                  value={fingerprint}
                  onChange={(_event, value) => setFingerprint(value)}
                  placeholder="SHA256:…"
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>{t('Tunnels.FINGERPRINT_HELP')}</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>

              {/* The test belongs here rather than beside the credentials: what it answers is
                  the key the jump host presented, which is the field above it. */}
              <FormGroup fieldId="tunnel-test">
                <Button
                  variant="secondary"
                  isDisabled={!ready || check.isPending}
                  isLoading={check.isPending}
                  onClick={() => check.mutate({ id: tunnel?.id, request: asRequest() })}
                >
                  {t('Tunnels.TEST')}
                </Button>
              </FormGroup>

              {result && (
                <Alert
                  variant={result.reachable ? 'success' : 'danger'}
                  isInline
                  component="h4"
                  title={result.reachable ? t('Tunnels.TEST_WORKED') : t('Tunnels.TEST_FAILED')}
                  actionLinks={
                    result.fingerprint && result.fingerprint !== fingerprint ? (
                      <Button
                        variant="link"
                        isInline
                        onClick={() => setFingerprint(result.fingerprint!)}
                      >
                        {t('Tunnels.PIN_THIS_KEY')}
                      </Button>
                    ) : undefined
                  }
                >
                  {result.message}
                  {result.fingerprint && (
                    <div className="pf-v6-u-font-family-monospace pf-v6-u-font-size-sm">
                      {result.fingerprint}
                    </div>
                  )}
                </Alert>
              )}

              {check.isError && (
                <Alert variant="danger" isInline component="h4" title={t('Tunnels.TEST_FAILED')}>
                  {check.error.message}
                </Alert>
              )}

              {!fingerprint.trim() && !result && !check.isError && (
                <Alert
                  variant="warning"
                  isInline
                  isPlain
                  component="h4"
                  title={t('Tunnels.NO_FINGERPRINT_TITLE')}
                >
                  {t('Tunnels.NO_FINGERPRINT_BODY')}
                </Alert>
              )}

              {save.isError && (
                <Alert variant="danger" isInline component="h4" title={t('Tunnels.SAVE_FAILED')}>
                  {save.error.message}
                </Alert>
              )}
            </Form>
          </WizardStep>
        </Wizard>
      </ModalBody>
    </Modal>
  );
};
