import type { FC } from 'react';
import { useState } from 'react';
import {
  Button,
  Content,
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
  TextInput,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { PlusCircleIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@app/Shared/Components/ConfirmDialog';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { PermissionMatrix } from './PermissionMatrix';
import { useDeleteRole, usePermissionCatalog, useRoles, useSaveRole } from './queries';
import type { RoleSummary } from './types';

/**
 * Named bundles of permissions.
 *
 * <p>Three are built in and cannot be edited: what viewer, operator and administrator carry is
 * defined in code and rewritten at every start, so an edit would be undone by the next restart —
 * which is worse than a refusal, because it would appear to have worked. Anything between them is
 * a custom role.
 */
export const RolesTab: FC = () => {
  const { t } = useTranslation();
  const roles = useRoles();
  const remove = useDeleteRole();
  const [editing, setEditing] = useState<RoleSummary | 'new' | undefined>();
  const [removing, setRemoving] = useState<RoleSummary | undefined>();

  if (roles.isPending) {
    return <LoadingView />;
  }
  if (roles.isError) {
    return <ErrorView title={t('Access.ROLES_FAILED')} message={roles.error.message} />;
  }

  return (
    <>
      <Toolbar id="roles-toolbar" inset={{ default: 'insetNone' }}>
        <ToolbarContent>
          <ToolbarItem>
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => setEditing('new')}>
              {t('Access.ADD_ROLE')}
            </Button>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      <Table aria-label={t('Access.ROLES')} variant="compact">
        <Thead>
          <Tr>
            <Th>{t('Access.NAME')}</Th>
            <Th>{t('Access.DESCRIPTION')}</Th>
            <Th>{t('Access.PERMISSIONS')}</Th>
            <Th screenReaderText={t('Access.ACTIONS')} />
          </Tr>
        </Thead>
        <Tbody>
          {roles.data.map((role) => (
            <Tr key={role.id}>
              <Td dataLabel={t('Access.NAME')}>
                {role.name}{' '}
                {role.builtIn && (
                  <Label isCompact variant="outline">
                    {t('Access.BUILT_IN')}
                  </Label>
                )}
              </Td>
              <Td dataLabel={t('Access.DESCRIPTION')}>{role.description ?? '—'}</Td>
              <Td dataLabel={t('Access.PERMISSIONS')}>
                <LabelGroup numLabels={4}>
                  {[...role.permissions].sort().map((permission) => (
                    <Label key={permission} isCompact color="grey">
                      {permission}
                    </Label>
                  ))}
                </LabelGroup>
              </Td>
              <Td isActionCell>
                <ActionsColumn
                  items={
                    role.builtIn
                      ? [
                          { title: t('Access.VIEW'), onClick: () => setEditing(role) },
                          // Shown and refused rather than absent. "There is no edit button"
                          // is a reasonable thing to conclude from a menu that has none, and
                          // the reason a built-in role has no edit is worth saying once here
                          // instead of leaving somebody to guess it.
                          {
                            title: t('Access.EDIT'),
                            isDisabled: true,
                            description: t('Access.BUILT_IN_HELP'),
                          },
                        ]
                      : [
                          { title: t('Access.EDIT'), onClick: () => setEditing(role) },
                          { isSeparator: true },
                          {
                            title: t('Access.REMOVE'),
                            isDanger: true,
                            onClick: () => setRemoving(role),
                          },
                        ]
                  }
                />
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {editing && (
        <RoleDialog
          role={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
        />
      )}
      {removing && (
        <ConfirmDialog
          isOpen
          title={t('Access.REMOVE_ROLE_TITLE')}
          confirmLabel={t('Access.REMOVE')}
          isDestructive
          isBusy={remove.isPending}
          onConfirm={() => {
            remove.mutate(removing.id);
            setRemoving(undefined);
          }}
          onCancel={() => setRemoving(undefined)}
        >
          {t('Access.REMOVE_ROLE_BODY', { name: removing.name })}
        </ConfirmDialog>
      )}
    </>
  );
};

/**
 * A role, and the permissions it carries.
 *
 * <p>The permission list comes from the server rather than being written here, so a permission
 * added to the backend appears in this editor without a second change — and one that was removed
 * cannot be granted from a stale copy.
 */
const RoleDialog: FC<{ role?: RoleSummary; onClose: () => void }> = ({ role, onClose }) => {
  const { t } = useTranslation();
  const catalog = usePermissionCatalog();
  const save = useSaveRole();
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [chosen, setChosen] = useState<string[]>(role?.permissions ?? []);

  const readOnly = role?.builtIn ?? false;

  return (
    <Modal
      isOpen
      // Large, because what it holds is a grid: a medium modal makes the columns fight each
      // other for width and turns the thing meant to be scannable back into a wall.
      variant="large"
      onClose={onClose}
      aria-label={role ? t('Access.EDIT_ROLE_TITLE') : t('Access.ADD_ROLE')}
    >
      <ModalHeader title={role ? role.name : t('Access.ADD_ROLE')} />
      <ModalBody>
        <Form>
          {!role && (
            <FormGroup label={t('Access.NAME')} isRequired fieldId="role-name">
              <TextInput
                id="role-name"
                value={name}
                onChange={(_event, value) => setName(value)}
                isRequired
                autoFocus
              />
            </FormGroup>
          )}
          <FormGroup label={t('Access.DESCRIPTION')} fieldId="role-description">
            <TextInput
              id="role-description"
              value={description}
              onChange={(_event, value) => setDescription(value)}
              isDisabled={readOnly}
            />
          </FormGroup>

          {readOnly && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem>{t('Access.BUILT_IN_HELP')}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}

          <FormGroup label={t('Access.PERMISSIONS')} fieldId="role-permissions">
            <Content component="p">{t('Access.PERMISSIONS_HELP')}</Content>
            <PermissionMatrix
              catalog={catalog.data ?? []}
              chosen={chosen}
              // Absent rather than disabled-per-checkbox: a built-in role is shown, not edited,
              // and the matrix says so once instead of twenty-eight times.
              onChange={readOnly ? undefined : setChosen}
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
        {!readOnly && (
          <Button
            variant="primary"
            isDisabled={!name || chosen.length === 0 || save.isPending}
            onClick={() =>
              save.mutate(
                {
                  id: role?.id,
                  request: {
                    name: role?.name ?? name,
                    description: description || null,
                    permissions: chosen,
                  },
                },
                { onSuccess: onClose },
              )
            }
          >
            {t('Access.SAVE')}
          </Button>
        )}
        <Button variant="link" onClick={onClose}>
          {readOnly ? t('Access.CLOSE') : t('Access.CANCEL')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
