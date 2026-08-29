import type { FC } from 'react';
import { useState } from 'react';
import { Button, Card, CardBody, CardTitle, Flex, FlexItem } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@app/Shared/Components/ConfirmDialog';
import { useNotifications } from '@app/Shared/Components/notificationStore';
import { formatDuration } from './format';
import { useClients, useKillClient } from './queries';

export interface ClientsTableProps {
  connectionId: number;
}

/**
 * Who is attached to the server.
 *
 * <p>Disconnecting a client is destructive to whoever is on the other end of it, so it is
 * confirmed — the row does not say which application a connection belongs to, and the person
 * clicking may be about to cut off something they did not mean to.
 */
export const ClientsTable: FC<ClientsTableProps> = ({ connectionId }) => {
  const { t } = useTranslation();
  const { notify } = useNotifications();
  const clients = useClients(connectionId);
  const kill = useKillClient(connectionId);
  const [killing, setKilling] = useState<string | undefined>();

  const entries = clients.data ?? [];

  return (
    <Card isCompact isFullHeight>
      <CardTitle>
        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
          <FlexItem grow={{ default: 'grow' }}>
            {t('Monitoring.CLIENTS_COUNT', { count: entries.length })}
          </FlexItem>
          <FlexItem>
            <Button variant="link" isInline onClick={() => void clients.refetch()}>
              {t('Monitoring.REFRESH')}
            </Button>
          </FlexItem>
        </Flex>
      </CardTitle>
      <CardBody className="keydra-monitoring__scroll">
        <Table aria-label={t('Monitoring.CLIENTS')} variant="compact">
          <Thead>
            <Tr>
              <Th width={25}>{t('Monitoring.ADDRESS')}</Th>
              <Th width={20}>{t('Monitoring.CLIENT_NAME')}</Th>
              <Th width={10}>{t('Monitoring.AGE')}</Th>
              <Th width={10}>{t('Monitoring.IDLE')}</Th>
              <Th>{t('Monitoring.LAST_COMMAND')}</Th>
              <Th modifier="fitContent" screenReaderText={t('Monitoring.ROW_ACTIONS')} />
            </Tr>
          </Thead>
          <Tbody>
            {entries.map((client) => (
              <Tr key={client.id}>
                <Td dataLabel={t('Monitoring.ADDRESS')} className="pf-v6-u-font-family-monospace">
                  {client.address}
                </Td>
                <Td dataLabel={t('Monitoring.CLIENT_NAME')}>{client.name ?? '—'}</Td>
                <Td dataLabel={t('Monitoring.AGE')}>
                  {client.ageSeconds === null ? '—' : formatDuration(client.ageSeconds)}
                </Td>
                <Td dataLabel={t('Monitoring.IDLE')}>
                  {client.idleSeconds === null ? '—' : formatDuration(client.idleSeconds)}
                </Td>
                <Td
                  dataLabel={t('Monitoring.LAST_COMMAND')}
                  className="pf-v6-u-font-family-monospace"
                >
                  {client.lastCommand ?? '—'}
                </Td>
                <Td isActionCell>
                  <Button variant="link" isInline isDanger onClick={() => setKilling(client.id)}>
                    {t('Monitoring.DISCONNECT')}
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </CardBody>

      <ConfirmDialog
        isOpen={killing !== undefined}
        title={t('Monitoring.DISCONNECT_TITLE')}
        confirmLabel={t('Monitoring.DISCONNECT')}
        isDestructive
        isBusy={kill.isPending}
        onConfirm={() =>
          killing &&
          kill.mutate(killing, {
            onSuccess: () => setKilling(undefined),
            onError: (error) => {
              notify({
                title: t('Monitoring.DISCONNECT_FAILED'),
                description: error.message,
                variant: 'danger',
              });
              setKilling(undefined);
            },
          })
        }
        onCancel={() => setKilling(undefined)}
      >
        {t('Monitoring.DISCONNECT_BODY')}
      </ConfirmDialog>
    </Card>
  );
};
