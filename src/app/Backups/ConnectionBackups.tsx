import type { FC } from 'react';
import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Checkbox,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
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
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PageSection,
  TextInput,
  Timestamp,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { LockIcon, OutlinedHddIcon } from '@patternfly/react-icons';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { useConnections } from '@app/Connections/queries';
import { Permission, useHoldsPermission } from '@app/Login/queries';
import { formatBytes } from '@app/Monitoring/format';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { PageHeader } from '@app/Shared/Components/PageHeader';
import { useNotifications } from '@app/Shared/Components/notificationStore';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import {
  useBackupHeader,
  useBackups,
  useDestinations,
  useRestoreBackup,
  useTakeBackup,
} from './queries';
import { isReadable } from './types';
import type { BackupSummary } from './types';

/**
 * One target's backups: taking them, and putting one back.
 *
 * <p>Under the connection because that is what the permissions are about — taking a backup is
 * exporting and putting one back is importing, which is what those two have meant since they
 * existed. Sending the export somewhere else does not change who may read a keyspace.
 */
export const ConnectionBackups: FC = () => {
  const { t } = useTranslation();
  const { connectionId } = useParams();
  const id = Number(connectionId);
  useDocumentTitle(t('Backups.CONNECTION_TITLE'));

  const connections = useConnections();
  const destinations = useDestinations();
  const take = useTakeBackup();
  const { notify } = useNotifications();
  const mayRestore = useHoldsPermission(Permission.TransferImport, id);

  const [chosen, setChosen] = useState<number | undefined>();
  const [taking, setTaking] = useState(false);
  const [restoring, setRestoring] = useState<BackupSummary | undefined>();

  const usable = useMemo(
    () => (destinations.data ?? []).filter((destination) => destination.enabled),
    [destinations.data],
  );
  const destinationId = chosen ?? usable[0]?.id;
  const destination = usable.find((candidate) => candidate.id === destinationId);
  const backups = useBackups(id, destinationId);
  const name = connections.data?.find((profile) => profile.id === id)?.name ?? String(id);

  if (destinations.isPending) {
    return <LoadingView />;
  }

  return (
    <>
      <PageHeader
        title={t('Backups.CONNECTION_TITLE')}
        description={t('Backups.CONNECTION_DESCRIPTION', { name })}
        actions={
          usable.length > 0 ? (
            <Button variant="primary" onClick={() => setTaking(true)}>
              {t('Backups.TAKE_NOW')}
            </Button>
          ) : null
        }
      />

      <PageSection isFilled>
        <Card isCompact>
          <CardBody>
            {usable.length === 0 ? (
              <EmptyState
                titleText={t('Backups.NO_DESTINATIONS')}
                icon={OutlinedHddIcon}
                headingLevel="h2"
              >
                <EmptyStateBody>{t('Backups.NO_DESTINATIONS_BODY')}</EmptyStateBody>
              </EmptyState>
            ) : (
              <>
                <Toolbar id="backups-toolbar" inset={{ default: 'insetNone' }}>
                  <ToolbarContent>
                    <ToolbarItem>
                      <FormSelect
                        value={destinationId}
                        aria-label={t('Backups.DESTINATION')}
                        onChange={(_event, value) => setChosen(Number(value))}
                      >
                        {usable.map((candidate) => (
                          <FormSelectOption
                            key={candidate.id}
                            value={candidate.id}
                            label={candidate.name}
                          />
                        ))}
                      </FormSelect>
                    </ToolbarItem>
                  </ToolbarContent>
                </Toolbar>

                {destination && !isReadable(destination.kind) ? (
                  <Alert
                    variant="info"
                    isInline
                    component="h3"
                    title={t('Backups.WRITE_ONLY_TITLE')}
                  >
                    {t('Backups.WRITE_ONLY_BODY')}
                  </Alert>
                ) : backups.isPending ? (
                  <LoadingView />
                ) : backups.isError ? (
                  <ErrorView title={t('Backups.LIST_ERROR')} message={backups.error.message} />
                ) : backups.data.length === 0 ? (
                  <EmptyState
                    titleText={t('Backups.NONE_YET')}
                    icon={OutlinedHddIcon}
                    headingLevel="h3"
                  >
                    <EmptyStateBody>{t('Backups.NONE_YET_BODY')}</EmptyStateBody>
                  </EmptyState>
                ) : (
                  <Table aria-label={t('Backups.CONNECTION_TITLE')} variant="compact">
                    <Thead>
                      <Tr>
                        <Th width={50}>{t('Backups.FILE')}</Th>
                        <Th width={15}>{t('Backups.SIZE')}</Th>
                        <Th width={25}>{t('Backups.WRITTEN')}</Th>
                        <Th screenReaderText={t('Backups.ACTIONS')} />
                      </Tr>
                    </Thead>
                    <Tbody>
                      {backups.data.map((backup) => (
                        <Tr key={backup.name}>
                          <Td dataLabel={t('Backups.FILE')}>
                            <code>{backup.name}</code>
                            {backup.encrypted && (
                              <Label isCompact color="green" icon={<LockIcon />}>
                                {t('Backups.ENCRYPTED')}
                              </Label>
                            )}
                          </Td>
                          <Td dataLabel={t('Backups.SIZE')}>{formatBytes(backup.size)}</Td>
                          <Td dataLabel={t('Backups.WRITTEN')}>
                            {backup.modifiedAt ? (
                              <Timestamp
                                date={new Date(backup.modifiedAt)}
                                dateFormat="short"
                                timeFormat="short"
                              />
                            ) : (
                              '—'
                            )}
                          </Td>
                          <Td isActionCell>
                            <ActionsColumn
                              items={[
                                {
                                  title: t('Backups.RESTORE'),
                                  isDisabled: !mayRestore,
                                  onClick: () => setRestoring(backup),
                                },
                              ]}
                            />
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                )}
              </>
            )}
          </CardBody>
        </Card>
      </PageSection>

      {taking && destination && (
        <TakeDialog
          connectionId={id}
          destinationName={destination.name}
          isBusy={take.isPending}
          onClose={() => setTaking(false)}
          onTake={(prefix, match, keepLast) =>
            take.mutate(
              { connectionId: id, destinationId: destination.id, prefix, match, keepLast },
              {
                onSuccess: (result) => {
                  setTaking(false);
                  notify({
                    title: t('Backups.TAKEN', { name: result.name }),
                    description: t('Backups.TAKEN_BODY', {
                      keys: result.keys,
                      size: formatBytes(result.size),
                      removed: result.removed.length,
                    }),
                    variant: 'success',
                  });
                },
                onError: (error) =>
                  notify({
                    title: t('Backups.TAKE_FAILED'),
                    description: error.message,
                    variant: 'danger',
                  }),
              },
            )
          }
        />
      )}

      {restoring && destination && (
        <RestoreDialog
          connectionId={id}
          connectionName={name}
          destinationId={destination.id}
          backup={restoring}
          onClose={() => setRestoring(undefined)}
        />
      )}
    </>
  );
};

interface TakeDialogProps {
  connectionId: number;
  destinationName: string;
  isBusy: boolean;
  onClose: () => void;
  onTake: (prefix: string, match: string, keepLast: number | undefined) => void;
}

/** What to take, what to call it, and how many to keep. */
const TakeDialog: FC<TakeDialogProps> = ({ destinationName, isBusy, onClose, onTake }) => {
  const { t } = useTranslation();
  const [prefix, setPrefix] = useState('');
  const [match, setMatch] = useState('*');
  const [keepLast, setKeepLast] = useState('');

  return (
    <Modal isOpen variant="small" onClose={onClose} aria-label={t('Backups.TAKE_NOW')}>
      <ModalHeader
        title={t('Backups.TAKE_NOW')}
        description={t('Backups.TAKE_INTRO', { name: destinationName })}
      />
      <ModalBody>
        <Form>
          <FormGroup label={t('Backups.MATCH')} fieldId="backup-match">
            <TextInput
              id="backup-match"
              value={match}
              onChange={(_event, value) => setMatch(value)}
            />
          </FormGroup>
          <FormGroup label={t('Backups.FILE_PREFIX')} fieldId="backup-prefix">
            <TextInput
              id="backup-prefix"
              value={prefix}
              onChange={(_event, value) => setPrefix(value)}
              placeholder={t('Backups.FILE_PREFIX_DEFAULT')}
            />
          </FormGroup>
          <FormGroup label={t('Backups.KEEP_LAST')} fieldId="backup-keep">
            <TextInput
              id="backup-keep"
              type="number"
              min={0}
              value={keepLast}
              onChange={(_event, value) => setKeepLast(value)}
              placeholder={t('Backups.KEEP_EVERYTHING')}
            />
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          isDisabled={isBusy}
          onClick={() => onTake(prefix, match, keepLast ? Number(keepLast) : undefined)}
        >
          {t('Backups.TAKE')}
        </Button>
        <Button variant="link" onClick={onClose}>
          {t('Backups.CANCEL')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

interface RestoreDialogProps {
  connectionId: number;
  connectionName: string;
  destinationId: number;
  backup: BackupSummary;
  onClose: () => void;
}

/**
 * Putting one back.
 *
 * <p>The header is fetched first and shown, because restoring into the wrong target is exactly the
 * mistake this makes easy to make: a file that says which server it came from lets the dialog warn
 * when the one chosen is a different one.
 */
const RestoreDialog: FC<RestoreDialogProps> = ({
  connectionId,
  connectionName,
  destinationId,
  backup,
  onClose,
}) => {
  const { t } = useTranslation();
  const restore = useRestoreBackup();
  const { notify } = useNotifications();
  const details = useBackupHeader(connectionId, destinationId, backup.name);
  const [replace, setReplace] = useState(false);
  const [privateKey, setPrivateKey] = useState('');

  const header = details.data?.header;
  const fromElsewhere = header?.connectionId != null && header.connectionId !== connectionId;
  /**
   * Encrypted, and this instance could not open it to read the header.
   *
   * <p>Which is exactly what a backup written to a key looks like from here, and is the whole
   * claim of that mode rather than a failure to report.
   */
  const toAKey = (details.data?.encrypted ?? backup.encrypted) && !header;

  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-label={t('Backups.RESTORE')}>
      <ModalHeader title={t('Backups.RESTORE')} description={backup.name} />
      <ModalBody>
        {details.isPending ? (
          <LoadingView />
        ) : (
          <>
            <DescriptionList isHorizontal isCompact>
              <DescriptionListGroup>
                <DescriptionListTerm>{t('Backups.TAKEN_FROM')}</DescriptionListTerm>
                <DescriptionListDescription>
                  {header?.connection ?? t('Backups.NO_HEADER')}
                  {toAKey && (
                    <>
                      <Alert
                        variant="info"
                        isInline
                        component="h3"
                        title={t('Backups.SEALED_TO_KEY')}
                      >
                        {t('Backups.SEALED_TO_KEY_BODY')}
                      </Alert>
                      <FormGroup label={t('Backups.PRIVATE_KEY')} isRequired fieldId="restore-key">
                        <TextInput
                          id="restore-key"
                          value={privateKey}
                          onChange={(_event, value) => setPrivateKey(value)}
                          placeholder="keydra-sk1:…"
                          isRequired
                        />
                        <FormHelperText>
                          <HelperText>
                            <HelperTextItem>{t('Backups.PRIVATE_KEY_HELP')}</HelperTextItem>
                          </HelperText>
                        </FormHelperText>
                      </FormGroup>
                    </>
                  )}

                  {fromElsewhere && (
                    <Label isCompact color="orange">
                      {t('Backups.DIFFERENT_TARGET')}
                    </Label>
                  )}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>{t('Backups.TAKEN_AT')}</DescriptionListTerm>
                <DescriptionListDescription>
                  {header?.takenAt ? (
                    <Timestamp date={new Date(header.takenAt)} dateFormat="long" />
                  ) : (
                    '—'
                  )}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>{t('Backups.MATCH')}</DescriptionListTerm>
                <DescriptionListDescription>
                  <code>{header?.match ?? '*'}</code>
                </DescriptionListDescription>
              </DescriptionListGroup>
            </DescriptionList>

            {fromElsewhere && (
              <Alert
                variant="warning"
                isInline
                component="h3"
                title={t('Backups.DIFFERENT_TARGET_TITLE')}
              >
                {t('Backups.DIFFERENT_TARGET_BODY', {
                  from: header?.connection,
                  into: connectionName,
                })}
              </Alert>
            )}

            <Checkbox
              id="restore-replace"
              label={t('Backups.REPLACE')}
              description={t('Backups.REPLACE_HELP')}
              isChecked={replace}
              onChange={(_event, checked) => setReplace(checked)}
            />
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          isDisabled={restore.isPending || (toAKey && !privateKey.trim())}
          onClick={() =>
            restore.mutate(
              {
                connectionId,
                request: {
                  destinationId,
                  name: backup.name,
                  replace,
                  // Sent only when one was typed, and never kept by either side.
                  ...(privateKey.trim() ? { privateKey: privateKey.trim() } : {}),
                },
              },
              {
                onSuccess: (result) => {
                  onClose();
                  notify({
                    title: t('Backups.RESTORED'),
                    description: t('Backups.RESTORED_BODY', {
                      restored: result.restored,
                      skipped: result.skipped,
                      failed: result.failed,
                    }),
                    variant: result.failed > 0 ? 'warning' : 'success',
                  });
                },
                onError: (error) =>
                  notify({
                    title: t('Backups.RESTORE_FAILED'),
                    description: error.message,
                    variant: 'danger',
                  }),
              },
            )
          }
        >
          {t('Backups.RESTORE')}
        </Button>
        <Button variant="link" onClick={onClose}>
          {t('Backups.CANCEL')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
