import type { FC } from 'react';
import { useState } from 'react';
import {
  Button,
  Checkbox,
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
import { ServerGroupIcon, PlusCircleIcon } from '@patternfly/react-icons';
import {
  ActionsColumn,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  TreeRowWrapper,
} from '@patternfly/react-table';
import type { TdProps } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@app/Shared/Components/ConfirmDialog';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { useConnections } from '@app/Connections/queries';
import {
  useCreateServerGroup,
  useDeleteServerGroup,
  useServerGroups,
  useSetServerInGroup,
} from './queries';
import { groupName } from './names';
import { toRows, toTree } from './serverGroupTree';
import type { ServerGroupSummary } from './types';

/**
 * Named sets of targets, which may sit inside one another.
 *
 * <p>The other half of what keeps the grants table small. A grant on "production" reaches every
 * server in it and in everything below it, so adding a server to a group is what gives people
 * access to it — rather than a round of grants per person per server.
 */
export const ServerGroupsTab: FC = () => {
  const { t } = useTranslation();
  const groups = useServerGroups();
  const connections = useConnections();
  const remove = useDeleteServerGroup();
  const [creating, setCreating] = useState(false);
  const [editingMembers, setEditingMembers] = useState<ServerGroupSummary | undefined>();
  const [removing, setRemoving] = useState<ServerGroupSummary | undefined>();
  /** Which groups have their children folded away. */
  const [collapsed, setCollapsed] = useState<number[]>([]);

  if (groups.isPending) {
    return <LoadingView />;
  }
  if (groups.isError) {
    return <ErrorView title={t('Access.SERVER_GROUPS_FAILED')} message={groups.error.message} />;
  }

  const nameOf = (id: number) =>
    connections.data?.find((connection) => connection.id === id)?.name ?? `#${id}`;

  // Drawn as a tree rather than stated in a column: what is inside what is the shape of this
  // table, and a group three levels down read as a peer of the one it sits in.
  const rows = toRows(toTree(groups.data), collapsed);

  return (
    <>
      <Toolbar id="server-groups-toolbar" inset={{ default: 'insetNone' }}>
        <ToolbarContent>
          <ToolbarItem>
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => setCreating(true)}>
              {t('Access.ADD_SERVER_GROUP')}
            </Button>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {groups.data.length === 0 ? (
        <EmptyState
          titleText={t('Access.NO_SERVER_GROUPS')}
          icon={ServerGroupIcon}
          headingLevel="h3"
        >
          <EmptyStateBody>{t('Access.NO_SERVER_GROUPS_BODY')}</EmptyStateBody>
        </EmptyState>
      ) : (
        <Table aria-label={t('Access.SERVER_GROUPS')} variant="compact" isTreeTable>
          <Thead>
            <Tr>
              <Th>{t('Access.NAME')}</Th>
              <Th>{t('Access.DESCRIPTION')}</Th>
              <Th>{t('Access.SERVERS')}</Th>
              <Th screenReaderText={t('Access.ACTIONS')} />
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((row, index) => {
              const treeRow: TdProps['treeRow'] = {
                onCollapse: () =>
                  setCollapsed((current) =>
                    row.isExpanded
                      ? [...current, row.group.id]
                      : current.filter((id) => id !== row.group.id),
                  ),
                rowIndex: index,
                props: {
                  isExpanded: row.isExpanded,
                  isHidden: row.isHidden,
                  'aria-level': row.level,
                  'aria-posinset': row.position,
                  'aria-setsize': row.childCount,
                },
              };

              return (
                <TreeRowWrapper key={row.group.id} row={{ props: treeRow.props }}>
                  <Td dataLabel={t('Access.NAME')} treeRow={treeRow}>
                    {groupName(row.group.name)}
                  </Td>
                  <Td dataLabel={t('Access.DESCRIPTION')}>{row.group.description ?? '—'}</Td>
                  <Td dataLabel={t('Access.SERVERS')}>
                    {row.group.connectionIds.length === 0 ? (
                      t('Access.EMPTY_SERVER_GROUP')
                    ) : (
                      <LabelGroup numLabels={5}>
                        {row.group.connectionIds.map((id) => (
                          <Label key={id} isCompact color="teal">
                            {nameOf(id)}
                          </Label>
                        ))}
                      </LabelGroup>
                    )}
                  </Td>
                  <Td isActionCell>
                    <ActionsColumn
                      items={[
                        {
                          title: t('Access.CHOOSE_SERVERS'),
                          onClick: () => setEditingMembers(row.group),
                        },
                        { isSeparator: true },
                        {
                          title: t('Access.REMOVE'),
                          isDanger: true,
                          onClick: () => setRemoving(row.group),
                        },
                      ]}
                    />
                  </Td>
                </TreeRowWrapper>
              );
            })}
          </Tbody>
        </Table>
      )}

      {creating && <ServerGroupDialog groups={groups.data} onClose={() => setCreating(false)} />}
      {editingMembers && (
        <ServersDialog group={editingMembers} onClose={() => setEditingMembers(undefined)} />
      )}
      {removing && (
        <ConfirmDialog
          isOpen
          title={t('Access.REMOVE_SERVER_GROUP_TITLE')}
          confirmLabel={t('Access.REMOVE')}
          isDestructive
          isBusy={remove.isPending}
          onConfirm={() => {
            remove.mutate(removing.id);
            setRemoving(undefined);
          }}
          onCancel={() => setRemoving(undefined)}
        >
          {t('Access.REMOVE_SERVER_GROUP_BODY', { name: removing.name })}
        </ConfirmDialog>
      )}
    </>
  );
};

