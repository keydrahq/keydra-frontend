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
import { OutlinedHddIcon, PlusCircleIcon } from '@patternfly/react-icons';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@app/Shared/Components/ConfirmDialog';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { PageHeader } from '@app/Shared/Components/PageHeader';
import { useNotifications } from '@app/Shared/Components/notificationStore';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import { DestinationDialog } from './DestinationDialog';
import { useCheckDestination, useDeleteDestination, useDestinations } from './queries';
import { isReadable } from './types';
import type { DestinationSummary } from './types';

/**
 * Where backups go.
 *
 * <p>A page of its own rather than a field on each schedule, which is the whole point: a bucket
 * name and a secret key live here once, and rotating the key is one edit rather than one per
 * schedule that used it.
 *
 * <p>Every row can be tested, and testing writes a small file and takes it away again. Credentials
 * that can log in and not write are the commonest way a destination is wrong, and the moment to
 * find that out is while somebody is looking at this page.
 */
export const Destinations: FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('Backups.TITLE'));

  const destinations = useDestinations();
  const remove = useDeleteDestination();
  const check = useCheckDestination();
  const { notify } = useNotifications();

  const [editing, setEditing] = useState<DestinationSummary | 'new' | undefined>();
  const [removing, setRemoving] = useState<DestinationSummary | undefined>();
  const [checking, setChecking] = useState<number | undefined>();

  const test = (destination: DestinationSummary) => {
    setChecking(destination.id);
    check.mutate(destination.id, {
      onSettled: () => setChecking(undefined),
      onSuccess: (result) =>
        notify({
          title: result.reachable
            ? t('Backups.CHECK_OK', { name: destination.name })
            : t('Backups.CHECK_FAILED', { name: destination.name }),
          description: result.message ?? undefined,
          variant: result.reachable ? 'success' : 'danger',
        }),
      onError: (error) =>
        notify({
          title: t('Backups.CHECK_FAILED', { name: destination.name }),
          description: error.message,
          variant: 'danger',
        }),
    });
  };

  if (destinations.isPending) {
    return <LoadingView />;
  }
  if (destinations.isError) {
    return (
      <PageSection>
        <ErrorView title={t('Backups.LOAD_ERROR')} message={destinations.error.message} />
      </PageSection>
    );
  }

  return (
    <>
      <PageHeader
        title={t('Backups.TITLE')}
        description={
          destinations.data.length === 0
            ? t('Backups.DESCRIPTION')
            : t('Backups.SUMMARY', { count: destinations.data.length })
        }
        actions={
          destinations.data.length > 0 ? (
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => setEditing('new')}>
              {t('Backups.ADD_DESTINATION')}
            </Button>
          ) : null
        }
      />

      <PageSection isFilled>
        <Card isCompact>
          <CardBody>
            {destinations.data.length === 0 ? (
              <EmptyState
                titleText={t('Backups.EMPTY_TITLE')}
                icon={OutlinedHddIcon}
                headingLevel="h2"
              >
                <EmptyStateBody>{t('Backups.EMPTY_BODY')}</EmptyStateBody>
                <EmptyStateFooter>
                  <EmptyStateActions>
                    <Button
                      variant="primary"
                      icon={<PlusCircleIcon />}
                      onClick={() => setEditing('new')}
                    >
                      {t('Backups.ADD_DESTINATION')}
                    </Button>
                  </EmptyStateActions>
                </EmptyStateFooter>
              </EmptyState>
            ) : (
              <Table aria-label={t('Backups.TITLE')} variant="compact">
                <Thead>
                  <Tr>
                    <Th width={20}>{t('Backups.NAME')}</Th>
                    <Th width={10}>{t('Backups.KIND')}</Th>
                    <Th width={40}>{t('Backups.WHERE')}</Th>
                    <Th width={15}>{t('Backups.STATUS')}</Th>
                    <Th screenReaderText={t('Backups.ACTIONS')} />
                  </Tr>
                </Thead>
                <Tbody>
                  {destinations.data.map((destination) => (
                    <Tr key={destination.id}>
                      <Td dataLabel={t('Backups.NAME')}>{destination.name}</Td>
                      <Td dataLabel={t('Backups.KIND')}>
                        <Label isCompact variant="outline">
                          {t(`Backups.KIND_${destination.kind}` as 'Backups.KIND_LOCAL')}
                        </Label>
                      </Td>
                      <Td dataLabel={t('Backups.WHERE')}>
                        <code>{destination.describedAs}</code>
                      </Td>
                      <Td dataLabel={t('Backups.STATUS')}>
                        <Label isCompact color={destination.enabled ? 'green' : 'grey'}>
                          {destination.enabled ? t('Backups.ON') : t('Backups.OFF')}
                        </Label>
                        {destination.hasSecret && (
                          <Label isCompact variant="outline">
                            {t('Backups.HAS_SECRET')}
                          </Label>
                        )}
                        {destination.encrypts && (
                          <Label isCompact color="green">
                            {t('Backups.ENCRYPTED')}
                          </Label>
                        )}
                        {!isReadable(destination.kind) && (
                          <Label isCompact color="orange">
                            {t('Backups.WRITE_ONLY')}
                          </Label>
                        )}
                        {checking === destination.id && <Spinner size="sm" />}
                      </Td>
                      <Td isActionCell>
                        <ActionsColumn
                          items={[
                            {
                              title: t('Backups.CHECK'),
                              isDisabled: check.isPending,
                              onClick: () => test(destination),
                            },
                            { isSeparator: true },
                            { title: t('Backups.EDIT'), onClick: () => setEditing(destination) },
                            {
                              title: t('Backups.REMOVE'),
                              isDanger: true,
                              onClick: () => setRemoving(destination),
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
        <DestinationDialog
          destination={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
        />
      )}

      {removing && (
        <ConfirmDialog
          isOpen
          title={t('Backups.REMOVE_TITLE')}
          confirmLabel={t('Backups.REMOVE')}
          isDestructive
          isBusy={remove.isPending}
          onConfirm={() => {
            remove.mutate(removing.id);
            setRemoving(undefined);
          }}
          onCancel={() => setRemoving(undefined)}
        >
          {t('Backups.REMOVE_BODY', { name: removing.name })}
        </ConfirmDialog>
      )}
    </>
  );
};
