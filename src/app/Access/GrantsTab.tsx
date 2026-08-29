import type { FC } from 'react';
import { useState } from 'react';
import {
  Button,
  EmptyState,
  EmptyStateBody,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { SecurityIcon, PlusCircleIcon } from '@patternfly/react-icons';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@app/Shared/Components/ConfirmDialog';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { useConnections } from '@app/Connections/queries';
import {
  useGrant,
  useGrants,
  useGroups,
  useRevoke,
  useRoles,
  useServerGroups,
  useUsers,
} from './queries';
import type { GrantSummary, ScopeType } from './types';

/**
 * Who holds which role on what.
 *
 * <p>The whole model is this one table plus the two containments. There are no denials — a grant
 * adds and nothing subtracts — because a rule that takes something away is a rule you cannot find
 * by looking at what somebody has. Absence is the denial, and absence is visible.
 */
export const GrantsTab: FC = () => {
  const { t } = useTranslation();
  const grants = useGrants();
  const connections = useConnections();
  const revoke = useRevoke();
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState<GrantSummary | undefined>();

  if (grants.isPending) {
    return <LoadingView />;
  }
  if (grants.isError) {
    return <ErrorView title={t('Access.GRANTS_FAILED')} message={grants.error.message} />;
  }

  /** A connection scope arrives as an id, because its name lives in another domain's table. */
  const scopeLabel = (grant: GrantSummary) => {
    if (grant.scopeType !== 'CONNECTION') {
      return grant.scopeName;
    }
    const connection = connections.data?.find((candidate) => candidate.id === grant.scopeId);
    return connection?.name ?? `#${grant.scopeId}`;
  };

  return (
    <>
      <Toolbar id="grants-toolbar" inset={{ default: 'insetNone' }}>
        <ToolbarContent>
          <ToolbarItem>
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => setGranting(true)}>
              {t('Access.ADD_GRANT')}
            </Button>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {grants.data.length === 0 ? (
        <EmptyState titleText={t('Access.NO_GRANTS')} icon={SecurityIcon} headingLevel="h3">
          <EmptyStateBody>{t('Access.NO_GRANTS_BODY')}</EmptyStateBody>
        </EmptyState>
      ) : (
        <Table aria-label={t('Access.GRANTS')} variant="compact">
          <Thead>
            <Tr>
              <Th>{t('Access.WHO')}</Th>
              <Th>{t('Access.HOLDS')}</Th>
              <Th>{t('Access.ON')}</Th>
              <Th>{t('Access.GRANTED')}</Th>
              <Th screenReaderText={t('Access.ACTIONS')} />
            </Tr>
          </Thead>
          <Tbody>
            {grants.data.map((grant) => (
              <Tr key={grant.id}>
                <Td dataLabel={t('Access.WHO')}>
                  <Label isCompact color={grant.subjectType === 'USER' ? 'blue' : 'purple'}>
                    {grant.subjectName}
                  </Label>
                </Td>
                <Td dataLabel={t('Access.HOLDS')}>{grant.roleName}</Td>
                <Td dataLabel={t('Access.ON')}>
                  <Label isCompact variant="outline">
                    {t(`Access.SCOPE_${grant.scopeType}`)}
                  </Label>{' '}
                  {scopeLabel(grant)}
                </Td>
                <Td dataLabel={t('Access.GRANTED')}>
                  {new Date(grant.grantedAt).toLocaleString()}
                  {grant.grantedBy ? ` · ${grant.grantedBy}` : ''}
                </Td>
                <Td isActionCell>
                  <ActionsColumn
                    items={[
                      {
                        title: t('Access.REVOKE'),
                        isDanger: true,
                        onClick: () => setRevoking(grant),
                      },
                    ]}
                  />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {granting && <GrantDialog onClose={() => setGranting(false)} />}
      {revoking && (
        <ConfirmDialog
          isOpen
          title={t('Access.REVOKE_TITLE')}
          confirmLabel={t('Access.REVOKE')}
          isDestructive
          isBusy={revoke.isPending}
          onConfirm={() => {
            revoke.mutate(revoking.id);
            setRevoking(undefined);
          }}
          onCancel={() => setRevoking(undefined)}
        >
          {t('Access.REVOKE_BODY', {
            who: revoking.subjectName,
            role: revoking.roleName,
            on: scopeLabel(revoking),
          })}
        </ConfirmDialog>
      )}
    </>
  );
};

/** One sentence, composed: this subject holds this role on this scope. */
const GrantDialog: FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useTranslation();
  const users = useUsers();
  const groups = useGroups();
  const serverGroups = useServerGroups();
  const connections = useConnections();
  const roles = useRoles();
  const grant = useGrant();

  const [subject, setSubject] = useState('');
  const [scopeType, setScopeType] = useState<ScopeType>('SERVER_GROUP');
  const [scopeId, setScopeId] = useState('');
  const [roleId, setRoleId] = useState('');

  const needsScope = scopeType !== 'INSTANCE';
  const ready = !!subject && !!roleId && (!needsScope || !!scopeId);

  const submit = () => {
    const [kind, id] = subject.split(':');
    grant.mutate(
      {
        subjectType: kind === 'user' ? 'USER' : 'GROUP',
        subjectId: Number(id),
        scopeType,
        scopeId: needsScope ? Number(scopeId) : null,
        roleId: Number(roleId),
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal isOpen variant="small" onClose={onClose} aria-label={t('Access.ADD_GRANT')}>
      <ModalHeader title={t('Access.ADD_GRANT')} />
      <ModalBody>
        <Form>
          <FormGroup label={t('Access.WHO')} isRequired fieldId="grant-subject">
            <FormSelect
              id="grant-subject"
              value={subject}
              onChange={(_event, value) => setSubject(value)}
              aria-label={t('Access.WHO')}
            >
              <FormSelectOption value="" label={t('Access.CHOOSE')} isDisabled />
              {(groups.data ?? []).map((group) => (
                <FormSelectOption
                  key={`group-${group.id}`}
                  value={`group:${group.id}`}
                  label={t('Access.GROUP_OPTION', { name: group.name })}
                />
              ))}
              {(users.data ?? []).map((user) => (
                <FormSelectOption
                  key={`user-${user.id}`}
                  value={`user:${user.id}`}
                  label={t('Access.PERSON_OPTION', { name: user.username })}
                />
              ))}
            </FormSelect>
            <FormHelperText>
              <HelperText>
                <HelperTextItem>{t('Access.PREFER_GROUPS')}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>

          <FormGroup label={t('Access.HOLDS')} isRequired fieldId="grant-role">
            <FormSelect
              id="grant-role"
              value={roleId}
              onChange={(_event, value) => setRoleId(value)}
              aria-label={t('Access.HOLDS')}
            >
              <FormSelectOption value="" label={t('Access.CHOOSE')} isDisabled />
              {(roles.data ?? []).map((role) => (
                <FormSelectOption key={role.id} value={String(role.id)} label={role.name} />
              ))}
            </FormSelect>
          </FormGroup>

          <FormGroup label={t('Access.ON')} isRequired fieldId="grant-scope-type">
            <FormSelect
              id="grant-scope-type"
              value={scopeType}
              onChange={(_event, value) => {
                setScopeType(value as ScopeType);
                setScopeId('');
              }}
              aria-label={t('Access.ON')}
            >
              <FormSelectOption value="SERVER_GROUP" label={t('Access.SCOPE_SERVER_GROUP')} />
              <FormSelectOption value="CONNECTION" label={t('Access.SCOPE_CONNECTION')} />
              <FormSelectOption value="INSTANCE" label={t('Access.SCOPE_INSTANCE')} />
            </FormSelect>
          </FormGroup>

          {needsScope && (
            <FormGroup label={t('Access.WHICH')} isRequired fieldId="grant-scope">
              <FormSelect
                id="grant-scope"
                value={scopeId}
                onChange={(_event, value) => setScopeId(value)}
                aria-label={t('Access.WHICH')}
              >
                <FormSelectOption value="" label={t('Access.CHOOSE')} isDisabled />
                {scopeType === 'SERVER_GROUP'
                  ? (serverGroups.data ?? []).map((group) => (
                      <FormSelectOption
                        key={group.id}
                        value={String(group.id)}
                        label={group.name}
                      />
                    ))
                  : (connections.data ?? []).map((connection) => (
                      <FormSelectOption
                        key={connection.id}
                        value={String(connection.id)}
                        label={connection.name}
                      />
                    ))}
              </FormSelect>
            </FormGroup>
          )}

          {grant.isError && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error">{grant.error.message}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" isDisabled={!ready || grant.isPending} onClick={submit}>
          {t('Access.GRANT')}
        </Button>
        <Button variant="link" onClick={onClose}>
          {t('Access.CANCEL')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
