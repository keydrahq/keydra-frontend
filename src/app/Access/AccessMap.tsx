import type { FC } from 'react';
import { useMemo, useState } from 'react';
import {
  Card,
  CardBody,
  CardFooter,
  Content,
  EmptyState,
  EmptyStateBody,
  Icon,
  Label,
  MenuToggle,
  Pagination,
  SearchInput,
  Select,
  SelectList,
  SelectOption,
  Sidebar,
  SidebarContent,
  SidebarPanel,
  SimpleList,
  SimpleListItem,
  Split,
  SplitItem,
  Stack,
  StackItem,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import { ArrowRightIcon, SecurityIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { useConnections } from '@app/Connections/queries';
import { useGrants, useGroups, useRoles, useServerGroups, useUsers } from './queries';
import type { GrantSummary, GroupSummary, RoleSummary } from './types';

/** How many subjects are listed at once. Thousands of people are a list, not a picture. */
const PER_PAGE = 20;

/** One way access reached somebody: the groups it came through, the role, and the scope. */
interface Path {
  id: string;
  through: string[];
  role: string;
  scopeKind: 'INSTANCE' | 'SERVER_GROUP' | 'CONNECTION';
  scope: string;
  permissions: string[];
}

/**
 * Who reaches what, one subject at a time.
 *
 * <p>The obvious thing to draw here is a graph of everybody against everything, and it is the wrong
 * thing: it is beautiful with four people and unreadable with four hundred, which is the size at
 * which somebody actually needs to ask. The question is never "show me the whole organisation" — it
 * is "how does <em>this person</em> reach that server", asked about one person at a time, usually
 * because they either cannot get somewhere or should not be able to.
 *
 * <p>So: a list on the left that a name can be found in however many there are, and on the right
 * the answer for whoever is selected — one row per way access reached them, read across. The middle
 * column is the part no table anywhere else can show, because it is not in any row: the chain of
 * groups the access came through.
 */
export const AccessMap: FC = () => {
  const { t } = useTranslation();
  const users = useUsers();
  const groups = useGroups();
  const serverGroups = useServerGroups();
  const grants = useGrants();
  const roles = useRoles();
  const connections = useConnections();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | undefined>();
  const [kind, setKind] = useState<'all' | 'people' | 'groups'>('all');
  const [kindOpen, setKindOpen] = useState(false);

  const pending = users.isPending || groups.isPending || serverGroups.isPending || grants.isPending;
  const failure = users.error ?? groups.error ?? serverGroups.error ?? grants.error;

  /** Everybody a grant can be made to, people and groups alike, as one list. */
  const subjects = useMemo(() => {
    const people = (users.data ?? []).map((user) => ({
      key: `user:${user.username}`,
      name: user.username,
      isGroup: false,
    }));
    const teams = (groups.data ?? []).map((group) => ({
      key: `group:${group.name}`,
      name: group.name,
      isGroup: true,
    }));
    return [...people, ...teams];
  }, [users.data, groups.data]);

  const matching = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return subjects
      .filter((subject) =>
        kind === 'all' ? true : kind === 'groups' ? subject.isGroup : !subject.isGroup,
      )
      .filter((subject) => !needle || subject.name.toLowerCase().includes(needle));
  }, [subjects, search, kind]);

  const shown = matching.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const current = selected ?? shown[0]?.key;

  const paths = useMemo(
    () =>
      current
        ? pathsFor(current, groups.data ?? [], grants.data ?? [], roles.data ?? [], (grant) =>
            scopeName(grant, connections.data),
          )
        : [],
    [current, groups.data, grants.data, roles.data, connections.data],
  );

  if (pending) {
    return <LoadingView />;
  }
  if (failure) {
    return <ErrorView title={t('Access.MAP_FAILED')} message={failure.message} />;
  }
  if (subjects.length === 0) {
    return (
      <EmptyState titleText={t('Access.NO_USERS')} icon={SecurityIcon} headingLevel="h3">
        <EmptyStateBody>{t('Access.NO_USERS_BODY')}</EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <Sidebar hasGutter>
      <SidebarPanel variant="sticky" hasNoBackground width={{ default: 'width_25' }}>
        {/* A card, because it is a thing beside another thing rather than a column of loose
            controls — and a toolbar inside it, because that is where PatternFly puts a view's
            own filters. */}
        <Card isCompact>
          <Toolbar id="access-subjects-toolbar" inset={{ default: 'insetSm' }}>
            <ToolbarContent>
              <ToolbarGroup variant="filter-group">
                <ToolbarItem>
                  <SearchInput
                    aria-label={t('Access.FIND_SUBJECT')}
                    placeholder={t('Access.FIND_SUBJECT')}
                    value={search}
                    onChange={(_event, value) => {
                      setSearch(value);
                      setPage(1);
                    }}
                    onClear={() => setSearch('')}
                  />
                </ToolbarItem>
                <ToolbarItem>
                  <Select
                    isOpen={kindOpen}
                    selected={kind}
                    onSelect={(_event, value) => {
                      setKind(value as 'all' | 'people' | 'groups');
                      setKindOpen(false);
                      setPage(1);
                    }}
                    onOpenChange={setKindOpen}
                    toggle={(toggleRef) => (
                      <MenuToggle
                        ref={toggleRef}
                        onClick={() => setKindOpen((open) => !open)}
                        isExpanded={kindOpen}
                      >
                        {t(
                          kind === 'all'
                            ? 'Access.EVERYBODY'
                            : kind === 'people'
                              ? 'Access.ONLY_PEOPLE'
                              : 'Access.ONLY_GROUPS',
                        )}
                      </MenuToggle>
                    )}
                  >
                    <SelectList>
                      <SelectOption value="all">{t('Access.EVERYBODY')}</SelectOption>
                      <SelectOption value="people">{t('Access.ONLY_PEOPLE')}</SelectOption>
                      <SelectOption value="groups">{t('Access.ONLY_GROUPS')}</SelectOption>
                    </SelectList>
                  </Select>
                </ToolbarItem>
              </ToolbarGroup>
            </ToolbarContent>
          </Toolbar>

          <CardBody isFilled={false}>
            <SimpleList aria-label={t('Access.WHO')} onSelect={undefined}>
              {shown.map((subject) => (
                <SimpleListItem
                  key={subject.key}
                  isActive={subject.key === current}
                  onClick={() => setSelected(subject.key)}
                  componentProps={{ 'aria-label': subject.name }}
                >
                  <Split hasGutter>
                    <SplitItem isFilled>{subject.name}</SplitItem>
                    <SplitItem>
                      <Label isCompact color={subject.isGroup ? 'purple' : 'blue'}>
                        {t(subject.isGroup ? 'Access.NODE_GROUP' : 'Access.NODE_PERSON')}
                      </Label>
                    </SplitItem>
                  </Split>
                </SimpleListItem>
              ))}
            </SimpleList>
          </CardBody>

          {/* Paginated rather than scrolled: a list that grows without bound is what makes a
              picture of everybody unusable, and it would do the same here. */}
          <CardFooter>
            <Pagination
              itemCount={matching.length}
              perPage={PER_PAGE}
              page={page}
              onSetPage={(_event, next) => setPage(next)}
              isCompact
              perPageOptions={[]}
              titles={{ paginationAriaLabel: t('Access.WHO') }}
            />
          </CardFooter>
        </Card>
      </SidebarPanel>

      <SidebarContent hasNoBackground>
        <Stack hasGutter>
          <StackItem>
            {/* Whose answer this is. Without it the table on the right belongs to nothing in
                particular, which is exactly how it read. */}
            <Title headingLevel="h3">{current?.slice(current.indexOf(':') + 1) ?? ''}</Title>
            <Content component="small">{t('Access.MAP_DESCRIPTION')}</Content>
          </StackItem>
          <StackItem isFilled>
            {paths.length === 0 ? (
              <EmptyState
                titleText={t('Access.HOLDS_NOTHING')}
                icon={SecurityIcon}
                headingLevel="h3"
              >
                <EmptyStateBody>{t('Access.HOLDS_NOTHING_BODY')}</EmptyStateBody>
              </EmptyState>
            ) : (
              <Table aria-label={t('Access.MAP')} variant="compact">
                <Thead>
                  <Tr>
                    <Th>{t('Access.THROUGH')}</Th>
                    <Th>{t('Access.HOLDS')}</Th>
                    <Th>{t('Access.ON')}</Th>
                    <Th>{t('Access.PERMISSIONS')}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {paths.map((path) => (
                    <Tr key={path.id}>
                      <Td dataLabel={t('Access.THROUGH')}>
                        {/*
                         * The chain, read across. This is the column that earns the page: it is not
                         * in the grants table, not in the groups table, and not in any single row
                         * anywhere — it is what joining them produces.
                         */}
                        <Split hasGutter>
                          <SplitItem>
                            <Label isCompact variant="outline">
                              {current?.startsWith('group:')
                                ? current.slice('group:'.length)
                                : current?.slice('user:'.length)}
                            </Label>
                          </SplitItem>
                          {path.through.length === 0 ? (
                            <SplitItem>
                              <Content component="small">{t('Access.DIRECTLY')}</Content>
                            </SplitItem>
                          ) : (
                            path.through.map((step) => (
                              <SplitItem key={step}>
                                <Split hasGutter>
                                  <SplitItem>
                                    <Icon isInline>
                                      <ArrowRightIcon />
                                    </Icon>
                                  </SplitItem>
                                  <SplitItem>
                                    <Label isCompact color="purple">
                                      {step}
                                    </Label>
                                  </SplitItem>
                                </Split>
                              </SplitItem>
                            ))
                          )}
                        </Split>
                      </Td>
                      <Td dataLabel={t('Access.HOLDS')}>
                        <Label isCompact color="blue">
                          {path.role}
                        </Label>
                      </Td>
                      <Td dataLabel={t('Access.ON')}>
                        <Label isCompact variant="outline">
                          {t(
                            path.scopeKind === 'INSTANCE'
                              ? 'Access.NODE_INSTANCE'
                              : path.scopeKind === 'SERVER_GROUP'
                                ? 'Access.NODE_SERVER_GROUP'
                                : 'Access.NODE_SERVER',
                          )}
                        </Label>{' '}
                        {path.scope}
                      </Td>
                      <Td dataLabel={t('Access.PERMISSIONS')}>
                        <Content component="small">
                          {t('Access.PERMISSION_COUNT', { count: path.permissions.length })}
                        </Content>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </StackItem>
        </Stack>
      </SidebarContent>
    </Sidebar>
  );
};

/** A connection scope arrives as an id; its name lives in the catalog this page already has. */
const scopeName = (
  grant: GrantSummary,
  connections: { id: number; name: string }[] | undefined,
): string => {
  if (grant.scopeType !== 'CONNECTION') {
    return grant.scopeName;
  }
  return (
    connections?.find((candidate) => candidate.id === grant.scopeId)?.name ?? `#${grant.scopeId}`
  );
};

/**
 * Every way access reached this subject.
 *
 * <p>Walks up the group graph from the subject, remembering the chain it came by, and collects the
 * grants made to anything it passed through. The chain is what the middle column shows, and it is
 * the whole reason this is computed rather than read: a grant names one subject, and the person it
 * actually reaches may be three groups away from it.
 */
const pathsFor = (
  subjectKey: string,
  groups: GroupSummary[],
  grants: GrantSummary[],
  roles: RoleSummary[],
  scopeOf: (grant: GrantSummary) => string,
): Path[] => {
  const isGroup = subjectKey.startsWith('group:');
  const name = subjectKey.slice(subjectKey.indexOf(':') + 1);

  /** Group name → the chain of groups leading to it, shortest first. */
  const reached = new Map<string, string[]>();
  let frontier: { group: string; through: string[] }[] = groups
    .filter((group) =>
      isGroup ? group.memberGroups.includes(name) : group.memberUsers.includes(name),
    )
    .map((group) => ({ group: group.name, through: [group.name] }));

  while (frontier.length > 0) {
    const next: { group: string; through: string[] }[] = [];
    frontier.forEach(({ group, through }) => {
      if (reached.has(group)) {
        return;
      }
      reached.set(group, through);
      groups
        .filter((candidate) => candidate.memberGroups.includes(group))
        .forEach((candidate) =>
          next.push({ group: candidate.name, through: [...through, candidate.name] }),
        );
    });
    frontier = next;
  }

  const permissionsOf = (roleName: string) =>
    roles.find((role) => role.name === roleName)?.permissions ?? [];

  return grants
    .filter((grant) => {
      if (grant.subjectType === 'USER') {
        return !isGroup && grant.subjectName === name;
      }
      return (isGroup && grant.subjectName === name) || reached.has(grant.subjectName);
    })
    .map((grant) => ({
      id: String(grant.id),
      through:
        grant.subjectName === name ? [] : (reached.get(grant.subjectName) ?? [grant.subjectName]),
      role: grant.roleName,
      scopeKind: grant.scopeType,
      scope: scopeOf(grant),
      permissions: permissionsOf(grant.roleName),
    }))
    .sort((left, right) => left.through.length - right.through.length);
};
