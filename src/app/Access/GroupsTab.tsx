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
import { UsersIcon, PlusCircleIcon } from '@patternfly/react-icons';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@app/Shared/Components/ConfirmDialog';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { useAddGroupMember, useCreateGroup, useDeleteGroup, useGroups, useUsers } from './queries';
import { groupName } from './names';
import type { GroupSummary } from './types';

/**
 * Named sets of people, which may contain other sets.
 *
 * <p>This is what keeps the grants table small. "The platform team may operate the payments
 * servers" is one row however many people are on the team, and stays one row when somebody joins —
 * which means joining a team is the whole of granting them access.
 */
export const GroupsTab: FC = () => {
  const { t } = useTranslation();
  const groups = useGroups();
  const remove = useDeleteGroup();
  const [creating, setCreating] = useState(false);
  const [addingTo, setAddingTo] = useState<GroupSummary | undefined>();
  const [removing, setRemoving] = useState<GroupSummary | undefined>();

  if (groups.isPending) {
    return <LoadingView />;
  }
  if (groups.isError) {
    return <ErrorView title={t('Access.GROUPS_FAILED')} message={groups.error.message} />;
  }

  return (
    <>
      <Toolbar id="groups-toolbar" inset={{ default: 'insetNone' }}>
        <ToolbarContent>
          <ToolbarItem>
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => setCreating(true)}>
              {t('Access.ADD_GROUP')}
            </Button>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {groups.data.length === 0 ? (
        <EmptyState titleText={t('Access.NO_GROUPS')} icon={UsersIcon} headingLevel="h3">
          <EmptyStateBody>{t('Access.NO_GROUPS_BODY')}</EmptyStateBody>
        </EmptyState>
      ) : (
        <Table aria-label={t('Access.GROUPS')} variant="compact">
          <Thead>
            <Tr>
              <Th>{t('Access.NAME')}</Th>
              <Th>{t('Access.DESCRIPTION')}</Th>
              <Th>{t('Access.MEMBERS')}</Th>
              <Th screenReaderText={t('Access.ACTIONS')} />
            </Tr>
          </Thead>
          <Tbody>
            {groups.data.map((group) => (
              <Tr key={group.id}>
                <Td dataLabel={t('Access.NAME')}>{groupName(group.name)}</Td>
                <Td dataLabel={t('Access.DESCRIPTION')}>{group.description ?? '—'}</Td>
                <Td dataLabel={t('Access.MEMBERS')}>
                  {group.memberUsers.length + group.memberGroups.length === 0 ? (
                    t('Access.EMPTY_GROUP')
                  ) : (
                    <LabelGroup numLabels={5}>
                      {group.memberUsers.map((name) => (
                        <Label key={`u-${name}`} isCompact color="blue">
                          {name}
                        </Label>
                      ))}
                      {group.memberGroups.map((name) => (
                        <Label key={`g-${name}`} isCompact color="purple">
                          {groupName(name)}
                        </Label>
                      ))}
                    </LabelGroup>
                  )}
                </Td>
                <Td isActionCell>
                  <ActionsColumn
                    items={[
                      { title: t('Access.ADD_MEMBER'), onClick: () => setAddingTo(group) },
                      { isSeparator: true },
                      {
                        title: t('Access.REMOVE'),
                        isDanger: true,
                        onClick: () => setRemoving(group),
                      },
                    ]}
                  />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {creating && <GroupDialog onClose={() => setCreating(false)} />}
      {addingTo && (
        <MemberDialog
          group={addingTo}
          others={groups.data.filter((other) => other.id !== addingTo.id)}
          onClose={() => setAddingTo(undefined)}
        />
      )}
      {removing && (
        <ConfirmDialog
          isOpen
          title={t('Access.REMOVE_GROUP_TITLE')}
          confirmLabel={t('Access.REMOVE')}
          isDestructive
          isBusy={remove.isPending}
          onConfirm={() => {
            remove.mutate(removing.id);
            setRemoving(undefined);
          }}
          onCancel={() => setRemoving(undefined)}
        >
          {t('Access.REMOVE_GROUP_BODY', { name: removing.name })}
        </ConfirmDialog>
      )}
    </>
  );
};

const GroupDialog: FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useTranslation();
  const create = useCreateGroup();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  return (
    <Modal isOpen variant="small" onClose={onClose} aria-label={t('Access.ADD_GROUP')}>
      <ModalHeader title={t('Access.ADD_GROUP')} />
      <ModalBody>
        <Form>
          <FormGroup label={t('Access.NAME')} isRequired fieldId="group-name">
            <TextInput
              id="group-name"
              value={name}
              onChange={(_event, value) => setName(value)}
              isRequired
              autoFocus
            />
          </FormGroup>
          <FormGroup label={t('Access.DESCRIPTION')} fieldId="group-description">
            <TextInput
              id="group-description"
              value={description}
              onChange={(_event, value) => setDescription(value)}
            />
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
            create.mutate({ name, description: description || undefined }, { onSuccess: onClose })
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

interface MemberDialogProps {
  group: GroupSummary;
  /** Every other group, since a group may contain one — but never itself. */
  others: GroupSummary[];
  onClose: () => void;
}

const MemberDialog: FC<MemberDialogProps> = ({ group, others, onClose }) => {
  const { t } = useTranslation();
  const users = useUsers();
  const add = useAddGroupMember();
  const [choice, setChoice] = useState('');

  const submit = () => {
    const [kind, id] = choice.split(':');
    add.mutate(
      {
        groupId: group.id,
        userId: kind === 'user' ? Number(id) : undefined,
        memberGroupId: kind === 'group' ? Number(id) : undefined,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal isOpen variant="small" onClose={onClose} aria-label={t('Access.ADD_MEMBER')}>
      <ModalHeader title={t('Access.ADD_MEMBER_TO', { name: group.name })} />
      <ModalBody>
        <Form>
          <FormGroup label={t('Access.MEMBER')} isRequired fieldId="member-choice">
            <FormSelect
              id="member-choice"
              value={choice}
              onChange={(_event, value) => setChoice(value)}
              aria-label={t('Access.MEMBER')}
            >
              <FormSelectOption value="" label={t('Access.CHOOSE')} isDisabled />
              {(users.data ?? []).map((user) => (
                <FormSelectOption
                  key={`user-${user.id}`}
                  value={`user:${user.id}`}
                  label={t('Access.PERSON_OPTION', { name: user.username })}
                />
              ))}
              {others.map((other) => (
                <FormSelectOption
                  key={`group-${other.id}`}
                  value={`group:${other.id}`}
                  label={t('Access.GROUP_OPTION', { name: other.name })}
                />
              ))}
            </FormSelect>
          </FormGroup>
          {add.isError && (
            <FormHelperText>
              <HelperText>
                {/* A group about to contain itself is refused by the server, and this is
                    where that sentence belongs. */}
                <HelperTextItem variant="error">{add.error.message}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          icon={<PlusCircleIcon />}
          isDisabled={!choice || add.isPending}
          onClick={submit}
        >
          {t('Access.ADD')}
        </Button>
        <Button variant="link" onClick={onClose}>
          {t('Access.CANCEL')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
