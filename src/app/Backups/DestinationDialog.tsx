import type { FC } from 'react';
import { useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  ClipboardCopy,
  Flex,
  FlexItem,
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
  ModalHeader,
  Wizard,
  WizardStep,
  Radio,
  Switch,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import { PlusCircleIcon, TrashIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { PasswordInput } from '@app/Shared/Components/PasswordInput';
import { useTunnels } from '@app/Tunnels/queries';
import { useCheckDestinationDraft, useGenerateKeyPair, useSaveDestination } from './queries';
import { canTunnel, DestinationKind } from './types';
import type { BackupRecipient, DestinationRequest, DestinationSummary } from './types';

export interface DestinationDialogProps {
  /** Absent for a new destination. */
  destination?: DestinationSummary;
  onClose: () => void;
}

/**
 * Writing down somewhere backups can go.
 *
 * <p>The kind decides the form. A bucket and a host are the same question asked of different
 * protocols, so they share a field and only its label changes — which is also how the row behind
 * this is shaped, and why adding a kind is a case rather than a migration.
 *
 * <p>Secrets start empty even when editing, and an empty one leaves the stored one alone. Nothing
 * can read a secret back to prefill it, and treating empty as "clear it" would drop the credential
 * every time somebody corrected a label.
 */
export const DestinationDialog: FC<DestinationDialogProps> = ({ destination, onClose }) => {
  const { t } = useTranslation();
  const save = useSaveDestination();
  const check = useCheckDestinationDraft();

  const [name, setName] = useState(destination?.name ?? '');
  const [kind, setKind] = useState<DestinationKind>(destination?.kind ?? DestinationKind.Local);
  const [enabled, setEnabled] = useState(destination?.enabled ?? true);
  const [location, setLocation] = useState(destination?.location ?? '');
  const [path, setPath] = useState(destination?.path ?? '');
  const [port, setPort] = useState(destination?.port ? String(destination.port) : '');
  const [endpoint, setEndpoint] = useState(destination?.endpoint ?? '');
  const [region, setRegion] = useState(destination?.region ?? '');
  const [pathStyle, setPathStyle] = useState(destination?.pathStyle ?? false);
  const [accessKey, setAccessKey] = useState(destination?.accessKey ?? '');
  const [secretKey, setSecretKey] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [tls, setTls] = useState(destination?.tls ?? false);
  const [tunnelId, setTunnelId] = useState<number | null>(destination?.tunnelId ?? null);
  const [encryptionPassphrase, setEncryptionPassphrase] = useState('');
  /**
   * The keys backups here can be opened with.
   *
   * <p>A list rather than one, because one recipient means the person holding that private half is
   * the only person who can read a year of backups.
   */
  const [recipients, setRecipients] = useState<BackupRecipient[]>(destination?.recipients ?? []);
  /**
   * How backups sent here are sealed.
   *
   * <p>A place has one way in. Two would be a question about which one any given file used —
   * answerable by opening it, and by nobody looking at this form.
   */
  const [sealing, setSealing] = useState<'none' | 'passphrase' | 'key'>(
    destination?.recipients?.length ? 'key' : destination?.encrypts ? 'passphrase' : 'none',
  );
  const generate = useGenerateKeyPair();
  /** A private half just generated. Shown once, here, and held nowhere else. */
  const [handedOver, setHandedOver] = useState<string | undefined>();
  const tunnels = useTunnels();

  const isObjectStore =
    kind === DestinationKind.S3 ||
    kind === DestinationKind.AzureBlob ||
    kind === DestinationKind.Gcs;
  const needsLocation = kind !== DestinationKind.Local;
  const needsUser = kind === DestinationKind.Sftp || kind === DestinationKind.AzureBlob;
  const ready =
    !!name.trim() && (!needsLocation || !!location.trim()) && (!needsUser || !!accessKey.trim());

  /** What the form currently describes, which both the save and the test send. */
  const asRequest = (): DestinationRequest => ({
    name: name.trim(),
    kind,
    enabled,
    location: location.trim() || null,
    path: path.trim() || null,
    port: port ? Number(port) : null,
    endpoint: endpoint.trim() || null,
    region: region.trim() || null,
    pathStyle,
    accessKey: accessKey.trim() || null,
    tls,
    // Only where a forwarded port can reach: a public cloud is named by an address inside
    // a certificate, and pointing one at 127.0.0.1 is a TLS failure rather than a route.
    tunnelId: canTunnel(kind) ? tunnelId : null,
    // Only sent when typed. Absent means keep.
    ...(secretKey ? { secretKey } : {}),
    ...(privateKey ? { privateKey } : {}),
    ...(passphrase ? { passphrase } : {}),
    // Whichever way in was chosen, and an empty string to clear the other — which is how
    // this API says "remove what is stored", where absent means "leave it alone".
    encryptionPassphrase: sealing === 'passphrase' ? encryptionPassphrase || undefined : '',
    recipients:
      sealing === 'key'
        ? recipients
            .filter((recipient) => recipient.publicKey.trim())
            .map((recipient) => ({
              label: recipient.label.trim(),
              publicKey: recipient.publicKey.trim(),
            }))
        : [],
  });

  const submit = () =>
    save.mutate({ id: destination?.id, request: asRequest() }, { onSuccess: onClose });

  /** Spread into every step's footer: a step's footer replaces the wizard's rather than
      merging with it, so a step that only disables Next loses the labels. */
  const footerLabels = {
    nextButtonText: t('Backups.NEXT'),
    backButtonText: t('Backups.BACK'),
    cancelButtonText: t('Backups.CANCEL'),
  };

  const title = destination ? t('Backups.EDIT_DESTINATION') : t('Backups.ADD_DESTINATION');

  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-label={title}>
      <ModalHeader title={title} description={t('Backups.DESTINATION_INTRO')} />
      <ModalBody>
        <Wizard onClose={onClose} onSave={submit} navAriaLabel={title} footer={footerLabels}>
          <WizardStep
            id="destination-what"
            name={t('Backups.STEP_WHAT')}
            footer={{ ...footerLabels, isNextDisabled: !name.trim() }}
          >
            <Form isHorizontal>
              <FormGroup label={t('Backups.NAME')} isRequired fieldId="destination-name">
                <TextInput
                  id="destination-name"
                  value={name}
                  onChange={(_event, value) => setName(value)}
                  isRequired
                />
              </FormGroup>

              <FormGroup label={t('Backups.KIND')} isRequired fieldId="destination-kind">
                <FormSelect
                  id="destination-kind"
                  value={kind}
                  isDisabled={destination !== undefined}
                  onChange={(_event, value) => setKind(value as DestinationKind)}
                >
                  {Object.values(DestinationKind).map((value) => (
                    <FormSelectOption
                      key={value}
                      value={value}
                      label={t(`Backups.KIND_${value}` as 'Backups.KIND_LOCAL')}
                    />
                  ))}
                </FormSelect>
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem
                      variant={kind === DestinationKind.Custom ? 'warning' : 'default'}
                    >
                      {t(`Backups.KIND_${kind}_HELP` as 'Backups.KIND_LOCAL_HELP')}
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
            </Form>
          </WizardStep>

          <WizardStep id="destination-where" name={t('Backups.STEP_WHERE')}>
            <Form isHorizontal>
              {kind === DestinationKind.Local ? (
                <FormGroup label={t('Backups.DIRECTORY')} fieldId="destination-path">
                  <TextInput
                    id="destination-path"
                    value={path}
                    onChange={(_event, value) => setPath(value)}
                    placeholder="nightly"
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>{t('Backups.DIRECTORY_HELP')}</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
              ) : (
                <>
                  <FormGroup
                    label={t(`Backups.LOCATION_${kind}` as 'Backups.LOCATION_S3')}
                    isRequired
                    fieldId="destination-location"
                  >
                    <TextInput
                      id="destination-location"
                      value={location}
                      onChange={(_event, value) => setLocation(value)}
                      placeholder={t(
                        `Backups.LOCATION_${kind}_PLACEHOLDER` as 'Backups.LOCATION_S3_PLACEHOLDER',
                      )}
                      isRequired
                    />
                  </FormGroup>

                  {kind !== DestinationKind.Custom && (
                    <FormGroup
                      label={isObjectStore ? t('Backups.PREFIX') : t('Backups.REMOTE_DIRECTORY')}
                      fieldId="destination-path"
                    >
                      <TextInput
                        id="destination-path"
                        value={path}
                        onChange={(_event, value) => setPath(value)}
                      />
                    </FormGroup>
                  )}
                </>
              )}

              {(kind === DestinationKind.Sftp || kind === DestinationKind.Ftp) && (
                <FormGroup label={t('Backups.PORT')} fieldId="destination-port">
                  <TextInput
                    id="destination-port"
                    type="number"
                    value={port}
                    onChange={(_event, value) => setPort(value)}
                    placeholder={kind === DestinationKind.Sftp ? '22' : '21'}
                  />
                </FormGroup>
              )}

              {kind === DestinationKind.S3 && (
                <>
                  <FormGroup label={t('Backups.REGION')} fieldId="destination-region">
                    <TextInput
                      id="destination-region"
                      value={region}
                      onChange={(_event, value) => setRegion(value)}
                      placeholder="us-east-1"
                    />
                  </FormGroup>
                  <FormGroup label={t('Backups.ENDPOINT')} fieldId="destination-endpoint">
                    <TextInput
                      id="destination-endpoint"
                      value={endpoint}
                      onChange={(_event, value) => setEndpoint(value)}
                      placeholder="https://minio.internal:9000"
                    />
                    <FormHelperText>
                      <HelperText>
                        <HelperTextItem>{t('Backups.ENDPOINT_HELP')}</HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  </FormGroup>
                  <FormGroup fieldId="destination-path-style">
                    <Checkbox
                      id="destination-path-style"
                      label={t('Backups.PATH_STYLE')}
                      description={t('Backups.PATH_STYLE_HELP')}
                      isChecked={pathStyle}
                      onChange={(_event, checked) => setPathStyle(checked)}
                    />
                  </FormGroup>
                </>
              )}

              {kind === DestinationKind.Ftp && (
                <FormGroup fieldId="destination-tls">
                  <Checkbox
                    id="destination-tls"
                    label={t('Backups.FTPS')}
                    description={t('Backups.FTPS_HELP')}
                    isChecked={tls}
                    onChange={(_event, checked) => setTls(checked)}
                  />
                </FormGroup>
              )}

              {canTunnel(kind) && (
                <FormGroup label={t('Backups.TUNNEL')} fieldId="destination-tunnel">
                  <FormSelect
                    id="destination-tunnel"
                    value={tunnelId ?? ''}
                    onChange={(_event, value) => setTunnelId(value ? Number(value) : null)}
                  >
                    <FormSelectOption value="" label={t('Backups.TUNNEL_NONE')} />
                    {(tunnels.data ?? []).map((tunnel) => (
                      <FormSelectOption
                        key={tunnel.id}
                        value={tunnel.id}
                        label={`${tunnel.name} — ${tunnel.describedAs}`}
                      />
                    ))}
                  </FormSelect>
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>{t('Backups.TUNNEL_HELP')}</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
              )}

              {kind !== DestinationKind.Local && kind !== DestinationKind.Custom && (
                <FormSection title={t('Backups.CREDENTIALS')} titleElement="h3">
                  {/* Google's credential is a JSON document rather than a pair, so that kind
                  asks a different question and skips this one. */}
                  {kind !== DestinationKind.Gcs && (
                    <FormGroup
                      label={t(`Backups.ACCOUNT_${kind}` as 'Backups.ACCOUNT_S3')}
                      isRequired={needsUser}
                      fieldId="destination-access-key"
                    >
                      <TextInput
                        id="destination-access-key"
                        value={accessKey}
                        onChange={(_event, value) => setAccessKey(value)}
                      />
                      {kind === DestinationKind.S3 && (
                        <FormHelperText>
                          <HelperText>
                            <HelperTextItem>{t('Backups.ACCESS_KEY_HELP')}</HelperTextItem>
                          </HelperText>
                        </FormHelperText>
                      )}
                    </FormGroup>
                  )}

                  {kind === DestinationKind.Gcs ? (
                    <FormGroup
                      label={t('Backups.SERVICE_ACCOUNT_KEY')}
                      fieldId="destination-secret"
                    >
                      <TextArea
                        id="destination-secret"
                        value={secretKey}
                        onChange={(_event, value) => setSecretKey(value)}
                        rows={4}
                        placeholder={
                          destination?.hasSecret
                            ? t('Backups.STORED')
                            : '{ "type": "service_account"…'
                        }
                      />
                      <FormHelperText>
                        <HelperText>
                          <HelperTextItem>{t('Backups.SERVICE_ACCOUNT_KEY_HELP')}</HelperTextItem>
                        </HelperText>
                      </FormHelperText>
                    </FormGroup>
                  ) : (
                    <FormGroup
                      label={t(`Backups.SECRET_${kind}` as 'Backups.SECRET_S3')}
                      fieldId="destination-secret"
                    >
                      <PasswordInput
                        id="destination-secret"
                        value={secretKey}
                        onChange={(_event, value) => setSecretKey(value)}
                        placeholder={
                          destination?.hasSecret
                            ? t('Backups.STORED')
                            : t('Backups.SECRET_PLACEHOLDER')
                        }
                      />
                      <FormHelperText>
                        <HelperText>
                          {/* The same rule as the tunnel form: advice about keeping a stored
                              secret is only true once one is stored. */}
                          <HelperTextItem>
                            {destination?.hasSecret
                              ? t('Backups.SECRET_HELP')
                              : t('Backups.SECRET_NEW_HELP')}
                          </HelperTextItem>
                        </HelperText>
                      </FormHelperText>
                    </FormGroup>
                  )}

                  {kind === DestinationKind.Sftp && (
                    <>
                      <FormGroup label={t('Backups.PRIVATE_KEY')} fieldId="destination-private-key">
                        <TextArea
                          id="destination-private-key"
                          value={privateKey}
                          onChange={(_event, value) => setPrivateKey(value)}
                          rows={4}
                          placeholder={
                            destination?.hasPrivateKey
                              ? t('Backups.STORED')
                              : '-----BEGIN OPENSSH PRIVATE KEY-----'
                          }
                        />
                        <FormHelperText>
                          <HelperText>
                            <HelperTextItem>{t('Backups.PRIVATE_KEY_HELP')}</HelperTextItem>
                          </HelperText>
                        </FormHelperText>
                      </FormGroup>
                      <FormGroup label={t('Backups.PASSPHRASE')} fieldId="destination-passphrase">
                        <PasswordInput
                          id="destination-passphrase"
                          value={passphrase}
                          onChange={(_event, value) => setPassphrase(value)}
                        />
                      </FormGroup>
                    </>
                  )}
                </FormSection>
              )}
            </Form>
          </WizardStep>

          <WizardStep
            id="destination-sealing"
            name={t('Backups.STEP_SEALING')}
            footer={{
              ...footerLabels,
              nextButtonText: t('Backups.SAVE'),
              isNextDisabled: !ready || save.isPending,
            }}
          >
            <Form>
              <FormGroup
                label={t('Backups.SEALING')}
                isInline
                fieldId="destination-sealing"
                role="radiogroup"
              >
                <Radio
                  id="sealing-none"
                  name="sealing"
                  label={t('Backups.SEALING_NONE')}
                  isChecked={sealing === 'none'}
                  onChange={() => setSealing('none')}
                />
                <Radio
                  id="sealing-passphrase"
                  name="sealing"
                  label={t('Backups.SEALING_PASSPHRASE')}
                  isChecked={sealing === 'passphrase'}
                  onChange={() => setSealing('passphrase')}
                />
                <Radio
                  id="sealing-key"
                  name="sealing"
                  label={t('Backups.SEALING_KEY')}
                  isChecked={sealing === 'key'}
                  onChange={() => setSealing('key')}
                />
              </FormGroup>

              {sealing === 'passphrase' && (
                <>
                  <FormGroup label={t('Backups.PASSPHRASE')} fieldId="destination-encryption">
                    <PasswordInput
                      id="destination-encryption"
                      value={encryptionPassphrase}
                      onChange={(_event, value) => setEncryptionPassphrase(value)}
                      placeholder={destination?.encrypts ? t('Backups.STORED') : undefined}
                    />
                    <FormHelperText>
                      <HelperText>
                        <HelperTextItem>{t('Backups.PASSPHRASE_HELP')}</HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  </FormGroup>
                  <Alert
                    variant="warning"
                    isInline
                    isPlain
                    component="h4"
                    title={t('Backups.PASSPHRASE_WARNING_TITLE')}
                  >
                    {t('Backups.PASSPHRASE_WARNING_BODY')}
                  </Alert>
                </>
              )}

              {sealing === 'key' && (
                <>
                  {recipients.map((recipient, index) => (
                    <FormGroup
                      // The index is the identity here: two rows can hold the same empty key
                      // while somebody is still typing, so nothing else about a row is unique.
                      key={index}
                      label={t('Backups.RECIPIENT_N', { number: index + 1 })}
                      fieldId={`destination-recipient-${index}`}
                    >
                      <Flex
                        gap={{ default: 'gapSm' }}
                        alignItems={{ default: 'alignItemsFlexStart' }}
                      >
                        <FlexItem>
                          <TextInput
                            aria-label={t('Backups.RECIPIENT_LABEL')}
                            value={recipient.label}
                            placeholder={t('Backups.RECIPIENT_LABEL')}
                            onChange={(_event, value) =>
                              setRecipients((held) =>
                                held.map((row, at) =>
                                  at === index ? { ...row, label: value } : row,
                                ),
                              )
                            }
                          />
                        </FlexItem>
                        <FlexItem grow={{ default: 'grow' }}>
                          <TextInput
                            id={`destination-recipient-${index}`}
                            aria-label={t('Backups.RECIPIENT')}
                            value={recipient.publicKey}
                            placeholder="keydra-pk1:…"
                            onChange={(_event, value) =>
                              setRecipients((held) =>
                                held.map((row, at) =>
                                  at === index ? { ...row, publicKey: value } : row,
                                ),
                              )
                            }
                          />
                        </FlexItem>
                        <FlexItem>
                          <Button
                            variant="plain"
                            aria-label={t('Backups.RECIPIENT_REMOVE', {
                              label: recipient.label || index + 1,
                            })}
                            icon={<TrashIcon />}
                            onClick={() =>
                              setRecipients((held) => held.filter((_row, at) => at !== index))
                            }
                          />
                        </FlexItem>
                      </Flex>
                    </FormGroup>
                  ))}

                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>{t('Backups.RECIPIENT_HELP')}</HelperTextItem>
                    </HelperText>
                  </FormHelperText>

                  <Flex gap={{ default: 'gapSm' }}>
                    <FlexItem>
                      <Button
                        variant="secondary"
                        icon={<PlusCircleIcon />}
                        onClick={() =>
                          setRecipients((held) => [...held, { label: '', publicKey: '' }])
                        }
                      >
                        {t('Backups.RECIPIENT_ADD')}
                      </Button>
                    </FlexItem>
                    <FlexItem>
                      <Button
                        variant="secondary"
                        isDisabled={generate.isPending}
                        isLoading={generate.isPending}
                        onClick={() =>
                          generate.mutate(undefined, {
                            onSuccess: (pair) => {
                              setRecipients((held) => [
                                ...held,
                                {
                                  label: t('Backups.RECIPIENT_NEW', { number: held.length + 1 }),
                                  publicKey: pair.publicKey,
                                },
                              ]);
                              setHandedOver(pair.privateKey);
                            },
                          })
                        }
                      >
                        {t('Backups.GENERATE_PAIR')}
                      </Button>
                    </FlexItem>
                  </Flex>

                  {/*
                    The question this design produces, answered before it is asked. A key added
                    today opens the backups taken after today: a file carries the recipients it
                    was written to, and nothing rewrites a file in a bucket.
                  */}
                  <Alert
                    variant="info"
                    isInline
                    isPlain
                    component="h4"
                    title={t('Backups.RECIPIENT_LATER_TITLE')}
                  >
                    {t('Backups.RECIPIENT_LATER_BODY')}
                  </Alert>

                  {handedOver ? (
                    <Alert
                      variant="danger"
                      isInline
                      component="h4"
                      title={t('Backups.PRIVATE_HALF_TITLE')}
                    >
                      {t('Backups.PRIVATE_HALF_BODY')}
                      <ClipboardCopy
                        isReadOnly
                        isCode
                        hoverTip={t('Backups.COPY')}
                        clickTip={t('Backups.COPIED')}
                      >
                        {handedOver}
                      </ClipboardCopy>
                    </Alert>
                  ) : (
                    <Alert
                      variant="info"
                      isInline
                      isPlain
                      component="h4"
                      title={t('Backups.RECIPIENT_TITLE')}
                    >
                      {t('Backups.RECIPIENT_BODY')}
                    </Alert>
                  )}
                </>
              )}

              {sealing === 'none' && (
                <Alert
                  variant="info"
                  isInline
                  isPlain
                  component="h4"
                  title={t('Backups.NO_ENCRYPTION_TITLE')}
                >
                  {t('Backups.NO_ENCRYPTION_BODY')}
                </Alert>
              )}
              <FormGroup fieldId="destination-enabled">
                <Switch
                  id="destination-enabled"
                  label={t('Backups.ENABLED')}
                  isChecked={enabled}
                  onChange={(_event, checked) => setEnabled(checked)}
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>{t('Backups.ENABLED_HELP')}</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>

              {/* The whole round trip before anything is stored: write a small file, look for
                it, remove it again. Credentials that can log in and not write are the
                commonest way a destination is wrong, and a backup schedule finding that out
                at three in the morning is the worst possible reader of that news. */}
              <FormGroup fieldId="destination-test">
                <Button
                  variant="secondary"
                  isDisabled={!ready || check.isPending}
                  isLoading={check.isPending}
                  onClick={() => check.mutate({ id: destination?.id, request: asRequest() })}
                >
                  {t('Backups.TEST')}
                </Button>
              </FormGroup>

              {check.data && (
                <Alert
                  variant={check.data.reachable ? 'success' : 'danger'}
                  isInline
                  component="h4"
                  title={check.data.reachable ? t('Backups.TEST_WORKED') : t('Backups.TEST_FAILED')}
                >
                  {check.data.message}
                </Alert>
              )}

              {check.isError && (
                <Alert variant="danger" isInline component="h4" title={t('Backups.TEST_FAILED')}>
                  {check.error.message}
                </Alert>
              )}

              {save.isError && (
                <Alert variant="danger" isInline component="h4" title={t('Backups.SAVE_FAILED')}>
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
