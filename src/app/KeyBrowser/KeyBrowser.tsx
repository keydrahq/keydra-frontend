import type { FC } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import {
  Button,
  ButtonVariant,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Drawer,
  DrawerContent,
  DrawerContentBody,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  PageSection,
  Sidebar,
  SidebarContent,
  SidebarPanel,
} from '@patternfly/react-core';
import { DatabaseIcon, SearchIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';
import { ConfirmDialog } from '@app/Shared/Components/ConfirmDialog';
import { useRecordedNotice } from '@app/Approvals/recorded';
import { useSupports } from '@app/Connections/capabilities';
import { Feature } from '@app/Topology/types';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import { ExpireKeyModal } from './ExpireKeyModal';
import { KeyDetailPanel } from './KeyDetailPanel';
import { KeyTable } from './KeyTable';
import { KeyToolbar } from './KeyToolbar';
import { DatabaseSelect } from './DatabaseSelect';
import { NamespaceTree } from './NamespaceTree';
import { KeyDestinationModal } from './KeyDestinationModal';
import {
  useCopyKey,
  useDatabases,
  useDeleteKeys,
  usePurgeKeys,
  useExpireKey,
  useExportKeys,
  useImportKeys,
  useRenameKey,
  keysQueryKey,
} from './queries';
import { exportFilename, saveAsFile } from './download';
import { CreateKeyModal } from './CreateKeyModal';
import { ImportKeysModal } from './ImportKeysModal';
import { MigrateKeysModal } from './MigrateKeysModal';
import WarningModal from '@patternfly/react-component-groups/dist/dynamic/WarningModal';
import { useConnection } from '@app/Connections/queries';
import { useNotifications } from '@app/Shared/Components/notificationStore';
import type { ExportedKey, KeyEntry } from './types';
import type { ValueMutation } from './valueTypes';
import { useMutateValue } from './valueQueries';
import { useKeyStream } from './useKeyStream';
import { KeyspaceWatchBanner } from './KeyspaceWatchBanner';
import { useRestartOnKeyspaceChange } from './useKeyspaceWatch';
import { usePurgeProgress } from './usePurgeProgress';

/**
 * Browses one connection's keyspace.
 *
 * <p>Three regions share the width: the namespace tree narrows the scan by prefix, the table shows
 * what the stream has produced so far, and the drawer holds the value of whichever key is open.
 * All three are driven by the same filters, so selecting a namespace restarts the scan rather than
 * filtering an already-loaded list — the list is never complete enough to filter client-side.
 *
 * <p>Opening a value collapses the tree. Three columns in the space of two leaves the key names —
 * the one thing every row is here for — too narrow to read, and the tree is one click away.
 */
export const KeyBrowser: FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('KeyBrowser.TITLE'));

  const { connectionId: idParam } = useParams();
  const connectionId = Number(idParam);

  /*
   * In the URL rather than in state: a keyspace someone is looking at is a place, so a link
   * to db 3 of a target should be a link somebody can send — and going back should go back
   * to the database they were in rather than to the one the profile opens in.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const dbParam = searchParams.get('db');
  const database = dbParam === null ? undefined : Number(dbParam);
  const databases = useDatabases(connectionId);

  const [prefix, setPrefix] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const [opened, setOpened] = useState<KeyEntry | undefined>();
  const [isTreePinned, setTreePinned] = useState(false);
  const [renaming, setRenaming] = useState<KeyEntry | undefined>();
  const [copying, setCopying] = useState<KeyEntry | undefined>();
  const [expiring, setExpiring] = useState<KeyEntry | undefined>();
  const [deleting, setDeleting] = useState<string[] | undefined>();
  /** A namespace about to be cleared; an empty prefix means the whole target. */
  /*
   * What a purge is about to remove, and whether that number is a total or a floor.
   *
   * <p>Both sources of it are floors, as it happens: the tree counts from a sample of the keyspace,
   * and "everything" is offered from the page of keys this browser has loaded. Only the namespace
   * dialog shows the number, but it is carried honestly from both so that stays true if the other
   * one ever does.
   */
  const [purging, setPurging] = useState<
    { prefix: string; keyCount: number; partial: boolean } | undefined
  >();
  const [isMigrating, setMigrating] = useState(false);
  const [isCreating, setCreating] = useState(false);
  const [isImporting, setImporting] = useState(false);

  const isTreeVisible = opened === undefined || isTreePinned;
  /** Whether anything is narrowing the list, which is what tells the two empty states apart. */
  const isFiltered = search !== '' || type !== '' || prefix !== '';

  const profile = useConnection(connectionId);
  const queryClient = useQueryClient();
  const supports = useSupports(connectionId);
  const { notify } = useNotifications();

  // The tree narrows by prefix and the search box adds a glob; combining them here
  // means the server does the filtering, not the browser.
  const match = useMemo(() => {
    if (search && prefix) {
      return `${prefix}${search}`;
    }
    if (search) {
      return search;
    }
    return prefix ? `${prefix}*` : '';
  }, [prefix, search]);

  const { keys, isStreaming, isTruncated, canLoadMore, loadMore, restart } = useKeyStream(
    connectionId,
    { match, type, database },
  );

  /*
   * Which database this actually is, rather than which one was asked for. Absent means the one the
   * profile opens in, which is not necessarily db0 — and a watch on the wrong database is a watch
   * that hears nothing while the page it belongs to looks like it is keeping up.
   */
  const watchedDatabase = database ?? profile?.database ?? 0;

  /*
   * What goes stale when somebody else writes to this target: the list, which is a stream and has
   * to be walked again, and everything cached under this keyspace — the namespace tree and its
   * counts, which are queries. Both, because they are two views of the one thing that changed.
   */
  const onKeyspaceChange = useCallback(() => {
    restart();
    void queryClient.invalidateQueries({ queryKey: keysQueryKey(connectionId, database) });
  }, [restart, queryClient, connectionId, database]);
  /*
   * The key the drawer has open travels with the lease. A batch's sample is bounded at twenty
   * names, so a viewer whose key is not in it cannot tell that its key did *not* change — and
   * re-reading a value every couple of seconds to find out would be heavier than the polling this
   * replaced, on the page where the values are largest.
   */
  const openedKeys = useMemo(() => (opened ? [opened.key] : []), [opened]);

  useRestartOnKeyspaceChange(
    connectionId,
    watchedDatabase,
    prefix,
    // A search replaces the prefix in the query the server is given; a type filter narrows what the
    // prefix already chose. So only the first makes the prefix useless for ruling a change out.
    search !== '',
    onKeyspaceChange,
  );

  const remove = useDeleteKeys(connectionId, database);
  const purge = usePurgeKeys(connectionId, database);
  /*
   * A target that asks for two people answers these the same way it answers everything else —
   * with a refusal that is not one. Handled once, here, because the alternative is four dialogs
   * each deciding for itself whether the guard doing its work counts as an error.
   */
  const wasRecorded = useRecordedNotice();
  const purged = usePurgeProgress(connectionId, purge.isPending);

  /**
   * Whether this purge asks for the target's name.
   *
   * <p>Two reasons, and either is enough: the whole target is going, which has always asked; or the
   * target is one that asks to be named before anything empties it, which a namespace purge on a
   * guarded server is.
   */
  const namesItself = purging !== undefined && (!purging.prefix || Boolean(profile?.guarded));

  const confirmPurge = () => {
    if (!purging) {
      return;
    }
    purge.mutate(
      { match: `${purging.prefix}*`, confirmTarget: namesItself ? profile?.name : undefined },
      {
        onError: (error) => {
          if (!wasRecorded(error, () => setPurging(undefined))) {
            notify({
              title: t('KeyBrowser.PURGE_FAILED'),
              description: error.message,
              variant: 'danger',
            });
          }
        },
        onSuccess: (result) => {
          setPurging(undefined);
          setSelected(new Set());
          notify({
            title: t('KeyBrowser.PURGE_DONE', { count: result.affected }),
            variant: 'success',
          });
          restart();
        },
      },
    );
  };
  const exportKeys = useExportKeys(connectionId, database);
  const importKeys = useImportKeys(connectionId, database);
  const rename = useRenameKey(connectionId, database);
  const copy = useCopyKey(connectionId, database);
  const expire = useExpireKey(connectionId, database);
  const mutate = useMutateValue(connectionId);

  /**
   * Writes a new key's first value, and its expiry when one was asked for.
   *
   * <p>Two calls rather than one: there is no command that creates a key with a TTL for every
   * type, and inventing one in the API would mean every store's engine having to implement it.
   * The expiry follows the write, and a key that was created but not given its TTL says so rather
   * than looking as though nothing happened.
   */
  const createKey = useCallback(
    (mutation: ValueMutation, ttlSeconds: number | null) => {
      mutate.mutate(mutation, {
        onSuccess: () => {
          const done = () => {
            setCreating(false);
            notify({ title: t('CreateKey.CREATED', { name: mutation.key }), variant: 'success' });
            restart();
          };
          if (ttlSeconds === null) {
            done();
            return;
          }
          expire.mutate(
            { key: mutation.key, ttlSeconds },
            {
              onSuccess: done,
              onError: (error) =>
                notify({
                  title: t('KeyBrowser.TTL_FAILED'),
                  description: error.message,
                  variant: 'warning',
                }),
            },
          );
        },
      });
    },
    [expire, mutate, notify, restart, t],
  );

  /**
   * Exports the ticked keys, or everything the current filter matches when none are ticked.
   *
   * <p>The second case sends the glob rather than the key names the browser happens to have
   * loaded: the list on screen is the first page of a scan, and exporting only what has been
   * scrolled to would quietly produce a partial backup.
   */
  const onExport = useCallback(() => {
    const request = selected.size > 0 ? { keys: [...selected] } : { match: match || '*' };
    exportKeys.mutate(request, {
      onSuccess: (keysExported) => {
        saveAsFile(
          exportFilename(profile?.name ?? String(connectionId), new Date()),
          JSON.stringify(keysExported, null, 2),
        );
        notify({
          title: t('KeyBrowser.EXPORTED', { count: keysExported.length }),
          variant: 'success',
        });
      },
      onError: (error) =>
        notify({
          title: t('KeyBrowser.EXPORT_FAILED'),
          description: error.message,
          variant: 'danger',
        }),
    });
  }, [connectionId, exportKeys, match, notify, profile?.name, selected, t]);

  /** Writes back a file the dialog has already read and checked. */
  const restoreKeys = useCallback(
    (keysToRestore: ExportedKey[], replace: boolean, confirmTarget?: string) => {
      importKeys.mutate(
        { keys: keysToRestore, replace, confirmTarget },
        {
          onError: (error) => {
            if (!wasRecorded(error, () => setImporting(false))) {
              notify({
                title: t('KeyBrowser.IMPORT_FAILED'),
                description: error.message,
                variant: 'danger',
              });
            }
          },
          onSuccess: (result) => {
            setImporting(false);
            notify({
              title: t('KeyBrowser.IMPORTED', { count: result.restored }),
              // The store's own words when it refused: a file taken from a newer server
              // restores nowhere, and a bare count does not say that.
              description: [
                t('KeyBrowser.IMPORT_DETAIL', {
                  skipped: result.skipped,
                  failed: result.failed,
                }),
                result.reason,
              ]
                .filter(Boolean)
                .join(' '),
              variant: result.skipped + result.failed > 0 ? 'warning' : 'success',
            });
            restart();
          },
        },
      );
    },
    [importKeys, notify, restart, t, wasRecorded],
  );

  const toggle = useCallback((key: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((current) =>
      current.size === keys.length ? new Set() : new Set(keys.map((entry) => entry.key)),
    );
  }, [keys]);

  /** After a mutation the scan is stale, so it is rerun rather than patched. */
  const afterMutation = useCallback(() => {
    setSelected(new Set());
    restart();
  }, [restart]);

  const confirmDelete = useCallback(
    (named?: string) => {
      if (deleting) {
        remove.mutate(
          { keys: deleting, confirmTarget: named },
          {
            onError: (error) => {
              if (!wasRecorded(error, () => setDeleting(undefined))) {
                notify({
                  title: t('KeyBrowser.DELETE_FAILED'),
                  description: error.message,
                  variant: 'danger',
                });
              }
            },
            onSuccess: () => {
              // The drawer would otherwise keep showing a key that no longer exists.
              if (opened && deleting.includes(opened.key)) {
                setOpened(undefined);
              }
              setDeleting(undefined);
              afterMutation();
            },
          },
        );
      }
    },
    [afterMutation, deleting, notify, opened, remove, t, wasRecorded],
  );

  if (!Number.isFinite(connectionId)) {
    return (
      <PageSection>
        <EmptyState titleText={t('KeyBrowser.LOAD_ERROR_TITLE')} headingLevel="h2">
          <EmptyStateBody>{t('KeyBrowser.LOAD_ERROR_BODY')}</EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  const list = (
    <Card isFullHeight className="keydra-browser__list">
      <CardHeader className="keydra-browser__list-header">
        <KeyToolbar
          databaseSelect={
            <DatabaseSelect
              databases={databases.data ?? []}
              selected={database}
              fallback={profile?.database ?? 0}
              onSelect={(next) => {
                // The whole view belongs to a keyspace, so moving is a fresh start: the
                // filters, the selection and the open key were all about the other one.
                setSearchParams({ db: String(next) });
                setPrefix('');
                setSearch('');
                setType('');
                setSelected(new Set());
                setOpened(undefined);
              }}
            />
          }
          isTreePinned={isTreePinned}
          canPinTree={opened !== undefined}
          onToggleTree={() => setTreePinned((pinned) => !pinned)}
          search={search}
          prefix={prefix}
          type={type}
          selectedCount={selected.size}
          keyCount={keys.length}
          isStreaming={isStreaming}
          isTruncated={isTruncated}
          canLoadMore={canLoadMore}
          onSearch={setSearch}
          onPrefix={(next) => {
            setPrefix(next);
            setSelected(new Set());
          }}
          onLoadMore={loadMore}
          onType={setType}
          onRefresh={restart}
          onDeleteSelected={() => setDeleting([...selected])}
          onCreate={() => setCreating(true)}
          onExport={onExport}
          onImport={() => setImporting(true)}
          onMigrate={() => setMigrating(true)}
          onPurgeAll={() => setPurging({ prefix: '', keyCount: keys.length, partial: true })}
          isTransferring={exportKeys.isPending || importKeys.isPending}
          canTransfer={supports(Feature.Transfer)}
        />
      </CardHeader>
      {/*
        Above the divider rather than inside the list: what it says is about the whole list, and a
        bar between the rows and their header would read as being about the rows.

        Mounting it is also what opens the watch — the hook inside holds a lease while this page is
        up — so it belongs on the page whether or not it draws anything.
      */}
      {/* The lease lives here, so what this page has open travels with it — one watch and one
          renewal rather than two hooks on one query key disagreeing about what to ask for. */}
      <KeyspaceWatchBanner
        connectionId={connectionId}
        database={watchedDatabase}
        watching={openedKeys}
      />
      <Divider />
      {/* PatternFly's own zero-padding utility: the table draws its own header row
          and its columns are meant to reach the card's edges. */}
      <CardBody className="keydra-browser__list-body pf-v6-u-p-0">
        {keys.length === 0 && isStreaming ? (
          <LoadingView />
        ) : keys.length === 0 ? (
          /*
           * "Nothing here" and "nothing matches" are different states and PatternFly asks
           * for them to be told apart: one is a target waiting to be filled, and the answer
           * is to write a key; the other is a filter that is too narrow, and the answer is
           * to widen it. Offering "clear the filters" to somebody who set none reads as a
           * fault in the application.
           */
          isFiltered ? (
            <EmptyState titleText={t('KeyBrowser.EMPTY_TITLE')} icon={SearchIcon} headingLevel="h2">
              <EmptyStateBody>{t('KeyBrowser.EMPTY_BODY')}</EmptyStateBody>
              <EmptyStateFooter>
                <EmptyStateActions>
                  <Button
                    variant="link"
                    onClick={() => {
                      setSearch('');
                      setType('');
                      setPrefix('');
                      setSelected(new Set());
                    }}
                  >
                    {t('KeyBrowser.CLEAR_FILTERS')}
                  </Button>
                </EmptyStateActions>
              </EmptyStateFooter>
            </EmptyState>
          ) : (
            <EmptyState
              titleText={t('KeyBrowser.EMPTY_TARGET_TITLE')}
              icon={DatabaseIcon}
              headingLevel="h2"
            >
              <EmptyStateBody>{t('KeyBrowser.EMPTY_TARGET_BODY')}</EmptyStateBody>
              <EmptyStateFooter>
                <EmptyStateActions>
                  <Button variant="primary" onClick={() => setCreating(true)}>
                    {t('CreateKey.ADD')}
                  </Button>
                </EmptyStateActions>
              </EmptyStateFooter>
            </EmptyState>
          )
        ) : (
          <KeyTable
            connectionId={connectionId}
            keys={keys}
            selected={selected}
            activeKey={opened?.key}
            onToggle={toggle}
            onSelect={setOpened}
            onToggleAll={toggleAll}
            onRename={setRenaming}
            onDuplicate={setCopying}
            onSetTtl={setExpiring}
            onDelete={(entry) => setDeleting([entry.key])}
          />
        )}
      </CardBody>
    </Card>
  );

  return (
    <>
      {isCreating ? (
        <CreateKeyModal
          prefix={prefix}
          isBusy={mutate.isPending || expire.isPending}
          error={mutate.error?.message}
          onCreate={createKey}
          onCancel={() => setCreating(false)}
        />
      ) : null}

      {/* Mounted only while open, so a finished job is forgotten when the dialog closes
          rather than reappearing the next time it is used. */}
      {isMigrating ? (
        <MigrateKeysModal
          connectionId={connectionId}
          match={match}
          selectedKeys={[...selected]}
          onClose={() => setMigrating(false)}
        />
      ) : null}

      {purging ? (
        /*
         * PatternFly's warning modal rather than the ordinary confirmation: this is the one
         * action in the browser that cannot be undone at any scale, and the whole-target
         * case asks for the name to be typed rather than for a second click, because a
         * click is exactly what someone does when they did not mean to.
         */
        <WarningModal
          isOpen
          variant="medium"
          withCheckbox={false}
          titleIconVariant="warning"
          title={
            purging.prefix
              ? t('KeyBrowser.PURGE_NAMESPACE_TITLE', { prefix: purging.prefix })
              : t('KeyBrowser.PURGE_ALL_TITLE')
          }
          confirmButtonLabel={t('KeyBrowser.PURGE_CONFIRM')}
          cancelButtonLabel={t('KeyBrowser.PURGE_CANCEL')}
          confirmButtonVariant={ButtonVariant.danger}
          /*
            The name is asked for whenever the whole target is going, and now also whenever the
            target itself asks to be named — which is the case a namespace purge falls into on a
            guarded server. The dialog was already doing half of this and keeping the answer:
            what somebody typed never left the browser, so the API had never been told.
          */
          confirmationText={namesItself ? profile?.name : undefined}
          confirmationInputLabel={namesItself ? profile?.name : undefined}
          onConfirm={confirmPurge}
          onClose={() => (purge.isPending ? undefined : setPurging(undefined))}
        >
          {/* While it runs the dialog stays and counts, rather than closing on a click and
              leaving the browser to guess. A purge walks the keyspace and deletes as it goes,
              which on a large target is a minute with nothing to look at. */}
          {purge.isPending
            ? t('KeyBrowser.PURGE_RUNNING', { count: purged })
            : purging.prefix
              ? /* The tree's count is a floor when its walk stopped at a sample limit, and this
                   is the one place that mattered most: a confirmation for something irreversible
                   was stating a number as fact that the tree had only sampled. */
                t(
                  purging.partial
                    ? 'KeyBrowser.PURGE_NAMESPACE_BODY_PARTIAL'
                    : 'KeyBrowser.PURGE_NAMESPACE_BODY',
                  { count: purging.keyCount },
                )
              : t('KeyBrowser.PURGE_ALL_BODY')}
        </WarningModal>
      ) : null}

      {isImporting ? (
        <ImportKeysModal
          isBusy={importKeys.isPending}
          error={importKeys.error?.message}
          nameToType={profile?.guarded ? profile.name : undefined}
          onImport={restoreKeys}
          onCancel={() => setImporting(false)}
        />
      ) : null}

      <PageSection className="keydra-browser" isFilled>
        <Drawer isExpanded={opened !== undefined} isInline position="end">
          <DrawerContent
            panelContent={
              opened ? (
                <KeyDetailPanel
                  connectionId={connectionId}
                  database={watchedDatabase}
                  entry={opened}
                  onClose={() => setOpened(undefined)}
                  onRename={setRenaming}
                  onDuplicate={setCopying}
                  onSetTtl={setExpiring}
                  onDelete={(entry) => setDeleting([entry.key])}
                />
              ) : null
            }
          >
            <DrawerContentBody className="keydra-browser__body">
              {isTreeVisible ? (
                <Sidebar hasGutter className="keydra-browser__split">
                  <SidebarPanel
                    variant="sticky"
                    width={{ default: 'width_25' }}
                    className="keydra-browser__tree"
                  >
                    <Card isFullHeight className="keydra-browser__tree-card">
                      <CardBody className="keydra-browser__tree-body">
                        <NamespaceTree
                          connectionId={connectionId}
                          database={database}
                          selectedPrefix={prefix}
                          onSelect={(next) => {
                            setPrefix(next);
                            setSelected(new Set());
                          }}
                          onPurge={(namespace, keyCount, partial) =>
                            setPurging({ prefix: namespace, keyCount, partial })
                          }
                        />
                      </CardBody>
                    </Card>
                  </SidebarPanel>
                  <SidebarContent className="keydra-browser__content">{list}</SidebarContent>
                </Sidebar>
              ) : (
                list
              )}
            </DrawerContentBody>
          </DrawerContent>
        </Drawer>
      </PageSection>

      {renaming ? (
        <KeyDestinationModal
          operation="rename"
          keyName={renaming.key}
          isBusy={rename.isPending}
          // RENAMENX answers 0 when the destination exists, which is a refusal, not an error.
          refused={rename.data?.affected === 0}
          onSubmit={(to, replace) =>
            rename.mutate(
              { from: renaming.key, to, replace },
              {
                onSuccess: (result) => {
                  if (result.affected > 0) {
                    // The open key is now under a different name.
                    if (opened?.key === renaming.key) {
                      setOpened({ ...opened, key: to });
                    }
                    setRenaming(undefined);
                    afterMutation();
                  }
                },
              },
            )
          }
          onCancel={() => {
            rename.reset();
            setRenaming(undefined);
          }}
        />
      ) : null}

      {copying ? (
        <KeyDestinationModal
          operation="copy"
          keyName={copying.key}
          isBusy={copy.isPending}
          // COPY answers 0 when the destination exists, which is a refusal, not an error.
          refused={copy.data?.affected === 0}
          onSubmit={(to, replace) =>
            copy.mutate(
              { from: copying.key, to, replace },
              {
                onSuccess: (result) => {
                  if (result.affected > 0) {
                    setCopying(undefined);
                    afterMutation();
                  }
                },
              },
            )
          }
          onCancel={() => {
            copy.reset();
            setCopying(undefined);
          }}
        />
      ) : null}

      {expiring ? (
        <ExpireKeyModal
          keyName={expiring.key}
          currentTtl={expiring.ttl}
          isBusy={expire.isPending}
          onSubmit={(ttlSeconds) =>
            expire.mutate(
              { key: expiring.key, ttlSeconds },
              {
                onSuccess: () => {
                  setExpiring(undefined);
                  afterMutation();
                },
              },
            )
          }
          onCancel={() => setExpiring(undefined)}
        />
      ) : null}

      <ConfirmDialog
        isOpen={deleting !== undefined}
        title={t('KeyBrowser.DELETE_TITLE')}
        confirmLabel={t('KeyBrowser.DELETE')}
        isDestructive
        isBusy={remove.isPending}
        nameToType={profile?.guarded ? profile.name : undefined}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(undefined)}
      >
        {deleting?.length === 1
          ? t('KeyBrowser.DELETE_BODY_ONE', { name: deleting[0] })
          : t('KeyBrowser.DELETE_BODY_MANY', { count: deleting?.length ?? 0 })}
      </ConfirmDialog>
    </>
  );
};
