import type { FC } from 'react';
import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
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
  PageSection,
  TextInput,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { ConfirmDialog } from '@app/Shared/Components/ConfirmDialog';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { useNotifications } from '@app/Shared/Components/notificationStore';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import { useAclUsers, useDeleteAclUser, useSetAclUser } from './queries';

/**
 * The users a target itself knows about.
 *
 * <p>Rules are typed, not assembled from checkboxes. The rule language belongs to the server and
 * grows with its versions; a form that only offered the rules Keydra was written against would stop
 * anyone writing the rest, which is worse than asking someone who is managing ACLs to know the
 * syntax for them.
 */
export const AclUsers: FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('Acl.TITLE'));

  const { connectionId: idParam } = useParams();
  const connectionId = Number(idParam);
  const { notify } = useNotifications();

  const users = useAclUsers(connectionId);
  const save = useSetAclUser(connectionId);
  const remove = useDeleteAclUser(connectionId);

  const [editing, setEditing] = useState<{ username: string; rules: string } | undefined>();
  const [deleting, setDeleting] = useState<string | undefined>();

  const submit = () => {
    if (!editing || editing.username.trim() === '') {
      return;
    }
    save.mutate(
      {
        username: editing.username.trim(),
        // Split on whitespace: the server takes each rule as its own argument.
        rules: editing.rules.split(/\s+/).filter((rule) => rule !== ''),
      },
      {
        onSuccess: () => setEditing(undefined),
        onError: (error) =>
          notify({ title: t('Acl.SAVE_FAILED'), description: error.message, variant: 'danger' }),
      },
    );
  };

  return (
    <>
      <PageSection className="keydra-browser" isFilled>
        <Card isCompact isFullHeight className="keydra-pubsub__feed">
          <CardBody className="keydra-pubsub__feed-body">
            <Toolbar id="acl-toolbar" inset={{ default: 'insetNone' }}>
              <ToolbarContent>
                <ToolbarGroup align={{ default: 'alignEnd' }}>
                  <ToolbarItem>
                    <Button
                      variant="primary"
                      onClick={() => setEditing({ username: '', rules: 'on ~* +@read' })}
                    >
                      {t('Acl.ADD_USER')}
                    </Button>
                  </ToolbarItem>
                </ToolbarGroup>
              </ToolbarContent>
            </Toolbar>

            {users.isPending ? (
              <LoadingView />
            ) : users.isError ? (
              <ErrorView title={t('Acl.LOAD_ERROR')} message={users.error.message} />
            ) : (
              <>
                <Alert variant="info" isInline isPlain component="h2" title={t('Acl.NO_HASHES')} />
                <Table aria-label={t('Acl.TITLE')} variant="compact">
                  <Thead>
                    <Tr>
                      <Th width={15}>{t('Acl.USERNAME')}</Th>
                      <Th width={10}>{t('Acl.ENABLED')}</Th>
                      <Th width={10}>{t('Acl.PASSWORD')}</Th>
                      <Th width={20}>{t('Acl.KEYS')}</Th>
                      <Th>{t('Acl.COMMANDS')}</Th>
                      <Th modifier="fitContent" screenReaderText={t('Acl.ROW_ACTIONS')} />
                    </Tr>
                  </Thead>
                  <Tbody>
                    {(users.data ?? []).map((user) => (
                      <Tr key={user.username}>
                        <Td dataLabel={t('Acl.USERNAME')} className="pf-v6-u-font-family-monospace">
                          {user.username}
                        </Td>
                        <Td dataLabel={t('Acl.ENABLED')}>
                          <Label
                            isCompact
                            color={user.enabled ? 'green' : 'grey'}
                            status={user.enabled ? 'success' : undefined}
                          >
                            {user.enabled ? t('Acl.ON') : t('Acl.OFF')}
                          </Label>
                        </Td>
                        <Td dataLabel={t('Acl.PASSWORD')}>
                          {user.hasPassword ? t('Acl.SET') : t('Acl.NONE')}
                        </Td>
                        <Td dataLabel={t('Acl.KEYS')}>
                          <LabelGroup numLabels={3}>
                            {user.keyPatterns.map((pattern) => (
                              <Label key={pattern} isCompact variant="outline">
                                {pattern}
                              </Label>
                            ))}
                          </LabelGroup>
                        </Td>
                        <Td
                          dataLabel={t('Acl.COMMANDS')}
                          className="keydra-value__text pf-v6-u-font-family-monospace"
                        >
                          {user.commands || '—'}
                        </Td>
                        <Td isActionCell>
                          <Button
                            variant="link"
                            isInline
                            onClick={() =>
                              setEditing({
                                username: user.username,
                                rules: user.rules.join(' '),
                              })
                            }
                          >
                            {t('Acl.EDIT')}
                          </Button>{' '}
                          <Button
                            variant="link"
                            isInline
                            isDanger
                            // Redis refuses to remove default, and so does this.
                            isDisabled={user.username === 'default'}
                            onClick={() => setDeleting(user.username)}
                          >
                            {t('Acl.DELETE')}
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </>
            )}
          </CardBody>
        </Card>
      </PageSection>

      {editing ? (
        <Modal
          isOpen
          onClose={() => setEditing(undefined)}
          variant="medium"
          /* Named by its own heading rather than by a second copy of the same string: an
             aria-label beside a visible title is a name that can drift away from the one
             on screen, and only one of the two would then be corrected. */
          aria-labelledby="acl-user-modal-title"
        >
          <ModalHeader title={t('Acl.EDIT_TITLE')} labelId="acl-user-modal-title" />
          <ModalBody>
            <Form
              id="acl-user-form"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <FormGroup label={t('Acl.USERNAME')} isRequired fieldId="acl-username">
                <TextInput
                  id="acl-username"
                  value={editing.username}
                  isRequired
                  onChange={(_event, value) => setEditing({ ...editing, username: value })}
                />
              </FormGroup>
              <FormGroup label={t('Acl.RULES')} isRequired fieldId="acl-rules">
                <TextInput
                  id="acl-rules"
                  value={editing.rules}
                  onChange={(_event, value) => setEditing({ ...editing, rules: value })}
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>{t('Acl.RULES_HELP')}</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="primary"
              type="submit"
              form="acl-user-form"
              isLoading={save.isPending}
              isDisabled={editing.username.trim() === '' || save.isPending}
            >
              {t('Acl.SAVE')}
            </Button>
            <Button variant="link" onClick={() => setEditing(undefined)}>
              {t('CANCEL', { ns: 'common' })}
            </Button>
          </ModalFooter>
        </Modal>
      ) : null}

      <ConfirmDialog
        isOpen={deleting !== undefined}
        title={t('Acl.DELETE_TITLE')}
        confirmLabel={t('Acl.DELETE')}
        isDestructive
        isBusy={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting, {
            onSuccess: () => setDeleting(undefined),
            onError: (error) => {
              notify({
                title: t('Acl.DELETE_FAILED'),
                description: error.message,
                variant: 'danger',
              });
              setDeleting(undefined);
            },
          })
        }
        onCancel={() => setDeleting(undefined)}
      >
        {t('Acl.DELETE_BODY', { name: deleting ?? '' })}
      </ConfirmDialog>
    </>
  );
};
