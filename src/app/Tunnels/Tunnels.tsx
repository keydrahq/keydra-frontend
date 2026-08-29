import type { FC } from 'react';
import { useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  Label,
  PageSection,
  Spinner,
} from '@patternfly/react-core';
import { NetworkIcon, PlusCircleIcon } from '@patternfly/react-icons';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@app/Shared/Components/ConfirmDialog';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { PageHeader } from '@app/Shared/Components/PageHeader';
import { useNotifications } from '@app/Shared/Components/notificationStore';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import { TunnelDialog } from './TunnelDialog';
import { useCheckTunnel, useDeleteTunnel, useTunnels } from './queries';
import type { TunnelSummary } from './types';

/**
 * The jump hosts.
 *
 * <p>These were six fields on every connection profile, which was right for one target and wrong
 * for twenty behind the same jump host: twenty copies of one key, and rotating it meant editing
 * twenty profiles and missing one. It was also unreachable by anything else — a backup destination
 * behind the same jump host could not use the tunnel that already existed.
 *
 * <p>Every row can be tested, and testing answers the host key the jump host presented. A tunnel that
 * pins none is one anything answering on that address can impersonate, so the table says so and the
 * check makes pinning a click.
 */
export const Tunnels: FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('Tunnels.TITLE'));

  const tunnels = useTunnels();
  const remove = useDeleteTunnel();
  const check = useCheckTunnel();
  const { notify } = useNotifications();

  const [editing, setEditing] = useState<TunnelSummary | 'new' | undefined>();
  const [removing, setRemoving] = useState<TunnelSummary | undefined>();
  const [checking, setChecking] = useState<number | undefined>();
  /** A fingerprint a check just saw, carried into the form so pinning it is one click. */
  const [suggested, setSuggested] = useState<string | undefined>();

  const test = (tunnel: TunnelSummary) => {
    setChecking(tunnel.id);
    check.mutate(tunnel.id, {
      onSettled: () => setChecking(undefined),
      onSuccess: (result) => {
        notify({
          title: result.reachable
            ? t('Tunnels.CHECK_OK', { name: tunnel.name })
            : t('Tunnels.CHECK_FAILED', { name: tunnel.name }),
          description: result.fingerprint
            ? t('Tunnels.PRESENTED', { fingerprint: result.fingerprint })
            : (result.message ?? undefined),
          variant: result.reachable ? 'success' : 'danger',
        });
        // Worked, and pins nothing: open the form with the key it presented already in it.
        if (result.reachable && result.fingerprint && !tunnel.verifiesHostKey) {
          setSuggested(result.fingerprint);
          setEditing(tunnel);
        }
      },
      onError: (error) =>
        notify({
          title: t('Tunnels.CHECK_FAILED', { name: tunnel.name }),
          description: error.message,
          variant: 'danger',
        }),
    });
  };

  const close = () => {
    setEditing(undefined);
    setSuggested(undefined);
  };

  if (tunnels.isPending) {
    return <LoadingView />;
  }
  if (tunnels.isError) {
    return (
      <PageSection>
        <ErrorView title={t('Tunnels.LOAD_ERROR')} message={tunnels.error.message} />
      </PageSection>
    );
  }

  const unpinned = tunnels.data.filter((tunnel) => !tunnel.verifiesHostKey).length;

  return (
    <>
      <PageHeader
        title={t('Tunnels.TITLE')}
        description={
          tunnels.data.length === 0
            ? t('Tunnels.DESCRIPTION')
            : t('Tunnels.SUMMARY', { count: tunnels.data.length })
        }
        badges={
          unpinned > 0 ? (
            <Label isCompact color="orange">
              {t('Tunnels.UNPINNED', { count: unpinned })}
            </Label>
          ) : null
        }
        actions={
          tunnels.data.length > 0 ? (
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => setEditing('new')}>
              {t('Tunnels.ADD')}
            </Button>
          ) : null
        }
      />

      <PageSection isFilled>
        <Card isCompact>
          <CardBody>
            {tunnels.data.length === 0 ? (
              <EmptyState titleText={t('Tunnels.EMPTY_TITLE')} icon={NetworkIcon} headingLevel="h2">
                <EmptyStateBody>{t('Tunnels.EMPTY_BODY')}</EmptyStateBody>
                <EmptyStateFooter>
                  <EmptyStateActions>
                    <Button
                      variant="primary"
                      icon={<PlusCircleIcon />}
                      onClick={() => setEditing('new')}
                    >
                      {t('Tunnels.ADD')}
                    </Button>
                  </EmptyStateActions>
                </EmptyStateFooter>
              </EmptyState>
            ) : (
              <Table aria-label={t('Tunnels.TITLE')} variant="compact">
                <Thead>
                  <Tr>
                    <Th width={20}>{t('Tunnels.NAME')}</Th>
                    <Th width={30}>{t('Tunnels.WHERE')}</Th>
                    <Th width={20}>{t('Tunnels.HOST_KEY')}</Th>
                    <Th width={20}>{t('Tunnels.USED_BY')}</Th>
                    <Th screenReaderText={t('Tunnels.ACTIONS')} />
                  </Tr>
                </Thead>
                <Tbody>
                  {tunnels.data.map((tunnel) => (
                    <Tr key={tunnel.id}>
                      <Td dataLabel={t('Tunnels.NAME')}>{tunnel.name}</Td>
                      <Td dataLabel={t('Tunnels.WHERE')}>
                        <code>{tunnel.describedAs}</code>
                        {tunnel.hasPrivateKey && (
                          <Label isCompact variant="outline">
                            {t('Tunnels.BY_KEY')}
                          </Label>
                        )}
                      </Td>
                      <Td dataLabel={t('Tunnels.HOST_KEY')}>
                        {/* While a check is running this column says so instead of saying what
                            the key is, because what the key is is the thing being found out.
                            A test opens an SSH connection and can take several seconds; a row
                            that showed nothing for that long read as an action that did not
                            happen, which is how this was reported. */}
                        {checking === tunnel.id ? (
                          <Label isCompact icon={<Spinner size="sm" />}>
                            {t('Tunnels.CHECKING')}
                          </Label>
                        ) : tunnel.verifiesHostKey ? (
                          <Label isCompact color="green">
                            {t('Tunnels.PINNED')}
                          </Label>
                        ) : (
                          <Label isCompact color="orange">
                            {t('Tunnels.ANY_KEY')}
                          </Label>
                        )}
                      </Td>
                      <Td dataLabel={t('Tunnels.USED_BY')}>
                        {tunnel.usedBy === 0
                          ? t('Tunnels.NOTHING')
                          : t('Tunnels.THINGS', { count: tunnel.usedBy })}
                      </Td>
                      <Td isActionCell>
                        <ActionsColumn
                          items={[
                            {
                              title: t('Tunnels.CHECK'),
                              isDisabled: check.isPending,
                              onClick: () => test(tunnel),
                            },
                            { isSeparator: true },
                            { title: t('Tunnels.EDIT'), onClick: () => setEditing(tunnel) },
                            {
                              title: t('Tunnels.REMOVE'),
                              isDanger: true,
                              isDisabled: tunnel.usedBy > 0,
                              onClick: () => setRemoving(tunnel),
                            },
                          ]}
                        />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </PageSection>

      {editing && (
        <TunnelDialog
          tunnel={editing === 'new' ? undefined : editing}
          suggestedFingerprint={suggested}
          onClose={close}
        />
      )}

      {removing && (
        <ConfirmDialog
          isOpen
          title={t('Tunnels.REMOVE_TITLE')}
          confirmLabel={t('Tunnels.REMOVE')}
          isDestructive
          isBusy={remove.isPending}
          onConfirm={() => {
            remove.mutate(removing.id);
            setRemoving(undefined);
          }}
          onCancel={() => setRemoving(undefined)}
        >
          {t('Tunnels.REMOVE_BODY', { name: removing.name })}
        </ConfirmDialog>
      )}
    </>
  );
};
