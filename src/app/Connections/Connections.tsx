import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  Button,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  Gallery,
  Label,
  LabelGroup,
  PageSection,
  Pagination,
  SearchInput,
  Sidebar,
  SidebarContent,
  SidebarPanel,
  Stack,
  StackItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  TreeView,
} from '@patternfly/react-core';
import type { TreeViewDataItem } from '@patternfly/react-core';
import {
  FilterSidePanel,
  FilterSidePanelCategory,
  FilterSidePanelCategoryItem,
  VerticalTabs,
  VerticalTabsTab,
} from '@patternfly/react-catalog-view-extension';
import { PlusCircleIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@app/Shared/Components/ConfirmDialog';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { PageHeader } from '@app/Shared/Components/PageHeader';
import { Permission, useHoldsPermission } from '@app/Login/queries';
import { useServerGroups, useSetServerInGroup } from '@app/Access/queries';
import { groupName } from '@app/Access/names';
import { toTree } from '@app/Access/serverGroupTree';
import type { ConnectionRequest, ConnectionResponse } from '@app/Shared/Services/api.types';
import { ConnectionState, ConnectionType } from '@app/Shared/Services/api.types';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import { ConnectionTile } from './ConnectionTile';
import { connectionTypeKey } from './labels';
import { serverName } from './serverLogo';
import { ConnectionFormModal } from './ConnectionFormModal';
import {
  useConnections,
  useCreateConnection,
  useDeleteConnection,
  useTestConnection,
  useUpdateConnection,
} from './queries';

/** The category that narrows nothing, which is where the catalog opens. */
const ALL_TYPES = 'all';

/** How many server groups the filter panel lists before offering the rest behind a search. */

/** Three rows of four on a wide screen, which is a catalog rather than a scroll. */
const DEFAULT_PER_PAGE = 12;

/** Connections page: lists saved targets and owns the create/edit/delete/test interactions. */
export const Connections: FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('Connections.TITLE'));

  const { data, isPending, isError, error, refetch } = useConnections();
  const create = useCreateConnection();
  const update = useUpdateConnection();
  const remove = useDeleteConnection();
  const test = useTestConnection();

  // Live status changes arrive over the notification hub, so the list updates
  // without the page polling for them.

  const [formOpen, setFormOpen] = useState(false);
  /** Which server groups the open dialog says this target belongs to. */
  const [chosenGroups, setChosenGroups] = useState<number[]>([]);
  const [editing, setEditing] = useState<ConnectionResponse | undefined>();
  const [deleting, setDeleting] = useState<ConnectionResponse | undefined>();
  const [search, setSearch] = useState('');
  const [states, setStates] = useState<ReadonlySet<string>>(new Set());
  const [flavors, setFlavors] = useState<ReadonlySet<string>>(new Set());
  /** Which server groups the catalog is narrowed to, by id. */
  const [groups, setGroups] = useState<ReadonlySet<string>>(new Set());
  /** The chosen category, or ALL. One arrangement at a time, unlike the tick-box filters. */
  const [type, setType] = useState<string>(ALL_TYPES);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);

  const connections = useMemo(() => data ?? [], [data]);

  const flavorOf = (profile: ConnectionResponse) => profile.status.server?.flavor ?? 'unknown';

  /** The category list: everything, then one entry per arrangement that is actually saved. */
  const categories = useMemo(
    () => [
      { key: ALL_TYPES, label: t('Connections.ALL_TYPES'), count: connections.length },
      ...Object.values(ConnectionType)
        .map((value) => ({
          key: value as string,
          label: t(connectionTypeKey(value)),
          count: connections.filter((profile) => profile.type === value).length,
        }))
        .filter((category) => category.count > 0),
    ],
    [connections, t],
  );

  /** How many targets each filter would leave, which is what makes a filter panel useful. */
  // Pointing Keydra at a target is a permission over Keydra itself, not over any one server.
  const mayAddTargets = useHoldsPermission(Permission.ConnectionCreate);
  const serverGroups = useServerGroups();
  const setInGroup = useSetServerInGroup();

  const counts = useMemo(() => {
    const byState = new Map<string, number>();
    const byFlavor = new Map<string, number>();
    for (const profile of connections) {
      byState.set(profile.status.state, (byState.get(profile.status.state) ?? 0) + 1);
      byFlavor.set(flavorOf(profile), (byFlavor.get(flavorOf(profile)) ?? 0) + 1);
    }
    return { byState, byFlavor };
  }, [connections]);

  /**
   * Which targets are in which server group, counting the groups below each one.
   *
   * <p>Downward, because that is what a grant on a group means: one on `production` reaches the
   * servers inside `test` as well, so filtering by `production` and being shown only its own
   * direct members would answer a different question from the one the grant answers.
   */
  const byGroup = useMemo(() => {
    const all = serverGroups.data ?? [];
    const reach = (id: number): number[] => [
      ...(all.find((group) => group.id === id)?.connectionIds ?? []),
      ...all.filter((group) => group.parentId === id).flatMap((child) => reach(child.id)),
    ];
    return new Map(all.map((group) => [group.id, new Set(reach(group.id))]));
  }, [serverGroups.data]);

  /**
   * The server groups as a tree the filter panel can draw.
   *
   * <p>Counts are of the connections directly in each group rather than of everything beneath it.
   * A parent's badge counting its children's servers would double-count them against its own, and
   * the number beside a checkbox has to be the number that checkbox will show.
   */
  const groupTree = useMemo((): TreeViewDataItem[] => {
    const build = (nodes: ReturnType<typeof toTree>): TreeViewDataItem[] =>
      nodes.map((node) => ({
        id: String(node.group.id),
        name: groupName(node.group.name),
        hasCheckbox: true,
        customBadgeContent: connections.filter((profile) =>
          byGroup.get(node.group.id)?.has(profile.id),
        ).length,
        checkProps: { checked: groups.has(String(node.group.id)) },
        // Open, because a filter nobody can see is a filter nobody uses. The reader folds
        // what they do not need; PatternFly remembers.
        defaultExpanded: true,
        children: node.children.length > 0 ? build(node.children) : undefined,
      }));
    return build(toTree(serverGroups.data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverGroups.data, connections, groups]);

  // Name or endpoint for the text, and the side panel for the rest. An empty set means
  // "not narrowed", which is what makes ticking nothing show everything.
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return connections.filter((profile) => {
      const matchesText =
        !needle || `${profile.name} ${profile.host}:${profile.port}`.toLowerCase().includes(needle);
      return (
        matchesText &&
        (type === ALL_TYPES || profile.type === type) &&
        (states.size === 0 || states.has(profile.status.state)) &&
        (flavors.size === 0 || flavors.has(flavorOf(profile))) &&
        (groups.size === 0 ||
          [...groups].some((id) => byGroup.get(Number(id))?.has(profile.id) === true))
      );
    });
  }, [connections, flavors, groups, byGroup, search, states, type]);

  /** One page of the catalog. Everything above counts the whole match, not the page. */
  const paged = useMemo(
    () => shown.slice((page - 1) * perPage, page * perPage),
    [page, perPage, shown],
  );

  /** Ticking a box adds it; ticking it again takes it away. */
  const toggle = (
    set: ReadonlySet<string>,
    apply: (next: ReadonlySet<string>) => void,
    value: string,
  ) => {
    const next = new Set(set);
    if (!next.delete(value)) {
      next.add(value);
    }
    apply(next);
  };

  /** Whether anything is currently narrowing the grid, which is what the clear link is for. */
  const hasFilters =
    search.trim() !== '' ||
    states.size > 0 ||
    flavors.size > 0 ||
    groups.size > 0 ||
    type !== ALL_TYPES;

  const clearFilters = () => {
    setSearch('');
    setStates(new Set());
    setFlavors(new Set());
    setGroups(new Set());
    setType(ALL_TYPES);
    setPage(1);
  };

  const upCount = connections.filter(
    (profile) => profile.status.state === ConnectionState.Up,
  ).length;

  const openCreate = useCallback(() => {
    setEditing(undefined);
    setChosenGroups([]);
    create.reset();
    update.reset();
    setFormOpen(true);
  }, [create, update]);

  const openEdit = useCallback(
    (profile: ConnectionResponse) => {
      setEditing(profile);
      setChosenGroups(
        (serverGroups.data ?? [])
          .filter((group) => group.connectionIds.includes(profile.id))
          .map((group) => group.id),
      );
      create.reset();
      update.reset();
      setFormOpen(true);
    },
    [create, update, serverGroups.data],
  );

  /**
   * Saves the profile, then puts it in the groups the dialog chose.
   *
   * <p>Afterwards rather than together: a new profile has no id to put anywhere until it has
   * been saved, and membership lives in the authorization tables rather than on the profile.
   * Two calls, and the second only happens if the first worked — a target that failed to save
   * has nothing to be a member of.
   */
  const submit = useCallback(
    (request: ConnectionRequest) => {
      const applyGroups = (id: number) => {
        const before = (serverGroups.data ?? [])
          .filter((group) => group.connectionIds.includes(id))
          .map((group) => group.id);

        before
          .filter((groupId) => !chosenGroups.includes(groupId))
          .forEach((groupId) => setInGroup.mutate({ groupId, connectionId: id, member: false }));
        chosenGroups
          .filter((groupId) => !before.includes(groupId))
          .forEach((groupId) => setInGroup.mutate({ groupId, connectionId: id, member: true }));

        setFormOpen(false);
      };

      if (editing) {
        update.mutate(
          { id: editing.id, body: request },
          { onSuccess: () => applyGroups(editing.id) },
        );
      } else {
        create.mutate(request, { onSuccess: (created) => applyGroups(created.id) });
      }
    },
    [create, editing, update, chosenGroups, serverGroups.data, setInGroup],
  );

  const confirmDelete = useCallback(() => {
    if (deleting) {
      remove.mutate(deleting.id, { onSuccess: () => setDeleting(undefined) });
    }
  }, [deleting, remove]);

  if (isPending) {
    return (
      <PageSection>
        <LoadingView />
      </PageSection>
    );
  }

  if (isError) {
    return (
      <PageSection>
        <ErrorView
          title={t('Connections.LOAD_ERROR_TITLE')}
          failure={error}
          onRetry={() => void refetch()}
        />
      </PageSection>
    );
  }

  const activeMutation = editing ? update : create;

  return (
    <>
      <PageHeader
        title={t('Connections.TITLE')}
        description={
          connections.length
            ? t('Connections.SUMMARY', { count: connections.length, up: upCount })
            : t('Connections.DESCRIPTION')
        }
        actions={
          connections.length && mayAddTargets ? (
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>
              {t('Connections.ADD')}
            </Button>
          ) : undefined
        }
      />

      <PageSection isFilled>
        {connections.length === 0 ? (
          <EmptyState
            titleText={t('Connections.EMPTY_TITLE')}
            icon={PlusCircleIcon}
            headingLevel="h2"
          >
            <EmptyStateBody>{t('Connections.EMPTY_BODY')}</EmptyStateBody>
            {/* No footer without the permission: an empty catalog somebody cannot add to is
                a page whose only action would be refused, and the sentence above it already
                explains that nothing has been shared with them. */}
            {mayAddTargets && (
              <EmptyStateFooter>
                <EmptyStateActions>
                  <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>
                    {t('Connections.ADD')}
                  </Button>
                </EmptyStateActions>
              </EmptyStateFooter>
            )}
          </EmptyState>
        ) : (
          <Stack hasGutter>
            <StackItem>
              {/* Over the catalog rather than inside the filter panel: the text search
                  narrows what the grid shows, the same as the panel does, and PatternFly
                  puts a view's own controls in a toolbar above the view. */}
              {/* The applied filters sit in this row rather than in the one PatternFly
                  puts below it. A chip row that appears when a filter is applied moves
                  everything under it down by its own height, which is the grid somebody is
                  looking at while they filter — so the labels are composed here, beside the
                  control that set them, and the page keeps still. */}
              <Toolbar id="connections-toolbar">
                <ToolbarContent alignItems="center">
                  <ToolbarItem>
                    <SearchInput
                      aria-label={t('Connections.FILTER')}
                      placeholder={t('Connections.FILTER')}
                      value={search}
                      onChange={(_event, value) => setSearch(value)}
                      onClear={() => setSearch('')}
                    />
                  </ToolbarItem>

                  {states.size > 0 && (
                    <ToolbarItem>
                      <LabelGroup
                        categoryName={t('Connections.STATUS')}
                        isClosable
                        onClick={() => setStates(new Set())}
                        closeBtnAriaLabel={t('KeyBrowser.CLEAR_FILTERS')}
                      >
                        {[...states].map((state) => (
                          <Label
                            key={state}
                            isCompact
                            onClose={() => toggle(states, setStates, state)}
                          >
                            {t(`Connections.STATE_${state}` as 'Connections.STATE_UP')}
                          </Label>
                        ))}
                      </LabelGroup>
                    </ToolbarItem>
                  )}

                  {flavors.size > 0 && (
                    <ToolbarItem>
                      <LabelGroup
                        categoryName={t('Connections.SERVER')}
                        isClosable
                        onClick={() => setFlavors(new Set())}
                        closeBtnAriaLabel={t('KeyBrowser.CLEAR_FILTERS')}
                      >
                        {[...flavors].map((flavor) => (
                          <Label
                            key={flavor}
                            isCompact
                            onClose={() => toggle(flavors, setFlavors, flavor)}
                          >
                            {serverName(flavor)}
                          </Label>
                        ))}
                      </LabelGroup>
                    </ToolbarItem>
                  )}

                  {groups.size > 0 && (
                    <ToolbarItem>
                      <LabelGroup
                        categoryName={t('Connections.SERVER_GROUP')}
                        isClosable
                        onClick={() => setGroups(new Set())}
                        closeBtnAriaLabel={t('KeyBrowser.CLEAR_FILTERS')}
                      >
                        {[...groups].map((id) => (
                          <Label key={id} isCompact onClose={() => toggle(groups, setGroups, id)}>
                            {(serverGroups.data ?? []).find((group) => String(group.id) === id)
                              ?.name ?? id}
                          </Label>
                        ))}
                      </LabelGroup>
                    </ToolbarItem>
                  )}

                  {hasFilters && (
                    <ToolbarItem>
                      <Button variant="link" isInline onClick={clearFilters}>
                        {t('KeyBrowser.CLEAR_FILTERS')}
                      </Button>
                    </ToolbarItem>
                  )}

                  <ToolbarItem variant="pagination" align={{ default: 'alignEnd' }}>
                    <Pagination
                      isCompact
                      itemCount={shown.length}
                      page={page}
                      perPage={perPage}
                      onSetPage={(_event, next) => setPage(next)}
                      onPerPageSelect={(_event, next) => {
                        setPerPage(next);
                        setPage(1);
                      }}
                      titles={{ paginationAriaLabel: t('Connections.PAGINATION') }}
                    />
                  </ToolbarItem>
                </ToolbarContent>
              </Toolbar>
            </StackItem>

            <StackItem isFilled>
              <Sidebar hasGutter>
                <SidebarPanel variant="sticky" hasNoBackground>
                  {/* The catalog's own filter panel: each entry says how many targets it would
                  leave, which is the thing that makes a filter panel worth having. */}
                  <FilterSidePanel id="connection-filters">
                    {/* The catalog's own category list: one arrangement at a time, above the
                    filters that cut across all of them. */}
                    <VerticalTabs>
                      {categories.map((category) => (
                        <VerticalTabsTab
                          key={category.key}
                          active={type === category.key}
                          title={`${category.label} (${category.count})`}
                          onActivate={() => {
                            setType(category.key);
                            setPage(1);
                          }}
                        />
                      ))}
                    </VerticalTabs>

                    <FilterSidePanelCategory key="state" title={t('Connections.STATUS')}>
                      {[...counts.byState.entries()].map(([state, count]) => (
                        <FilterSidePanelCategoryItem
                          key={state}
                          count={count}
                          checked={states.has(state)}
                          onClick={() => toggle(states, setStates, state)}
                        >
                          {t(`Connections.STATE_${state}` as 'Connections.STATE_UP')}
                        </FilterSidePanelCategoryItem>
                      ))}
                    </FilterSidePanelCategory>

                    {(serverGroups.data ?? []).length > 0 && (
                      <FilterSidePanelCategory
                        key="server-group"
                        title={t('Connections.SERVER_GROUP')}
                      >
                        {/* A tree, because server groups are one. The flat list this replaced
                            marked depth with chevrons, which said the right thing and looked
                            like a mistake; and an installation whose groups nest four deep is
                            exactly the one where a filter panel has no room to spell out a
                            path. A tree folds, so a hundred groups take as much space as the
                            reader wants them to. */}
                        <TreeView
                          data={groupTree}
                          hasCheckboxes
                          hasBadges
                          hasGuides
                          aria-label={t('Connections.SERVER_GROUP')}
                          onCheck={(_event, item) => toggle(groups, setGroups, String(item.id))}
                        />
                      </FilterSidePanelCategory>
                    )}

                    <FilterSidePanelCategory key="flavor" title={t('Connections.SERVER')}>
                      {[...counts.byFlavor.entries()].map(([flavor, count]) => (
                        <FilterSidePanelCategoryItem
                          key={flavor}
                          count={count}
                          checked={flavors.has(flavor)}
                          onClick={() => toggle(flavors, setFlavors, flavor)}
                        >
                          {flavor === 'unknown'
                            ? t('Connections.NOT_DETECTED')
                            : serverName(flavor)}
                        </FilterSidePanelCategoryItem>
                      ))}
                    </FilterSidePanelCategory>
                  </FilterSidePanel>
                </SidebarPanel>

                <SidebarContent hasNoBackground>
                  <Stack hasGutter>
                    <StackItem>
                      <Gallery hasGutter minWidths={{ default: '22rem' }}>
                        {paged.map((profile) => (
                          <ConnectionTile
                            key={profile.id}
                            profile={profile}
                            isTesting={test.isPending && test.variables === profile.id}
                            onEdit={openEdit}
                            onDelete={setDeleting}
                            onTest={(target) => test.mutate(target.id)}
                          />
                        ))}
                      </Gallery>
                    </StackItem>
                    {shown.length === 0 ? (
                      <StackItem>
                        <EmptyState
                          titleText={t('Connections.NO_MATCH')}
                          headingLevel="h2"
                          variant="sm"
                        >
                          <EmptyStateBody>{t('Connections.NO_MATCH_BODY')}</EmptyStateBody>
                          <EmptyStateFooter>
                            <EmptyStateActions>
                              <Button variant="link" onClick={clearFilters}>
                                {t('KeyBrowser.CLEAR_FILTERS')}
                              </Button>
                            </EmptyStateActions>
                          </EmptyStateFooter>
                        </EmptyState>
                      </StackItem>
                    ) : null}
                  </Stack>
                </SidebarContent>
              </Sidebar>
            </StackItem>
          </Stack>
        )}
      </PageSection>

      {/* Mounted only while open so the form resets naturally between uses. */}
      {formOpen ? (
        <ConnectionFormModal
          profile={editing}
          error={activeMutation.error?.message}
          isSubmitting={activeMutation.isPending}
          onSubmit={submit}
          onCancel={() => setFormOpen(false)}
          serverGroups={chosenGroups}
          onServerGroupsChange={setChosenGroups}
        />
      ) : null}

      <ConfirmDialog
        isOpen={deleting !== undefined}
        title={t('Connections.DELETE_TITLE')}
        confirmLabel={t('Connections.DELETE')}
        isDestructive
        isBusy={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(undefined)}
      >
        {t('Connections.DELETE_BODY', { name: deleting?.name ?? '' })}
      </ConfirmDialog>
    </>
  );
};
