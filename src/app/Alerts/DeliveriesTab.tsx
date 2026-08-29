import type { FC } from 'react';
import { useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  Checkbox,
  Content,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  Label,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { PaperPlaneIcon } from '@patternfly/react-icons';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@app/Shared/Components/ConfirmDialog';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { useNotifications } from '@app/Shared/Components/notificationStore';
import { DeliveryDialog } from './DeliveryDialog';
import {
  useAlertDeliveries,
  useInstanceNotices,
  useSaveInstanceNotices,
  useCheckAlertDelivery,
  useDeleteAlertDelivery,
} from './queries';
import type { AlertDeliverySummary } from './types';

/**
 * Where alerts are sent.
 *
 * <p>Rows like backup destinations, and read the same way: the "where" column answers "which of
 * these is the on-call channel" without opening anything. For a webhook that column is a host and
 * nothing more — the rest of the address is the token, so the API never returns it.
 *
 * <p>"Used by" is here because deleting one is refused while any rule still points at it. A rule
 * whose delivery quietly became nothing is a rule that looks configured and reaches nobody.
 */
export const DeliveriesTab: FC = () => {
  const { t } = useTranslation();
  const deliveries = useAlertDeliveries();
  const remove = useDeleteAlertDelivery();
  const check = useCheckAlertDelivery();
  const { notify } = useNotifications();
  const hearing = useInstanceNotices();
  const saveHearing = useSaveInstanceNotices();

  const [editing, setEditing] = useState<AlertDeliverySummary | 'new' | undefined>();
  const [removing, setRemoving] = useState<AlertDeliverySummary | undefined>();

  const test = (delivery: AlertDeliverySummary) =>
    check.mutate(delivery.id, {
      onSuccess: (result) =>
        notify({
          title: result.working
            ? t('Alerts.TEST_WORKED', { name: delivery.name })
            : t('Alerts.TEST_FAILED', { name: delivery.name }),
          description: result.detail ?? undefined,
          variant: result.working ? 'success' : 'danger',
        }),
      onError: (error) =>
        notify({
          title: t('Alerts.TEST_FAILED', { name: delivery.name }),
          description: error.message,
          variant: 'danger',
        }),
    });

  const removeIt = () => {
    if (!removing) {
      return;
    }
    remove.mutate(removing.id, {
      onError: (error) =>
        notify({
          title: t('Alerts.DELIVERY_DELETE_FAILED', { name: removing.name }),
          description: error.message,
          variant: 'danger',
        }),
    });
    setRemoving(undefined);
  };

  if (deliveries.isPending) {
    return <LoadingView />;
  }
  if (deliveries.isError) {
    return <ErrorView title={t('Alerts.DELIVERIES_ERROR')} message={deliveries.error.message} />;
  }

  /**
   * Which destinations hear about Keydra itself.
   *
   * <p>Under the table rather than as a column on it: it is one instance-wide answer, and a column
   * would make every row carry a fact about the installation.
   */
  const keydrasOwn =
    deliveries.data.length === 0 ? null : (
      <Card isCompact className="pf-v6-u-mt-md">
        <CardTitle>{t('Alerts.INSTANCE_NOTICES')}</CardTitle>
        <CardBody>
          <Content component="p">{t('Alerts.INSTANCE_NOTICES_HELP')}</Content>
          {deliveries.data.map((delivery) => (
            <Checkbox
              key={delivery.id}
              id={`instance-notice-${delivery.id}`}
              label={`${delivery.name} — ${delivery.describedAs}`}
              isChecked={(hearing.data ?? []).includes(delivery.id)}
              isDisabled={hearing.isPending || saveHearing.isPending}
              onChange={(_event, checked) => {
                const held = hearing.data ?? [];
                saveHearing.mutate(
                  checked ? [...held, delivery.id] : held.filter((id) => id !== delivery.id),
                );
              }}
            />
          ))}
          {(hearing.data ?? []).length === 0 ? (
            <Content component="small">{t('Alerts.INSTANCE_NOTICES_NONE')}</Content>
          ) : null}
        </CardBody>
      </Card>
    );

  return (
    <>
      {deliveries.data.length === 0 ? (
        <EmptyState
          titleText={t('Alerts.DELIVERIES_EMPTY')}
          icon={PaperPlaneIcon}
          headingLevel="h2"
        >
          <EmptyStateBody>{t('Alerts.DELIVERIES_EMPTY_BODY')}</EmptyStateBody>
          <EmptyStateFooter>
            <EmptyStateActions>
              <Button variant="primary" onClick={() => setEditing('new')}>
                {t('Alerts.DELIVERY_ADD')}
              </Button>
            </EmptyStateActions>
          </EmptyStateFooter>
        </EmptyState>
      ) : (
        <>
          <Toolbar id="alert-deliveries-toolbar" inset={{ default: 'insetNone' }}>
            <ToolbarContent alignItems="center">
              <ToolbarItem align={{ default: 'alignEnd' }}>
                <Button variant="primary" onClick={() => setEditing('new')}>
                  {t('Alerts.DELIVERY_ADD')}
                </Button>
              </ToolbarItem>
            </ToolbarContent>
          </Toolbar>

          <Table aria-label={t('Alerts.DELIVERIES')} variant="compact">
            <Thead>
              <Tr>
                <Th width={20}>{t('Alerts.NAME')}</Th>
                <Th width={15}>{t('Alerts.KIND')}</Th>
                <Th width={30}>{t('Alerts.WHERE')}</Th>
                <Th width={15}>{t('Alerts.USED_BY')}</Th>
                <Th width={10}>{t('Alerts.ENABLED')}</Th>
                <Th screenReaderText={t('Alerts.ACTIONS')} />
              </Tr>
            </Thead>
            <Tbody>
              {deliveries.data.map((delivery) => (
                <Tr key={delivery.id}>
                  <Td dataLabel={t('Alerts.NAME')}>{delivery.name}</Td>
                  <Td dataLabel={t('Alerts.KIND')}>
                    <Label isCompact variant="outline">
                      {t(`Alerts.KIND_${delivery.kind}` as const)}
                    </Label>
                  </Td>
                  <Td dataLabel={t('Alerts.WHERE')}>{delivery.describedAs}</Td>
                  <Td dataLabel={t('Alerts.USED_BY')}>
                    {delivery.usedByRules === 0
                      ? t('Alerts.USED_BY_NONE')
                      : t('Alerts.USED_BY_COUNT', { count: delivery.usedByRules })}
                  </Td>
                  <Td dataLabel={t('Alerts.ENABLED')}>
                    <Label isCompact color={delivery.enabled ? 'green' : 'grey'}>
                      {t(delivery.enabled ? 'Alerts.ON' : 'Alerts.OFF')}
                    </Label>
                  </Td>
                  <Td isActionCell>
                    <ActionsColumn
                      items={[
                        { title: t('Alerts.TEST'), onClick: () => test(delivery) },
                        { title: t('Alerts.EDIT'), onClick: () => setEditing(delivery) },
                        { isSeparator: true },
                        {
                          title: t('Alerts.DELETE'),
                          onClick: () => setRemoving(delivery),
                          isDanger: true,
                        },
                      ]}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </>
      )}

      {keydrasOwn}
      {editing && (
        <DeliveryDialog
          delivery={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
        />
      )}
      {removing && (
        <ConfirmDialog
          isOpen
          title={t('Alerts.DELIVERY_DELETE_TITLE')}
          confirmLabel={t('Alerts.DELETE')}
          isDestructive
          isBusy={remove.isPending}
          onConfirm={removeIt}
          onCancel={() => setRemoving(undefined)}
        >
          {t('Alerts.DELIVERY_DELETE_BODY', { name: removing.name })}
        </ConfirmDialog>
      )}
    </>
  );
};
