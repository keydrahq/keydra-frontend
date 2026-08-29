import type { FC } from 'react';
import { useState } from 'react';
import {
  Button,
  ClipboardCopy,
  Content,
  Checkbox,
  EmptyState,
  EmptyStateBody,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Label,
  LabelGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Stack,
  StackItem,
  TextInput,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { UsersIcon, PlusCircleIcon, EnvelopeIcon } from '@patternfly/react-icons';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { PasswordInput } from '@app/Shared/Components/PasswordInput';
import { ConfirmDialog } from '@app/Shared/Components/ConfirmDialog';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { useDeleteUser, useInviteUser, useSaveUser, useUsers } from './queries';
import type { InvitationIssued } from './queries';
import { groupName } from './names';
import type { UserSummary } from './types';

/** Shorter than this and a password is a guess away; the backend refuses one too. */
const MINIMUM_PASSWORD = 12;

/**
 * The people Keydra knows.
 *
 * <p>An account carries no access of its own. Creating somebody here makes them able to sign in and
 * see nothing, which is the right starting point — access arrives as a grant, and a person's
 * account is not the place it is decided.
 */
export const UsersTab: FC = () => {
  const { t } = useTranslation();
  const users = useUsers();
  const remove = useDeleteUser();
  const [editing, setEditing] = useState<UserSummary | 'new' | undefined>();
  const [removing, setRemoving] = useState<UserSummary | undefined>();
  const invite = useInviteUser();
  const [issued, setIssued] = useState<InvitationIssued | undefined>();

  if (users.isPending) {
    return <LoadingView />;
  }
  if (users.isError) {
    return <ErrorView title={t('Access.USERS_FAILED')} message={users.error.message} />;
  }

  return (
    <>
      <Toolbar id="users-toolbar" inset={{ default: 'insetNone' }}>
        <ToolbarContent>
          <ToolbarItem>
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => setEditing('new')}>
              {t('Access.ADD_USER')}
            </Button>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {users.data.length === 0 ? (
        <EmptyState titleText={t('Access.NO_USERS')} icon={UsersIcon} headingLevel="h3">
          <EmptyStateBody>{t('Access.NO_USERS_BODY')}</EmptyStateBody>
        </EmptyState>
      ) : (
        <Table aria-label={t('Access.USERS')} variant="compact">
          <Thead>
            <Tr>
              <Th>{t('Access.USERNAME')}</Th>
              <Th>{t('Access.DISPLAY_NAME')}</Th>
              <Th>{t('Access.PROVIDER')}</Th>
              <Th>{t('Access.GROUPS')}</Th>
              <Th>{t('Access.STATUS')}</Th>
              <Th>{t('Access.LAST_SEEN')}</Th>
              <Th screenReaderText={t('Access.ACTIONS')} />
            </Tr>
          </Thead>
          <Tbody>
            {users.data.map((user) => (
              <Tr key={user.id}>
                <Td dataLabel={t('Access.USERNAME')}>{user.username}</Td>
                <Td dataLabel={t('Access.DISPLAY_NAME')}>{user.displayName ?? '—'}</Td>
                <Td dataLabel={t('Access.PROVIDER')}>
                  <Label isCompact variant="outline">
                    {user.provider}
                  </Label>
                </Td>
                <Td dataLabel={t('Access.GROUPS')}>
                  {user.groups.length === 0 ? (
                    '—'
                  ) : (
                    <LabelGroup numLabels={3}>
                      {user.groups.map((group) => (
                        <Label key={group} isCompact color="blue">
                          {groupName(group)}
                        </Label>
                      ))}
                    </LabelGroup>
                  )}
                </Td>
                <Td dataLabel={t('Access.STATUS')}>
                  <Label isCompact color={user.enabled ? 'green' : 'grey'}>
                    {user.enabled ? t('Access.ENABLED') : t('Access.DISABLED')}
                  </Label>
                  {!user.hasPassword && (
                    <Label isCompact color="orange">
                      {t('Access.NO_PASSWORD')}
                    </Label>
                  )}
                </Td>
                <Td dataLabel={t('Access.LAST_SEEN')}>
                  {user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleString() : t('Access.NEVER')}
                </Td>
                <Td isActionCell>
                  <ActionsColumn
                    items={[
                      { title: t('Access.EDIT'), onClick: () => setEditing(user) },
                      {
                        title: t('Access.INVITE'),
                        onClick: () =>
                          invite.mutate(user.id, { onSuccess: (result) => setIssued(result) }),
                      },
                      { isSeparator: true },
                      {
                        title: t('Access.REMOVE'),
                        isDanger: true,
                        onClick: () => setRemoving(user),
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
        <UserDialog
          user={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
        />
      )}

      {issued && <InvitationIssuedDialog issued={issued} onClose={() => setIssued(undefined)} />}

      {removing && (
        <ConfirmDialog
          isOpen
          title={t('Access.REMOVE_USER_TITLE')}
          confirmLabel={t('Access.REMOVE')}
          isDestructive
          isBusy={remove.isPending}
          onConfirm={() => {
            remove.mutate(removing.id);
            setRemoving(undefined);
          }}
          onCancel={() => setRemoving(undefined)}
        >
          {t('Access.REMOVE_USER_BODY', { name: removing.username })}
        </ConfirmDialog>
      )}
    </>
  );
};

interface InvitationIssuedDialogProps {
  issued: InvitationIssued;
  onClose: () => void;
}

/**
 * What happened when a link was asked for.
 *
 * <p>Two outcomes, read differently on purpose. Mailed is a sentence and nothing else — there is
 * nothing left to do. Not mailed hands the link over, because an instance with no relay must not be
 * an instance where nobody can be given an account; and it is shown once, because it is a
 * credential and is not stored anywhere it could be shown again.
 */
const InvitationIssuedDialog: FC<InvitationIssuedDialogProps> = ({ issued, onClose }) => {
  const { t } = useTranslation();

  return (
    <Modal isOpen variant="small" onClose={onClose} aria-label={t('Access.INVITE')}>
      <ModalHeader title={t(issued.mailed ? 'Access.INVITE' : 'Access.INVITE_LINK_TITLE')} />
      <ModalBody>
        {/* Whether there is a link is what decides this, not whether mail was sent — they are
            the same answer in every case the server can produce, and only one of them is a
            question about what this dialog has to show. Asking the other one left `link` as
            `string | null` inside the branch that exists to display it. */}
        {issued.link ? (
          <Stack hasGutter>
            <StackItem>
              <Content component="p">{t('Access.INVITE_LINK_BODY')}</Content>
            </StackItem>
            <StackItem>
              <ClipboardCopy
                isReadOnly
                hoverTip={t('Access.COPY_LINK')}
                clickTip={t('Access.COPIED')}
              >
                {issued.link}
              </ClipboardCopy>
            </StackItem>
          </Stack>
        ) : (
          <Content component="p">
            {t('Access.INVITE_SENT', { address: issued.address ?? '' })}
          </Content>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={onClose}>
          {t('Access.CLOSE')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

interface UserDialogProps {
  /** Absent for a new account. */
  user?: UserSummary;
  onClose: () => void;
}

/**
 * Creating or changing one account.
 *
 * <p>A new account gets no password here. Keydra invites the person and they choose one nobody else
 * ever types — which is what keeps the audit log able to answer "who did this" about anything that
 * account goes on to do. Typing somebody's password into this form meant it then had to travel to
 * them somehow, and every one of those ways keeps it longer than anybody intends.
 *
 * <p>Editing still offers the field, for the account that has locked itself out on an instance with
 * no way to send mail. It starts empty and an empty one leaves the stored password alone: prefilling
 * it is impossible, and treating empty as "clear it" would lock somebody out every time their
 * display name was corrected.
 */
const UserDialog: FC<UserDialogProps> = ({ user, onClose }) => {
  const { t } = useTranslation();
  const save = useSaveUser();
  const [username, setUsername] = useState(user?.username ?? '');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [enabled, setEnabled] = useState(user?.enabled ?? true);

  const tooShort = password.length > 0 && password.length < MINIMUM_PASSWORD;
  // A new account needs a username and nothing else: what it does not get here is a password.
  const ready = !!username && !tooShort;

  const submit = () =>
    save.mutate(
      {
        id: user?.id,
        request: {
          username,
          displayName: displayName || null,
          email: email || null,
          password: password || undefined,
          enabled,
        },
      },
      { onSuccess: onClose },
    );

  return (
    <Modal
      isOpen
      variant="small"
      onClose={onClose}
      aria-label={user ? t('Access.EDIT_USER_TITLE') : t('Access.ADD_USER')}
    >
      <ModalHeader title={user ? t('Access.EDIT_USER_TITLE') : t('Access.ADD_USER')} />
      <ModalBody>
        <Form>
          <FormGroup label={t('Access.USERNAME')} isRequired fieldId="user-username">
            <TextInput
              id="user-username"
              value={username}
              onChange={(_event, value) => setUsername(value)}
              // A username is what grants point at through an id, but it is also what
              // somebody types to sign in; changing it later is a different operation.
              isDisabled={user !== undefined}
              isRequired
            />
          </FormGroup>
          <FormGroup label={t('Access.DISPLAY_NAME')} fieldId="user-display-name">
            <TextInput
              id="user-display-name"
              value={displayName}
              onChange={(_event, value) => setDisplayName(value)}
            />
          </FormGroup>
          <FormGroup label={t('Access.EMAIL')} fieldId="user-email">
            <TextInput
              id="user-email"
              type="email"
              value={email}
              onChange={(_event, value) => setEmail(value)}
            />
          </FormGroup>
          {user ? (
            <FormGroup label={t('Access.NEW_PASSWORD')} fieldId="user-password">
              <PasswordInput
                id="user-password"
                value={password}
                onChange={(_event, value) => setPassword(value)}
                validated={tooShort ? 'error' : 'default'}
              />
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant={tooShort ? 'error' : 'default'}>
                    {t('Access.PASSWORD_UNCHANGED')}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
          ) : (
            <FormGroup fieldId="user-invitation">
              <HelperText>
                <HelperTextItem icon={<EnvelopeIcon />}>
                  {t('Access.INVITATION_EXPLAINED')}
                </HelperTextItem>
              </HelperText>
            </FormGroup>
          )}
          <FormGroup fieldId="user-enabled">
            <Checkbox
              id="user-enabled"
              label={t('Access.ENABLED')}
              description={t('Access.ENABLED_HELP')}
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
        <Button variant="primary" isDisabled={!ready || save.isPending} onClick={submit}>
          {t('Access.SAVE')}
        </Button>
        <Button variant="link" onClick={onClose}>
          {t('Access.CANCEL')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