interface ServerGroupDialogProps {
  groups: ServerGroupSummary[];
  onClose: () => void;
}

const ServerGroupDialog: FC<ServerGroupDialogProps> = ({ groups, onClose }) => {
  const { t } = useTranslation();
  const create = useCreateServerGroup();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');

  return (
    <Modal isOpen variant="small" onClose={onClose} aria-label={t('Access.ADD_SERVER_GROUP')}>
      <ModalHeader title={t('Access.ADD_SERVER_GROUP')} />
      <ModalBody>
        <Form>
          <FormGroup label={t('Access.NAME')} isRequired fieldId="server-group-name">
            <TextInput
              id="server-group-name"
              value={name}
              onChange={(_event, value) => setName(value)}
              isRequired
              autoFocus
            />
          </FormGroup>
          <FormGroup label={t('Access.DESCRIPTION')} fieldId="server-group-description">
            <TextInput
              id="server-group-description"
              value={description}
              onChange={(_event, value) => setDescription(value)}
            />
          </FormGroup>
          <FormGroup label={t('Access.INSIDE')} fieldId="server-group-parent">
            <FormSelect
              id="server-group-parent"
              value={parentId}
              onChange={(_event, value) => setParentId(value)}
              aria-label={t('Access.INSIDE')}
            >
              <FormSelectOption value="" label={t('Access.NO_PARENT')} />
              {groups.map((group) => (
                <FormSelectOption key={group.id} value={String(group.id)} label={group.name} />
              ))}
            </FormSelect>
            <FormHelperText>
              <HelperText>
                <HelperTextItem>{t('Access.PARENT_HELP')}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
          {create.isError && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error">{create.error.message}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          isDisabled={!name || create.isPending}
          onClick={() =>
            create.mutate(
              {
                name,
                description: description || undefined,
                parentId: parentId ? Number(parentId) : null,
              },
              { onSuccess: onClose },
            )
          }
        >
          {t('Access.SAVE')}
        </Button>
        <Button variant="link" onClick={onClose}>
          {t('Access.CANCEL')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

/** Which targets are in this group — a checkbox each, applied as it is ticked. */
const ServersDialog: FC<{ group: ServerGroupSummary; onClose: () => void }> = ({
  group,
  onClose,
}) => {
  const { t } = useTranslation();
  const connections = useConnections();
  const set = useSetServerInGroup();

  return (
    <Modal isOpen variant="small" onClose={onClose} aria-label={t('Access.CHOOSE_SERVERS')}>
      <ModalHeader title={t('Access.SERVERS_IN', { name: group.name })} />
      <ModalBody>
        <Form>
          {(connections.data ?? []).map((connection) => (
            <Checkbox
              key={connection.id}
              id={`server-${connection.id}`}
              label={connection.name}
              description={`${connection.host}:${connection.port}`}
              isChecked={group.connectionIds.includes(connection.id)}
              isDisabled={set.isPending}
              onChange={(_event, checked) =>
                set.mutate({
                  groupId: group.id,
                  connectionId: connection.id,
                  member: checked,
                })
              }
            />
          ))}
          {set.isError && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error">{set.error.message}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
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
