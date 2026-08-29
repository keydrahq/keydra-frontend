import type { FC } from 'react';
import { useState } from 'react';
import {
  Button,
  Checkbox,
  ClipboardCopy,
  EmptyState,
  EmptyStateBody,
  ExpandableSection,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Label,
  LabelGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { KeyIcon, PlusCircleIcon } from '@patternfly/react-icons';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { PasswordInput } from '@app/Shared/Components/PasswordInput';
import { ConfirmDialog } from '@app/Shared/Components/ConfirmDialog';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import {
  useAddGroupMapping,
  useDeleteProvider,
  useGroups,
  useProviders,
  useRemoveGroupMapping,
  useSaveProvider,
} from './queries';
import type { ProviderKind, ProviderSummary } from './types';

/**
 * Where people can sign in from.
 *
 * <p>Rows rather than environment variables, which is the point: adding a way into Keydra should
 * not be a redeploy. The redirect URI is shown beside each one because it has to be given to the
 * provider exactly, and getting it wrong is the usual reason a first attempt is refused.
 */
export const ProvidersTab: FC = () => {
  const { t } = useTranslation();
  const providers = useProviders();
  const remove = useDeleteProvider();
  const [editing, setEditing] = useState<ProviderSummary | 'new' | undefined>();
  // Held by id rather than by value: adding a mapping refetches the list, and a dialog
  // showing a copy taken when it opened would go on showing the mappings as they were.
  const [mapping, setMapping] = useState<number | undefined>();
  const [removing, setRemoving] = useState<ProviderSummary | undefined>();

  if (providers.isPending) {
    return <LoadingView />;
  }
  if (providers.isError) {
    return <ErrorView title={t('Access.PROVIDERS_FAILED')} message={providers.error.message} />;
  }

  const mappingTarget = providers.data.find((provider) => provider.id === mapping);

  return (
    <>
      <Toolbar id="providers-toolbar" inset={{ default: 'insetNone' }}>
        <ToolbarContent>
          <ToolbarItem>
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => setEditing('new')}>
              {t('Access.ADD_PROVIDER')}
            </Button>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {providers.data.length === 0 ? (
        <EmptyState titleText={t('Access.NO_PROVIDERS')} icon={KeyIcon} headingLevel="h3">
          <EmptyStateBody>{t('Access.NO_PROVIDERS_BODY')}</EmptyStateBody>
        </EmptyState>
      ) : (
        <Table aria-label={t('Access.PROVIDERS')} variant="compact">
          <Thead>
            <Tr>
              <Th>{t('Access.NAME')}</Th>
              <Th>{t('Access.PROVIDER_KIND')}</Th>
              <Th>{t('Access.STATUS')}</Th>
              <Th>{t('Access.REDIRECT_URI')}</Th>
              <Th>{t('Access.GROUP_MAPPINGS')}</Th>
              <Th screenReaderText={t('Access.ACTIONS')} />
            </Tr>
          </Thead>
          <Tbody>
            {providers.data.map((provider) => (
              <Tr key={provider.id}>
                <Td dataLabel={t('Access.NAME')}>
                  {provider.displayName}
                  <br />
                  <Label isCompact variant="outline">
                    {provider.key}
                  </Label>
                </Td>
                <Td dataLabel={t('Access.PROVIDER_KIND')}>{provider.kind}</Td>
                <Td dataLabel={t('Access.STATUS')}>
                  <LabelGroup numLabels={3}>
                    <Label isCompact color={provider.enabled ? 'green' : 'grey'}>
                      {provider.enabled ? t('Access.ENABLED') : t('Access.DISABLED')}
                    </Label>
                    {/* The one thing that has to be true for the button to work at all. */}
                    <Label isCompact color={provider.endpointsDiscovered ? 'blue' : 'red'}>
                      {provider.endpointsDiscovered
                        ? t('Access.ENDPOINTS_KNOWN')
                        : t('Access.ENDPOINTS_MISSING')}
                    </Label>
                    {!provider.hasClientSecret && (
                      <Label isCompact color="orange">
                        {t('Access.NO_SECRET')}
                      </Label>
                    )}
                  </LabelGroup>
                </Td>
                <Td dataLabel={t('Access.REDIRECT_URI')}>
                  <ClipboardCopy
                    isReadOnly
                    hoverTip={t('Access.COPY')}
                    clickTip={t('Access.COPIED')}
                  >
                    {provider.redirectUri}
                  </ClipboardCopy>
                </Td>
                <Td dataLabel={t('Access.GROUP_MAPPINGS')}>
                  {provider.groupMappings.length === 0 ? (
                    '—'
                  ) : (
                    <LabelGroup numLabels={3}>
                      {provider.groupMappings.map((entry) => (
                        <Label key={entry.id} isCompact color="purple">
                          {entry.claimValue} → {entry.groupName}
                        </Label>
                      ))}
                    </LabelGroup>
                  )}
                </Td>
                <Td isActionCell>
                  <ActionsColumn
                    items={[
                      { title: t('Access.EDIT'), onClick: () => setEditing(provider) },
                      { title: t('Access.MAP_GROUPS'), onClick: () => setMapping(provider.id) },
                      { isSeparator: true },
                      {
                        title: t('Access.REMOVE'),
                        isDanger: true,
                        onClick: () => setRemoving(provider),
                      },
                    ]}
                  />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {editing && (
        <ProviderDialog
          provider={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
        />
      )}
      {mappingTarget && (
        <MappingsDialog provider={mappingTarget} onClose={() => setMapping(undefined)} />
      )}
      {removing && (
        <ConfirmDialog
          isOpen
          title={t('Access.REMOVE_PROVIDER_TITLE')}
          confirmLabel={t('Access.REMOVE')}
          isDestructive
          isBusy={remove.isPending}
          onConfirm={() => {
            remove.mutate(removing.id);
            setRemoving(undefined);
          }}
          onCancel={() => setRemoving(undefined)}
        >
          {t('Access.REMOVE_PROVIDER_BODY', { name: removing.displayName })}
        </ConfirmDialog>
      )}
    </>
  );
};

/**
 * One provider's configuration.
 *
 * <p>An OIDC provider is asked for an issuer and finds its own endpoints; an OAuth 2 one has them
 * typed in, because it publishes nothing to discover. Everything else — which claim is the name,
 * which is the groups — is the same question for both, which is why the claims come from the user
 * endpoint even where an id token would do.
 */
const ProviderDialog: FC<{ provider?: ProviderSummary; onClose: () => void }> = ({
  provider,
  onClose,
}) => {
  const { t } = useTranslation();
  const save = useSaveProvider();

  const [key, setKey] = useState(provider?.key ?? '');
  const [displayName, setDisplayName] = useState(provider?.displayName ?? '');
  const [kind, setKind] = useState<ProviderKind>(provider?.kind ?? 'OIDC');
  const [enabled, setEnabled] = useState(provider?.enabled ?? true);
  const [issuer, setIssuer] = useState(provider?.issuer ?? '');
  const [clientId, setClientId] = useState(provider?.clientId ?? '');
  const [clientSecret, setClientSecret] = useState('');
  const [scopes, setScopes] = useState(provider?.scopes ?? 'openid profile email');
  const [authorization, setAuthorization] = useState(provider?.authorizationEndpoint ?? '');
  const [token, setToken] = useState(provider?.tokenEndpoint ?? '');
  const [userInfo, setUserInfo] = useState(provider?.userInfoEndpoint ?? '');
  const [subjectClaim, setSubjectClaim] = useState(provider?.subjectClaim ?? 'sub');
  const [usernameClaim, setUsernameClaim] = useState(
    provider?.usernameClaim ?? 'preferred_username',
  );
  const [emailClaim, setEmailClaim] = useState(provider?.emailClaim ?? 'email');
  const [nameClaim, setNameClaim] = useState(provider?.nameClaim ?? 'name');
  const [groupsClaim, setGroupsClaim] = useState(provider?.groupsClaim ?? '');
  const [autoCreate, setAutoCreate] = useState(provider?.autoCreateUsers ?? true);

  const discovers = kind === 'OIDC';
  const ready =
    !!key && !!displayName && !!clientId && (discovers ? !!issuer : !!authorization && !!token);

  const submit = () =>
    save.mutate(
      {
        id: provider?.id,
        request: {
          key,
          displayName,
          kind,
          enabled,
          issuer: issuer || null,
          clientId,
          clientSecret: clientSecret || undefined,
          scopes,
          authorizationEndpoint: authorization || null,
          tokenEndpoint: token || null,
          userInfoEndpoint: userInfo || null,
          subjectClaim,
          usernameClaim,
          emailClaim: emailClaim || null,
          nameClaim: nameClaim || null,
          groupsClaim: groupsClaim || null,
          autoCreateUsers: autoCreate,
        },
      },
      { onSuccess: onClose },
    );

  return (
    <Modal
      isOpen
      variant="medium"
      onClose={onClose}
      aria-label={provider ? t('Access.EDIT_PROVIDER_TITLE') : t('Access.ADD_PROVIDER')}
    >
      <ModalHeader title={provider ? provider.displayName : t('Access.ADD_PROVIDER')} />
      <ModalBody>
        <Form>
          <FormGroup label={t('Access.DISPLAY_NAME')} isRequired fieldId="provider-name">
            <TextInput
              id="provider-name"
              value={displayName}
              onChange={(_event, value) => setDisplayName(value)}
              isRequired
              autoFocus
            />
          </FormGroup>

          <FormGroup label={t('Access.PROVIDER_KEY')} isRequired fieldId="provider-key">
            <TextInput
              id="provider-key"
              value={key}
              onChange={(_event, value) => setKey(value)}
              // It is part of the redirect URI, which is agreed with the provider in advance.
              // Changing it later would silently stop matching what they were told.
              isDisabled={provider !== undefined}
              isRequired
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>{t('Access.PROVIDER_KEY_HELP')}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>

          <FormGroup label={t('Access.PROVIDER_KIND')} isRequired fieldId="provider-kind">
            <FormSelect
              id="provider-kind"
              value={kind}
              onChange={(_event, value) => setKind(value as ProviderKind)}
              aria-label={t('Access.PROVIDER_KIND')}
            >
              <FormSelectOption value="OIDC" label={t('Access.KIND_OIDC')} />
              <FormSelectOption value="OAUTH2" label={t('Access.KIND_OAUTH2')} />
            </FormSelect>
          </FormGroup>

          {discovers ? (
            <FormGroup label={t('Access.ISSUER')} isRequired fieldId="provider-issuer">
              <TextInput
                id="provider-issuer"
                value={issuer}
                onChange={(_event, value) => setIssuer(value)}
                isRequired
              />
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>{t('Access.ISSUER_HELP')}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
          ) : (
            <>
              <FormGroup
                label={t('Access.AUTHORIZATION_ENDPOINT')}
                isRequired
                fieldId="provider-authorization"
              >
                <TextInput
                  id="provider-authorization"
                  value={authorization}
                  onChange={(_event, value) => setAuthorization(value)}
                  isRequired
                />
              </FormGroup>
              <FormGroup label={t('Access.TOKEN_ENDPOINT')} isRequired fieldId="provider-token">
                <TextInput
                  id="provider-token"
                  value={token}
                  onChange={(_event, value) => setToken(value)}
                  isRequired
                />
              </FormGroup>
              <FormGroup label={t('Access.USERINFO_ENDPOINT')} fieldId="provider-userinfo">
                <TextInput
                  id="provider-userinfo"
                  value={userInfo}
                  onChange={(_event, value) => setUserInfo(value)}
                />
              </FormGroup>
            </>
          )}

          <FormGroup label={t('Access.CLIENT_ID')} isRequired fieldId="provider-client-id">
            <TextInput
              id="provider-client-id"
              value={clientId}
              onChange={(_event, value) => setClientId(value)}
              isRequired
            />
          </FormGroup>

          <FormGroup label={t('Access.CLIENT_SECRET')} fieldId="provider-client-secret">
            <PasswordInput
              id="provider-client-secret"
              value={clientSecret}
              onChange={(_event, value) => setClientSecret(value)}
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  {provider?.hasClientSecret
                    ? t('Access.SECRET_UNCHANGED')
                    : t('Access.SECRET_HELP')}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>

          <FormGroup label={t('Access.SCOPES')} fieldId="provider-scopes">
            <TextInput
              id="provider-scopes"
              value={scopes}
              onChange={(_event, value) => setScopes(value)}
            />
          </FormGroup>

          <ExpandableSection toggleText={t('Access.CLAIM_MAPPING')}>
            <FormGroup label={t('Access.SUBJECT_CLAIM')} fieldId="provider-subject-claim">
              <TextInput
                id="provider-subject-claim"
                value={subjectClaim}
                onChange={(_event, value) => setSubjectClaim(value)}
              />
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>{t('Access.SUBJECT_CLAIM_HELP')}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
            <FormGroup label={t('Access.USERNAME_CLAIM')} fieldId="provider-username-claim">
              <TextInput
                id="provider-username-claim"
                value={usernameClaim}
                onChange={(_event, value) => setUsernameClaim(value)}
              />
            </FormGroup>
            <FormGroup label={t('Access.EMAIL_CLAIM')} fieldId="provider-email-claim">
              <TextInput
                id="provider-email-claim"
                value={emailClaim}
                onChange={(_event, value) => setEmailClaim(value)}
              />
            </FormGroup>
            <FormGroup label={t('Access.NAME_CLAIM')} fieldId="provider-name-claim">
              <TextInput
                id="provider-name-claim"
                value={nameClaim}
                onChange={(_event, value) => setNameClaim(value)}
              />
            </FormGroup>
            <FormGroup label={t('Access.GROUPS_CLAIM')} fieldId="provider-groups-claim">
              <TextInput
                id="provider-groups-claim"
                value={groupsClaim}
                onChange={(_event, value) => setGroupsClaim(value)}
              />
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>{t('Access.GROUPS_CLAIM_HELP')}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
          </ExpandableSection>

          <FormGroup fieldId="provider-enabled">
            <Checkbox
              id="provider-enabled"
              label={t('Access.ENABLED')}
              description={t('Access.PROVIDER_ENABLED_HELP')}
              isChecked={enabled}
              onChange={(_event, checked) => setEnabled(checked)}
            />
            <Checkbox
              id="provider-auto-create"
              label={t('Access.AUTO_CREATE')}
              description={t('Access.AUTO_CREATE_HELP')}
              isChecked={autoCreate}
              onChange={(_event, checked) => setAutoCreate(checked)}
            />
          </FormGroup>

          {provider && (
            <FormGroup label={t('Access.REDIRECT_URI')} fieldId="provider-redirect">
              <ClipboardCopy isReadOnly hoverTip={t('Access.COPY')} clickTip={t('Access.COPIED')}>
                {provider.redirectUri}
              </ClipboardCopy>
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>{t('Access.REDIRECT_URI_HELP')}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
          )}

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
        <Button variant="primary" isDisabled={!ready || save.isPending} onClick={submit}>
          {save.isPending ? t('Access.CHECKING') : t('Access.SAVE')}
        </Button>
        <Button variant="link" onClick={onClose}>
          {t('Access.CANCEL')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

/** Which of the provider's group names mean which Keydra group. */
const MappingsDialog: FC<{ provider: ProviderSummary; onClose: () => void }> = ({
  provider,
  onClose,
}) => {
  const { t } = useTranslation();
  const groups = useGroups();
  const add = useAddGroupMapping();
  const remove = useRemoveGroupMapping();
  const [claimValue, setClaimValue] = useState('');
  const [groupId, setGroupId] = useState('');

  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-label={t('Access.MAP_GROUPS')}>
      <ModalHeader
        title={t('Access.MAP_GROUPS_FOR', { name: provider.displayName })}
        description={t('Access.MAP_GROUPS_HELP')}
      />
      <ModalBody>
        {provider.groupMappings.length > 0 && (
          <Table aria-label={t('Access.GROUP_MAPPINGS')} variant="compact">
            <Thead>
              <Tr>
                <Th>{t('Access.CLAIM_VALUE')}</Th>
                <Th>{t('Access.KEYDRA_GROUP')}</Th>
                <Th screenReaderText={t('Access.ACTIONS')} />
              </Tr>
            </Thead>
            <Tbody>
              {provider.groupMappings.map((entry) => (
                <Tr key={entry.id}>
                  <Td dataLabel={t('Access.CLAIM_VALUE')}>{entry.claimValue}</Td>
                  <Td dataLabel={t('Access.KEYDRA_GROUP')}>{entry.groupName}</Td>
                  <Td isActionCell>
                    <Button
                      variant="link"
                      isInline
                      isDanger
                      onClick={() => remove.mutate(entry)}
                      isDisabled={remove.isPending}
                    >
                      {t('Access.REMOVE')}
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        <Form>
          <FormGroup label={t('Access.CLAIM_VALUE')} fieldId="mapping-claim">
            <TextInput
              id="mapping-claim"
              value={claimValue}
              onChange={(_event, value) => setClaimValue(value)}
            />
          </FormGroup>
          <FormGroup label={t('Access.KEYDRA_GROUP')} fieldId="mapping-group">
            <FormSelect
              id="mapping-group"
              value={groupId}
              onChange={(_event, value) => setGroupId(value)}
              aria-label={t('Access.KEYDRA_GROUP')}
            >
              <FormSelectOption value="" label={t('Access.CHOOSE')} isDisabled />
              {(groups.data ?? []).map((group) => (
                <FormSelectOption key={group.id} value={String(group.id)} label={group.name} />
              ))}
            </FormSelect>
          </FormGroup>
          {add.isError && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error">{add.error.message}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
          <Button
            variant="secondary"
            isDisabled={!claimValue || !groupId || add.isPending}
            onClick={() =>
              add.mutate(
                { providerId: provider.id, claimValue, groupId: Number(groupId) },
                {
                  onSuccess: () => {
                    setClaimValue('');
                    setGroupId('');
                  },
                },
              )
            }
          >
            {t('Access.ADD')}
          </Button>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={onClose}>
          {t('Access.DONE')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
