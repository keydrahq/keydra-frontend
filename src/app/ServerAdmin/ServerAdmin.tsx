import type { FC } from 'react';
import { useContext, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  ClipboardCopy,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Grid,
  GridItem,
  Label,
  PageSection,
  SearchInput,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { SaveIcon } from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { EditableText } from '@app/KeyBrowser/editors/EditableText';
import { formatCount, formatDuration } from '@app/Monitoring/format';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { useNotifications } from '@app/Shared/Components/notificationStore';
import { ServiceContext } from '@app/Shared/Services/Services';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import type { PersistenceState, ServerSetting } from './types';

/**
 * How a target is configured, and how it keeps its data.
 *
 * <p>Reading is the common case and writing is not: a setting changed badly can evict keys nobody
 * asked to expire. So a value is edited in place rather than through a form — the same affordance a
 * hash field has — and each change is one setting rather than a page somebody submits.
 *
 * <p>The change takes effect at once and is forgotten on restart, which the page says plainly.
 * Making it permanent is a separate button, because a configuration file rewritten badly is a
 * server that will not start.
 */
const SETTINGS = `
  query ServerSettings($connectionId: BigInteger) {
    serverSettings(connectionId: $connectionId) {
      name
      value
      unset
    }
  }
`;

const PERSISTENCE = `
  query Persistence($connectionId: BigInteger) {
    persistence(connectionId: $connectionId) {
      snapshotEnabled
      snapshotFile
      lastSaveSeconds
      changesSinceSave
      lastSaveFailed
      logEnabled
      inProgress
    }
  }
`;

const CHANGE = `
  mutation ChangeServerSetting($connectionId: BigInteger, $change: SettingChangeInput) {
    changeServerSetting(connectionId: $connectionId, change: $change)
  }
`;

const SNAPSHOT = `
  mutation TakeSnapshot($connectionId: BigInteger) {
    takeSnapshot(connectionId: $connectionId)
  }
`;

const REWRITE = `
  mutation RewriteAppendLog($connectionId: BigInteger) {
    rewriteAppendLog(connectionId: $connectionId)
  }
`;

const PERSIST_SETTINGS = `
  mutation PersistServerSettings($connectionId: BigInteger) {
    persistServerSettings(connectionId: $connectionId)
  }
`;

export const ServerAdmin: FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('ServerAdmin.TITLE'));

  const { connectionId: idParam } = useParams();
  const connectionId = Number(idParam);
  const { graphql } = useContext(ServiceContext);
  const { notify } = useNotifications();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');

  const settings = useQuery({
    queryKey: ['admin', connectionId, 'settings'],
    queryFn: () =>
      graphql
        .query<{ serverSettings: ServerSetting[] }>(SETTINGS, { connectionId })
        .then((answer) => answer.serverSettings),
  });

  const persistence = useQuery({
    queryKey: ['admin', connectionId, 'persistence'],
    queryFn: () =>
      graphql
        .query<{ persistence: PersistenceState }>(PERSISTENCE, { connectionId })
        .then((answer) => answer.persistence),
    // The one thing here that still asks on a clock, and it is the right one to: what this reads
    // is the target server's own save state, which changes because that server decided to save.
    // Keydra is not involved and has nothing to broadcast about it. Only while the page is open.
    refetchInterval: 10_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', connectionId] });

  const change = useMutation({
    mutationFn: (setting: { name: string; value: string }) =>
      graphql
        .query<{ changeServerSetting: boolean }>(CHANGE, { connectionId, change: setting })
        .then((answer) => answer.changeServerSetting),
    onSuccess: (_result, setting) => {
      notify({ title: t('ServerAdmin.CHANGED', { name: setting.name }), variant: 'success' });
      void invalidate();
    },
    onError: (failure: Error) =>
      notify({ title: t('ServerAdmin.REFUSED'), description: failure.message, variant: 'danger' }),
  });

  /**
   * The three things that ask the server to do something with its own files.
   *
   * <p>Named rather than assembled from a path, which is what this used to send. A caller that
   * builds a URL fragment can build one nobody wrote; a caller that names an operation cannot.
   */
  const act = useMutation({
    mutationFn: (what: 'snapshot' | 'rewrite' | 'persist') =>
      graphql
        .query<Record<string, boolean>>(
          what === 'snapshot' ? SNAPSHOT : what === 'rewrite' ? REWRITE : PERSIST_SETTINGS,
          { connectionId },
        )
        .then((answer) => Object.values(answer)[0]),
    onSuccess: () => {
      notify({ title: t('ServerAdmin.ASKED'), variant: 'success' });
      void invalidate();
    },
    onError: (failure: Error) =>
      notify({ title: t('ServerAdmin.REFUSED'), description: failure.message, variant: 'danger' }),
  });

  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const all = settings.data ?? [];
    return needle ? all.filter((setting) => setting.name.includes(needle)) : all;
  }, [filter, settings.data]);

  if (settings.isPending) {
    return <LoadingView />;
  }
  if (settings.isError) {
    return (
      <PageSection>
        <ErrorView title={t('ServerAdmin.LOAD_ERROR')} message={settings.error.message} />
      </PageSection>
    );
  }

  const state = persistence.data;
  // Measured from when the answer arrived rather than from now. Reading the clock during a
  // render makes the same render produce a different number each time it happens, and the
  // difference is meaningless anyway: the server reported its last save as of that moment.
  const sinceSave = state
    ? Math.max(0, persistence.dataUpdatedAt / 1000 - state.lastSaveSeconds)
    : 0;

  return (
    <PageSection hasBodyWrapper={false} isFilled className="keydra-browser">
      <div className="keydra-monitoring">
        <Grid hasGutter>
          <GridItem lg={4}>
            <Card isCompact isFullHeight>
              <CardTitle>{t('ServerAdmin.PERSISTENCE')}</CardTitle>
              <CardBody>
                {state?.lastSaveFailed ? (
                  // The one thing on this page that is an emergency: a server that cannot
                  // write is one restart away from losing everything since it last could.
                  <Alert
                    variant="danger"
                    isInline
                    component="h3"
                    title={t('ServerAdmin.SAVE_FAILED')}
                  />
                ) : null}
                <DescriptionList isHorizontal isCompact>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('ServerAdmin.SNAPSHOT')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <Label isCompact color={state?.snapshotEnabled ? 'green' : 'grey'}>
                        {state?.snapshotEnabled ? t('ServerAdmin.ON') : t('ServerAdmin.OFF')}
                      </Label>
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('ServerAdmin.LOG')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <Label isCompact color={state?.logEnabled ? 'green' : 'grey'}>
                        {state?.logEnabled ? t('ServerAdmin.ON') : t('ServerAdmin.OFF')}
                      </Label>
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('ServerAdmin.LAST_SAVE')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      {state ? t('ServerAdmin.AGO', { ago: formatDuration(sinceSave) }) : '—'}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('ServerAdmin.SNAPSHOT_FILE')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      {/* The question everybody asks straight after pressing the button.
                          The path is the server's own, so it says so: a snapshot is the
                          server writing its memory to its disk, and that disk is inside
                          the container the server runs in rather than anywhere Keydra
                          could hand somebody a file from. */}
                      {state?.snapshotFile ? (
                        <>
                          <ClipboardCopy
                            variant="inline-compact"
                            isCode
                            hoverTip={t('ServerAdmin.COPY')}
                            clickTip={t('ServerAdmin.COPIED')}
                          >
                            {state.snapshotFile}
                          </ClipboardCopy>
                          <Content component="small" className="pf-v6-u-text-color-subtle">
                            {t('ServerAdmin.SNAPSHOT_FILE_HELP')}
                          </Content>
                        </>
                      ) : (
                        '—'
                      )}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('ServerAdmin.UNSAVED')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      {/* Writes since the last snapshot: what would be lost if the server
                          stopped now, which is the number the buttons below are for. */}
                      {formatCount(state?.changesSinceSave ?? 0)}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>

                <Toolbar id="persistence-actions" inset={{ default: 'insetNone' }}>
                  <ToolbarContent>
                    <ToolbarItem>
                      <Button
                        variant="secondary"
                        icon={<SaveIcon />}
                        isDisabled={act.isPending || state?.inProgress}
                        onClick={() => act.mutate('snapshot')}
                      >
                        {t('ServerAdmin.SNAPSHOT_NOW')}
                      </Button>
                    </ToolbarItem>
                    <ToolbarItem>
                      <Button
                        variant="link"
                        isDisabled={act.isPending || state?.inProgress || !state?.logEnabled}
                        onClick={() => act.mutate('rewrite')}
                      >
                        {t('ServerAdmin.REWRITE_LOG')}
                      </Button>
                    </ToolbarItem>
                  </ToolbarContent>
                </Toolbar>
                {state?.inProgress ? (
                  <Alert
                    variant="info"
                    isInline
                    isPlain
                    component="h3"
                    title={t('ServerAdmin.RUNNING')}
                  />
                ) : null}
              </CardBody>
            </Card>
          </GridItem>

          <GridItem lg={8}>
            <Card isCompact isFullHeight>
              <CardTitle>{t('ServerAdmin.SETTINGS')}</CardTitle>
              <CardBody>
                <Alert
                  variant="info"
                  isInline
                  isPlain
                  component="h3"
                  title={t('ServerAdmin.RUNTIME_ONLY')}
                />
                <Toolbar id="settings-toolbar" inset={{ default: 'insetNone' }}>
                  <ToolbarContent>
                    <ToolbarItem>
                      <SearchInput
                        aria-label={t('ServerAdmin.FILTER')}
                        placeholder={t('ServerAdmin.FILTER')}
                        value={filter}
                        onChange={(_event, value) => setFilter(value)}
                        onClear={() => setFilter('')}
                      />
                    </ToolbarItem>
                    <ToolbarItem>
                      <Button
                        variant="link"
                        isDisabled={act.isPending}
                        onClick={() => act.mutate('persist')}
                      >
                        {t('ServerAdmin.PERSIST')}
                      </Button>
                    </ToolbarItem>
                    <ToolbarItem
                      align={{ default: 'alignEnd' }}
                      className="pf-v6-u-text-color-subtle"
                    >
                      {t('ServerAdmin.COUNT', { count: shown.length })}
                    </ToolbarItem>
                  </ToolbarContent>
                </Toolbar>

                <Table aria-label={t('ServerAdmin.SETTINGS')} variant="compact">
                  <Thead>
                    <Tr>
                      <Th width={40}>{t('ServerAdmin.NAME')}</Th>
                      <Th>{t('ServerAdmin.VALUE')}</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {shown.map((setting) => (
                      <Tr key={setting.name}>
                        <Td
                          dataLabel={t('ServerAdmin.NAME')}
                          className="pf-v6-u-font-family-monospace"
                        >
                          {setting.name}
                        </Td>
                        <Td dataLabel={t('ServerAdmin.VALUE')}>
                          {setting.isUnset ? (
                            <span className="pf-v6-u-text-color-subtle">
                              {t('ServerAdmin.UNSET')}{' '}
                            </span>
                          ) : null}
                          <EditableText
                            value={{
                              text: setting.value,
                              encoding: 'plain',
                              size: setting.value.length,
                              truncated: false,
                            }}
                            label={setting.name}
                            isDisabled={change.isPending}
                            onSave={(next) => change.mutate({ name: setting.name, value: next })}
                          />
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>
      </div>
    </PageSection>
  );
};
