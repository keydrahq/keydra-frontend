import type { FC } from 'react';
import { useState } from 'react';
import {
  ActionList,
  ActionListGroup,
  ActionListItem,
  Alert,
  Button,
  Checkbox,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  Form,
  FormAlert,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  Popover,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalHeader,
  Wizard,
  WizardFooterWrapper,
  WizardStep,
  useWizardContext,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import { HelpIcon, UsersIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { PasswordInput } from '@app/Shared/Components/PasswordInput';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { useServerGroups } from '@app/Access/queries';
import { ServerGroupPicker } from '@app/Access/ServerGroupPicker';
import { useTunnels } from '@app/Tunnels/queries';
import { describeConsoleReason } from '@app/Console/consoleReasons';
import { useAskableCommands } from '@app/Console/queries';
import { useTestConnectionDraft } from './queries';
import type { ConnectionRequest, ConnectionResponse } from '@app/Shared/Services/api.types';
import { parseConnectionUrl } from './connectionUrl';
import {
  ConnectionState,
  ConnectionType,
  EngineType,
  ServerFlavor,
} from '@app/Shared/Services/api.types';
import { connectionTypeKey } from './labels';
import { serverName } from './serverLogo';

export interface ConnectionFormModalProps {
  /**
   * Absent means "create"; present means "edit that profile".
   *
   * <p>The form seeds its state from this once. The parent mounts the modal only
   * while it is open, so reopening it starts from fresh state without an effect
   * synchronising props into state.
   */
  profile?: ConnectionResponse;
  error?: string;
  isSubmitting: boolean;
  onSubmit: (request: ConnectionRequest) => void;
  onCancel: () => void;
  /** The server groups this target is in, as the dialog has them. */
  serverGroups: number[];
  onServerGroupsChange: (chosen: number[]) => void;
}

/** Above this many groups a search box earns its place; below it, it is noise. */
const SEARCHABLE_ABOVE = 8;

/**
 * Which server groups this target should be in.
 *
 * <p>Here rather than only on the Access page because it is part of the same decision:
 * somebody adding a server has just been told which team it belongs to, and asking them to
 * remember to go somewhere else afterwards is how a target ends up in no group and visible to
 * nobody but an administrator.
 *
 * <p>Membership is applied after the profile is saved — a new one has no id to put anywhere
 * until then — so this is state the dialog collects and the page acts on.
 */
const AccessTab: FC<{
  chosen: number[];
  onChange: (chosen: number[]) => void;
}> = ({ chosen, onChange }) => {
  const { t } = useTranslation();
  const groups = useServerGroups();

  if (groups.isPending) {
    return <LoadingView />;
  }
  if (groups.isError || (groups.data ?? []).length === 0) {
    return (
      <EmptyState
        titleText={t('Connections.NO_SERVER_GROUPS')}
        icon={UsersIcon}
        headingLevel="h4"
        variant="sm"
      >
        <EmptyStateBody>{t('Connections.NO_SERVER_GROUPS_BODY')}</EmptyStateBody>
        <EmptyStateFooter>
          <EmptyStateActions>
            {/* A plain link, and a navigation away from a dialog: it goes to the page that
                creates them, which is where the answer to "there are none" lives. */}
            <Button variant="link" component="a" href="/access" isInline>
              {t('Connections.MANAGE_SERVER_GROUPS')}
            </Button>
          </EmptyStateActions>
        </EmptyStateFooter>
      </EmptyState>
    );
  }

  return (
    <FormGroup label={t('Connections.IN_SERVER_GROUPS')} fieldId="connection-server-groups">
      {/* The same picker the catalog's filter uses, so a tree of groups is chosen from the
          same way wherever it is chosen from. */}
      <ServerGroupPicker
        groups={groups.data}
        chosen={chosen}
        onChange={onChange}
        isSearchable={groups.data.length > SEARCHABLE_ABOVE}
      />

      <FormHelperText>
        <HelperText>
          <HelperTextItem>{t('Connections.SERVER_GROUPS_HELP')}</HelperTextItem>
        </HelperText>
      </FormHelperText>
    </FormGroup>
  );
};

const emptyForm: ConnectionRequest = {
  name: '',
  host: 'localhost',
  port: 6379,
  username: null,
  password: null,
  tls: false,
  tlsCaCert: null,
  tlsClientCert: null,
  tlsClientKey: null,
  tlsClientKeyPassphrase: null,
  consoleAllowed: [],
  guarded: false,
  requiresApproval: false,
  database: 0,
  engine: EngineType.Resp,
  flavor: ServerFlavor.Unknown,
  type: ConnectionType.Standalone,
  sentinelMasterName: null,
  namespace: null,
  notes: null,
  tunnelId: null,
};

/**
 * The form as it should be sent, rather than as it is held.
 *
 * <p>One rule so far, and it exists because of a trap the certificates would otherwise set. They
 * are only shown while TLS is on, so a profile that has them and then has TLS turned off would be
 * sending certificates the server refuses — *certificates apply to a TLS connection, and TLS is off
 * for this target* — for fields nobody can see to clear. Turning TLS off is somebody saying this
 * target does not use it, so the certificates go with it.
 */
const submitted = (form: ConnectionRequest): ConnectionRequest =>
  form.tls
    ? form
    : {
        ...form,
        tlsCaCert: '',
        tlsClientCert: '',
        tlsClientKey: '',
        tlsClientKeyPassphrase: '',
      };

const toForm = (profile?: ConnectionResponse): ConnectionRequest =>
  profile
    ? {
        name: profile.name,
        host: profile.host,
        port: profile.port,
        username: profile.username,
        // The stored secret is never sent to the browser; leaving this null keeps it.
        password: null,
        tls: profile.tls,
        // The two certificates come back, because they are the public halves. The key does
        // not, and leaving it null is what keeps the stored one.
        tlsCaCert: profile.tlsCaCert,
        tlsClientCert: profile.tlsClientCert,
        tlsClientKey: null,
        tlsClientKeyPassphrase: null,
        consoleAllowed: profile.consoleAllowed,
        guarded: profile.guarded,
        requiresApproval: profile.requiresApproval,
        database: profile.database,
        engine: profile.engine,
        flavor: profile.flavor,
        type: profile.type,
        sentinelMasterName: profile.sentinelMasterName,
        namespace: profile.namespace,
        notes: profile.notes,
        tunnelId: profile.tunnelId,
      }
    : emptyForm;

/** The ports each engine listens on, so changing the server offers the right one. */
const DEFAULT_PORTS = [6379, 3000, 2379];

/** Create/edit form for a connection profile. */
/**
 * The authentication step's footer: the wizard's own buttons, plus the test.
 *
 * <p>Written out rather than configured, because a step's footer either takes the standard three
 * or is replaced entirely — there is no way to add a fourth button to the one PatternFly builds.
 * So this rebuilds it, in the order the other steps use, and puts the test after the pair that
 * moves through the wizard and before the link that abandons it.
 *
 * <p>The navigation callbacks come from the wizard's own context, which is why this is a component
 * and not a fragment: a footer passed as an element is rendered inside the wizard and can ask it
 * what Back and Next mean here.
 */
const AuthStepFooter: FC<{
  labels: { nextButtonText: string; backButtonText: string; cancelButtonText: string };
  canTest: boolean;
  isTesting: boolean;
  onTest: () => void;
}> = ({ labels, canTest, isTesting, onTest }) => {
  const { t } = useTranslation();
  const { goToNextStep, goToPrevStep, close } = useWizardContext();

  return (
    <WizardFooterWrapper>
      {/*
        The same ActionList that PatternFly's own footer builds, and it has to be: the wrapper is
        only the bar, and everything that puts space between buttons comes from the list inside it.
        Putting bare buttons in the wrapper is what left them touching.

        Three groups rather than the usual two. Back and Next are one thought — where in the wizard
        somebody is — and the test is a thing this step does, so it is not in with them; Cancel
        keeps its own group at the end, as everywhere else.
      */}
      <ActionList>
        <ActionListGroup>
          <ActionListItem>
            <Button variant="secondary" onClick={() => void goToPrevStep()}>
              {labels.backButtonText}
            </Button>
          </ActionListItem>
          <ActionListItem>
            <Button variant="primary" type="submit" onClick={() => void goToNextStep()}>
              {labels.nextButtonText}
            </Button>
          </ActionListItem>
        </ActionListGroup>
        <ActionListGroup>
          <ActionListItem>
            <Button
              variant="secondary"
              isDisabled={!canTest || isTesting}
              isLoading={isTesting}
              onClick={onTest}
            >
              {t('Connections.TEST')}
            </Button>
          </ActionListItem>
        </ActionListGroup>
        <ActionListGroup>
          <ActionListItem>
            <Button variant="link" onClick={close}>
              {labels.cancelButtonText}
            </Button>
          </ActionListItem>
        </ActionListGroup>
      </ActionList>
    </WizardFooterWrapper>
  );
};

export const ConnectionFormModal: FC<ConnectionFormModalProps> = ({
  profile,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
  serverGroups,
  onServerGroupsChange,
}) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState('server');
  const [form, setForm] = useState<ConnectionRequest>(() => toForm(profile));
  /** What was pasted, kept so the box shows it rather than swallowing it. */
  const [pastedUrl, setPastedUrl] = useState('');
  // The list to choose from. Describing a tunnel is an administrator's job; choosing one is
  // part of editing this target, so somebody who may do only the second gets an empty list
  // rather than an error.
  const tunnels = useTunnels();
  // What may be allowed is the console's own list, asked of the server rather than copied here.
  const askable = useAskableCommands();
  const test = useTestConnectionDraft();
  const chosenTunnel = (tunnels.data ?? []).find((tunnel) => tunnel.id === form.tunnelId);

  const set = <K extends keyof ConnectionRequest>(key: K, value: ConnectionRequest[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  /*
   * Choosing the server chooses the protocol, because they are not two decisions a person has.
   * Every flavour but one speaks RESP; Aerospike speaks its own, and the profile has to say which
   * engine will be used before anything has connected. Its default port comes with it — 3000 is
   * Aerospike's, and offering 6379 for it would be offering a wrong answer somebody has to notice.
   */
  const chooseServer = (flavor: ServerFlavor) => {
    const engine =
      flavor === ServerFlavor.Aerospike
        ? EngineType.Aerospike
        : flavor === ServerFlavor.Tikv
          ? EngineType.Tikv
          : EngineType.Resp;
    /*
     * The address a TiKV profile carries is its placement driver's, not a store's — the thing that
     * knows where the data is rather than the thing holding it — so its default port is 2379 and
     * not the 20160 a store listens on.
     */
    const defaultPort =
      engine === EngineType.Aerospike ? 3000 : engine === EngineType.Tikv ? 2379 : 6379;
    setForm((current) => ({
      ...current,
      flavor,
      engine,
      // Only when the port is still one of the defaults: somebody who typed a port meant it.
      port: DEFAULT_PORTS.includes(current.port) ? defaultPort : current.port,
      namespace: engine === EngineType.Aerospike ? (current.namespace ?? 'test') : null,
    }));
  };

  const isAerospike = form.engine === EngineType.Aerospike;
  const nameInvalid = form.name.trim() === '';
  const hostInvalid = form.host.trim() === '';
  const portInvalid = form.port < 1 || form.port > 65535;
  const canSubmit = !nameInvalid && !hostInvalid && !portInvalid && !isSubmitting;

  /**
   * The wizard's own buttons, said in the application's language.
   *
   * <p>Spread into every step that sets a footer of its own: a step's footer replaces the
   * wizard's rather than merging with it, so a step that only wanted to disable Next was
   * quietly taking the English defaults back.
   */
  const footerLabels = {
    nextButtonText: t('Connections.NEXT'),
    backButtonText: t('Connections.BACK'),
    cancelButtonText: t('CANCEL', { ns: 'common' }),
  };

  return (
    <Modal isOpen onClose={onCancel} variant="medium" aria-labelledby="connection-form-modal-title">
      <ModalHeader
        labelId="connection-form-modal-title"
        title={profile ? t('Connections.EDIT_TITLE') : t('Connections.CREATE_TITLE')}
      />
      {/* A floor under the body so the dialog keeps its size as the tabs are used. Without
          it the modal is as tall as whichever tab is open — three fields on one, seven on
          another — and the buttons at its foot move under the pointer between clicks.
          PatternFly has neither a prop nor a utility for this: its sizing utilities offer
          only 0 and 100%. */}
      <ModalBody className="keydra-form-modal__body">
        <>
          {/* Outside the wizard rather than inside a step: what failed was the save, which
              belongs to the dialog rather than to whichever step happens to be open.

              And deliberately not a <Form> around the whole wizard, which is what this was:
              a wizard's navigation is made of buttons, buttons inside a form submit it, and
              clicking a step name saved the profile and closed the dialog. Each step carries
              its own form now, and only the wizard's own Save submits anything. */}
          {error ? (
            <FormAlert>
              <Alert variant="danger" isInline title={error} />
            </FormAlert>
          ) : null}
          {/* A wizard rather than one long column: with a tunnel configured this form has
              sixteen fields, and a modal that grows past the window makes the buttons at
              its foot something you have to go looking for. Steps rather than tabs, because
              the four groups are answered in an order — there is no point choosing a tunnel
              before naming the server it reaches. Any step is still one click away for
              somebody who came back to change one field. */}
          <Wizard
            onClose={onCancel}
            onSave={() => {
              if (canSubmit) {
                onSubmit(submitted(form));
              }
            }}
            onStepChange={(_event, step) => setTab(String(step.id))}
            navAriaLabel={t('Connections.FORM_TABS')}
            footer={footerLabels}
          >
            <WizardStep
              id="server"
              name={t('Connections.TAB_SERVER')}
              footer={{
                ...footerLabels,
                isNextDisabled: nameInvalid || hostInvalid || portInvalid,
              }}
            >
              <Form isHorizontal>
                {/*
                  Above the fields it fills, and only when adding: managed Redis is handed out as
                  one string — rediss://default:token@host:6379 — and retyping a forty-character
                  token into six boxes is where a character goes missing. The failure that follows
                  says "authentication failed", which sends somebody to check the wrong thing.

                  Filling rather than replacing. What it writes is visible in the fields below and
                  can be corrected there, which a form that hid them behind a URL could not offer.
                */}
                {profile ? null : (
                  <FormGroup label={t('Connections.PASTE_URL')} fieldId="connection-url">
                    <TextInput
                      id="connection-url"
                      value={pastedUrl}
                      placeholder="rediss://default:token@host:6379"
                      onChange={(_, value) => {
                        setPastedUrl(value);
                        const parsed = parseConnectionUrl(value);
                        if (parsed) {
                          setForm((current) => ({ ...current, ...parsed }));
                        }
                      }}
                    />
                    <FormHelperText>
                      <HelperText>
                        <HelperTextItem
                          variant={
                            pastedUrl.trim() && !parseConnectionUrl(pastedUrl)
                              ? 'warning'
                              : 'default'
                          }
                        >
                          {pastedUrl.trim() && !parseConnectionUrl(pastedUrl)
                            ? t('Connections.PASTE_URL_UNREADABLE')
                            : t('Connections.PASTE_URL_HELP')}
                        </HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  </FormGroup>
                )}

                <FormGroup label={t('Connections.NAME')} isRequired fieldId="connection-name">
                  <TextInput
                    id="connection-name"
                    value={form.name}
                    onChange={(_, value) => set('name', value)}
                    validated={nameInvalid ? 'error' : 'default'}
                    isRequired
                  />
                  {nameInvalid ? (
                    <FormHelperText>
                      <HelperText>
                        <HelperTextItem variant="error">
                          {t('Connections.NAME_REQUIRED')}
                        </HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  ) : null}
                </FormGroup>

                <FormGroup
                  label={t('Connections.SERVER')}
                  fieldId="connection-flavor"
                  labelHelp={
                    <Popover bodyContent={t('Connections.SERVER_HELP')}>
                      <Button
                        variant="plain"
                        aria-label={t('Connections.SERVER_HELP_LABEL')}
                        icon={<HelpIcon />}
                      />
                    </Popover>
                  }
                >
                  {/* What is listening, as opposed to the protocol it speaks — Redis and Valkey
                    share one. Saying so is what lets the catalog draw the right mark before
                    anything has answered; once a target answers, its own word is used. */}
                  <FormSelect
                    id="connection-flavor"
                    value={form.flavor ?? ServerFlavor.Unknown}
                    onChange={(_, value) => chooseServer(value as ServerFlavor)}
                    aria-label={t('Connections.SERVER')}
                  >
                    {Object.values(ServerFlavor).map((flavor) => (
                      <FormSelectOption
                        key={flavor}
                        value={flavor}
                        label={
                          flavor === ServerFlavor.Unknown
                            ? t('Connections.SERVER_UNSTATED')
                            : serverName(flavor.toLowerCase())
                        }
                      />
                    ))}
                  </FormSelect>
                </FormGroup>

                {isAerospike ? (
                  <FormGroup label={t('Connections.NAMESPACE')} fieldId="connection-namespace">
                    <TextInput
                      id="connection-namespace"
                      value={form.namespace ?? ''}
                      onChange={(_, value) => set('namespace', value)}
                    />
                    <FormHelperText>
                      <HelperText>
                        <HelperTextItem>{t('Connections.NAMESPACE_HELP')}</HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  </FormGroup>
                ) : null}

                <FormGroup label={t('Connections.TYPE')} fieldId="connection-type">
                  <FormSelect
                    id="connection-type"
                    value={form.type}
                    onChange={(_, value) => set('type', value as ConnectionType)}
                  >
                    {Object.values(ConnectionType).map((type) => (
                      <FormSelectOption
                        key={type}
                        value={type}
                        label={t(connectionTypeKey(type))}
                      />
                    ))}
                  </FormSelect>
                </FormGroup>

                <FormGroup label={t('Connections.HOST')} isRequired fieldId="connection-host">
                  <TextInput
                    id="connection-host"
                    value={form.host}
                    onChange={(_, value) => set('host', value)}
                    validated={hostInvalid ? 'error' : 'default'}
                    isRequired
                  />
                </FormGroup>

                <FormGroup label={t('Connections.PORT')} isRequired fieldId="connection-port">
                  <TextInput
                    id="connection-port"
                    type="number"
                    value={form.port}
                    onChange={(_, value) => set('port', Number(value))}
                    validated={portInvalid ? 'error' : 'default'}
                    isRequired
                  />
                </FormGroup>

                {form.type === ConnectionType.Sentinel ? (
                  <FormGroup label={t('Connections.SENTINEL_MASTER')} fieldId="connection-sentinel">
                    <TextInput
                      id="connection-sentinel"
                      value={form.sentinelMasterName ?? ''}
                      onChange={(_, value) => set('sentinelMasterName', value || null)}
                    />
                  </FormGroup>
                ) : null}

                {form.type === ConnectionType.Standalone ? (
                  <FormGroup label={t('Connections.DATABASE')} fieldId="connection-database">
                    <TextInput
                      id="connection-database"
                      type="number"
                      value={form.database}
                      onChange={(_, value) => set('database', Number(value))}
                    />
                  </FormGroup>
                ) : null}

                <FormGroup label={t('Connections.NOTES')} fieldId="connection-notes">
                  <TextArea
                    id="connection-notes"
                    value={form.notes ?? ''}
                    onChange={(_, value) => set('notes', value || null)}
                    rows={2}
                  />
                </FormGroup>
              </Form>
            </WizardStep>

            <WizardStep
              id="auth"
              name={t('Connections.TAB_AUTH')}
              // The test lives in the footer with the other buttons rather than above the fields
              // it is about. It is an action on the step, and the step's actions are along the
              // bottom; floating one over the form made it read as part of the form.
              footer={
                <AuthStepFooter
                  labels={footerLabels}
                  canTest={!hostInvalid && !portInvalid}
                  isTesting={test.isPending}
                  onTest={() => test.mutate({ id: profile?.id, request: form })}
                />
              }
            >
              <Form isHorizontal>
                {test.data ? (
                  <Alert
                    variant={test.data.state === ConnectionState.Up ? 'success' : 'danger'}
                    isInline
                    component="h4"
                    title={
                      test.data.state === ConnectionState.Up
                        ? t('Connections.TEST_WORKED')
                        : t('Connections.TEST_FAILED')
                    }
                  >
                    {test.data.server
                      ? `${serverName(test.data.server.flavor)} ${test.data.server.version ?? ''}`.trim()
                      : (test.data.message ?? '')}
                  </Alert>
                ) : null}

                {test.isError ? (
                  <Alert
                    variant="danger"
                    isInline
                    component="h4"
                    title={t('Connections.TEST_FAILED')}
                  >
                    {test.error.message}
                  </Alert>
                ) : null}

                <FormGroup label={t('Connections.USERNAME')} fieldId="connection-username">
                  <TextInput
                    id="connection-username"
                    value={form.username ?? ''}
                    onChange={(_, value) => set('username', value || null)}
                  />
                </FormGroup>

                <FormGroup label={t('Connections.PASSWORD')} fieldId="connection-password">
                  <PasswordInput
                    id="connection-password"
                    autoComplete="new-password"
                    value={form.password ?? ''}
                    onChange={(_, value) => set('password', value)}
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>
                        {profile?.hasPassword
                          ? t('Connections.PASSWORD_KEEP_HELP')
                          : t('Connections.PASSWORD_HELP')}
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>

                <FormGroup fieldId="connection-tls">
                  <Checkbox
                    id="connection-tls"
                    label={t('Connections.TLS')}
                    isChecked={form.tls}
                    onChange={(_, checked) => set('tls', checked)}
                  />
                </FormGroup>

                {/*
                  Only where a certificate can actually be presented. TiKV's client reads them
                  from files on disk rather than from here, so the server refuses them for that
                  engine rather than accepting a setting it will not use.
                */}
                {form.tls && form.engine !== EngineType.Tikv ? (
                  <>
                    <FormGroup label={t('Connections.TLS_CA')} fieldId="connection-tls-ca">
                      <TextArea
                        id="connection-tls-ca"
                        rows={4}
                        value={form.tlsCaCert ?? ''}
                        placeholder="-----BEGIN CERTIFICATE-----"
                        onChange={(_, value) => set('tlsCaCert', value)}
                      />
                      <FormHelperText>
                        <HelperText>
                          <HelperTextItem>{t('Connections.TLS_CA_HELP')}</HelperTextItem>
                        </HelperText>
                      </FormHelperText>
                    </FormGroup>

                    <FormGroup
                      label={t('Connections.TLS_CLIENT_CERT')}
                      fieldId="connection-tls-cert"
                    >
                      <TextArea
                        id="connection-tls-cert"
                        rows={4}
                        value={form.tlsClientCert ?? ''}
                        placeholder="-----BEGIN CERTIFICATE-----"
                        onChange={(_, value) => set('tlsClientCert', value)}
                      />
                    </FormGroup>

                    <FormGroup label={t('Connections.TLS_CLIENT_KEY')} fieldId="connection-tls-key">
                      <TextArea
                        id="connection-tls-key"
                        rows={4}
                        value={form.tlsClientKey ?? ''}
                        placeholder={
                          profile?.hasClientKey
                            ? t('Connections.TLS_KEY_STORED')
                            : '-----BEGIN PRIVATE KEY-----'
                        }
                        onChange={(_, value) => set('tlsClientKey', value)}
                      />
                      <FormHelperText>
                        <HelperText>
                          <HelperTextItem>{t('Connections.TLS_CLIENT_KEY_HELP')}</HelperTextItem>
                        </HelperText>
                      </FormHelperText>
                    </FormGroup>

                    {/*
                      For the keys that are locked, and shown beside the key rather than only when
                      one is — a stored key never comes back, so nothing here can tell whether the
                      one on the server needs this.

                      The passphrase itself goes no further than the server: the key is opened
                      before any client sees it. What it decides is whether the key can be read at
                      all, which is why a passphrase for a key that is not protected is refused
                      when this is saved rather than quietly ignored.
                    */}
                    <FormGroup
                      label={t('Connections.TLS_KEY_PASSPHRASE')}
                      fieldId="connection-tls-key-passphrase"
                    >
                      <PasswordInput
                        id="connection-tls-key-passphrase"
                        autoComplete="new-password"
                        value={form.tlsClientKeyPassphrase ?? ''}
                        onChange={(_, value) => set('tlsClientKeyPassphrase', value)}
                      />
                      <FormHelperText>
                        <HelperText>
                          <HelperTextItem>
                            {profile?.hasClientKeyPassphrase
                              ? t('Connections.TLS_KEY_PASSPHRASE_KEEP_HELP')
                              : t('Connections.TLS_KEY_PASSPHRASE_HELP')}
                          </HelperTextItem>
                        </HelperText>
                      </FormHelperText>
                    </FormGroup>
                  </>
                ) : null}
              </Form>
            </WizardStep>

            {/*
              What the console may do here, which is a property of this server rather than of this
              installation. It used to be neither: the deny-list could be widened in configuration,
              and configuration cannot say which target — so allowing FLUSHDB for the scratch server
              allowed it on production too.

              Only the half of the list that is about the target is offered. The other half is
              refused because of what those commands would do to Keydra's own pooled connection,
              which is the same wherever the server is, so there is nothing here to decide.
            */}
            <WizardStep id="console" name={t('Connections.TAB_CARE')}>
              <Form>
                {/*
                  On this step rather than a step of its own: both of these decide how careful
                  Keydra is with this particular server, and a wizard page per boolean is how a
                  form stops being read.
                */}
                <FormGroup fieldId="connection-guarded">
                  <Checkbox
                    id="connection-guarded"
                    label={t('Connections.GUARDED')}
                    isChecked={form.guarded}
                    onChange={(_, checked) => set('guarded', checked)}
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>{t('Connections.GUARDED_HELP')}</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>

                {/*
                  Beside the naming rather than inside it, and separately switchable: one asks
                  which server this is and the other asks whether one person gets to do it at
                  all. An installation that wants the second should not have to accept the first.
                */}
                <FormGroup fieldId="connection-requires-approval">
                  <Checkbox
                    id="connection-requires-approval"
                    label={t('Connections.REQUIRES_APPROVAL')}
                    isChecked={form.requiresApproval}
                    onChange={(_, checked) => set('requiresApproval', checked)}
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>{t('Connections.REQUIRES_APPROVAL_HELP')}</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>

                <FormGroup
                  label={t('Connections.CONSOLE_ALLOWED')}
                  fieldId="connection-console-allowed"
                >
                  {/*
                    Grouped by what allowing them would let somebody do, which is the decision
                    being made. A flat list of thirty-one names asks somebody to allow MODULE
                    without saying that MODULE runs code inside the server.

                    The server sends them already ordered by reason, so the grouping here is a
                    walk rather than a sort: what the groups are is the policy's business, and a
                    browser that decided it would be a second opinion about the same thing. What
                    it sends is a key; the sentence is written here, with the rest of the text.
                  */}
                  <div id="connection-console-allowed" className="pf-v6-u-mb-sm">
                    {(askable.data ?? []).map((entry, index, all) => (
                      <div key={entry.command}>
                        {index === 0 || all[index - 1].reason !== entry.reason ? (
                          <div
                            className="pf-v6-u-mt-md pf-v6-u-mb-xs pf-v6-u-font-weight-bold"
                            aria-hidden="true"
                          >
                            {describeConsoleReason(entry.reason, t)}
                          </div>
                        ) : null}
                        <Checkbox
                          id={`connection-console-allow-${entry.command}`}
                          // The reason is in the label rather than only in the heading above it:
                          // a screen reader reaching this checkbox out of order should still hear
                          // what allowing it means.
                          label={entry.command.toUpperCase()}
                          aria-label={`${entry.command.toUpperCase()} — ${describeConsoleReason(
                            entry.reason,
                            t,
                          )}`}
                          isChecked={(form.consoleAllowed ?? []).includes(entry.command)}
                          onChange={(_, checked) =>
                            set(
                              'consoleAllowed',
                              checked
                                ? [...(form.consoleAllowed ?? []), entry.command]
                                : (form.consoleAllowed ?? []).filter(
                                    (name) => name !== entry.command,
                                  ),
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>{t('Connections.CONSOLE_ALLOWED_HELP')}</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
              </Form>
            </WizardStep>

            <WizardStep id="tunnel" name={t('Connections.TAB_TUNNEL')}>
              <Form isHorizontal>
                {/* A tunnel is a thing now, described once under Tunnels and pointed at from
                  here. This tab used to ask for a host, a user and a key — which meant every
                  target behind one jump host carried its own copy of that key. */}
                <FormGroup label={t('Connections.TUNNEL')} fieldId="connection-tunnel">
                  <FormSelect
                    id="connection-tunnel"
                    value={form.tunnelId ?? ''}
                    onChange={(_, value) => set('tunnelId', value ? Number(value) : null)}
                  >
                    <FormSelectOption value="" label={t('Connections.TUNNEL_NONE')} />
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
                      <HelperTextItem>
                        {(tunnels.data ?? []).length === 0
                          ? t('Connections.TUNNEL_NONE_CONFIGURED')
                          : t('Connections.TUNNEL_HELP')}
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>

                {chosenTunnel && !chosenTunnel.verifiesHostKey ? (
                  <Alert
                    variant="warning"
                    isInline
                    isPlain
                    component="h4"
                    title={t('Connections.TUNNEL_ANY_KEY')}
                  >
                    {t('Connections.TUNNEL_ANY_KEY_BODY', { name: chosenTunnel.name })}
                  </Alert>
                ) : null}
              </Form>
            </WizardStep>

            <WizardStep
              id="access"
              name={t('Connections.TAB_ACCESS')}
              footer={{
                ...footerLabels,
                nextButtonText: t('Connections.SAVE'),
                isNextDisabled: !canSubmit,
              }}
            >
              {tab === 'access' ? (
                <AccessTab chosen={serverGroups} onChange={onServerGroupsChange} />
              ) : null}
            </WizardStep>
          </Wizard>
        </>
      </ModalBody>
    </Modal>
  );
};
