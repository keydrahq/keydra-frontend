import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type { ImportResult } from '@app/KeyBrowser/types';
import { ServiceContext } from '@app/Shared/Services/Services';
import type {
  BackupKeyPair,
  BackupSummary,
  BackupTaken,
  DestinationCheck,
  DestinationRequest,
  DestinationSummary,
  RestoreRequest,
} from './types';

export const backupsQueryKey = ['backups'] as const;

const useInvalidateBackups = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: backupsQueryKey });
};

/** The fields a destination is drawn with. Named once so the queries cannot drift apart. */
const DESTINATION_FIELDS = `
  id
  name
  kind
  enabled
  describedAs
  location
  path
  endpoint
  region
  accessKey
  hasSecret
  pathStyle
  port
  tls
  hasPrivateKey
  tunnelId
  encrypts
  recipients { label publicKey }
`;

const DESTINATIONS = `
  query BackupDestinations {
    backupDestinations {
      ${DESTINATION_FIELDS}
    }
  }
`;

export const useDestinations = (): UseQueryResult<DestinationSummary[], Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: [...backupsQueryKey, 'destinations'],
    queryFn: () =>
      graphql
        .query<{ backupDestinations: DestinationSummary[] }>(DESTINATIONS)
        .then((answer) => answer.backupDestinations),
    retry: false,
  });
};

const CREATE_DESTINATION = `
  mutation CreateBackupDestination($destination: DestinationRequestInput) {
    createBackupDestination(destination: $destination) {
      ${DESTINATION_FIELDS}
    }
  }
`;

const UPDATE_DESTINATION = `
  mutation UpdateBackupDestination($id: BigInteger, $destination: DestinationRequestInput) {
    updateBackupDestination(id: $id, destination: $destination) {
      ${DESTINATION_FIELDS}
    }
  }
`;

export const useSaveDestination = (): UseMutationResult<
  DestinationSummary,
  Error,
  { id?: number; request: DestinationRequest }
> => {
  const { graphql } = useContext(ServiceContext);
  const invalidate = useInvalidateBackups();
  return useMutation({
    mutationFn: ({ id, request }) =>
      id === undefined
        ? graphql
            .query<{ createBackupDestination: DestinationSummary }>(CREATE_DESTINATION, {
              destination: request,
            })
            .then((answer) => answer.createBackupDestination)
        : graphql
            .query<{ updateBackupDestination: DestinationSummary }>(UPDATE_DESTINATION, {
              id,
              destination: request,
            })
            .then((answer) => answer.updateBackupDestination),
    onSuccess: invalidate,
  });
};

const DELETE_DESTINATION = `
  mutation DeleteBackupDestination($id: BigInteger) {
    deleteBackupDestination(id: $id)
  }
`;

export const useDeleteDestination = (): UseMutationResult<boolean, Error, number> => {
  const { graphql } = useContext(ServiceContext);
  const invalidate = useInvalidateBackups();
  return useMutation({
    mutationFn: (id: number) =>
      graphql
        .query<{ deleteBackupDestination: boolean }>(DELETE_DESTINATION, { id })
        .then((answer) => answer.deleteBackupDestination),
    onSuccess: invalidate,
  });
};

const GENERATE_KEYS = `
  mutation GenerateBackupKeyPair {
    generateBackupKeyPair {
      publicKey
      privateKey
    }
  }
`;

/**
 * Makes a key pair for encrypting backups.
 *
 * <p>A mutation because it produces something new every time it is called, which is the one thing
 * a query must never do. The private half is shown once and stored nowhere.
 */
export const useGenerateKeyPair = (): UseMutationResult<BackupKeyPair, Error, void> => {
  const { graphql } = useContext(ServiceContext);
  return useMutation({
    mutationFn: () =>
      graphql
        .query<{ generateBackupKeyPair: BackupKeyPair }>(GENERATE_KEYS)
        .then((answer) => answer.generateBackupKeyPair),
  });
};

const CHECK_DESTINATION = `
  mutation CheckBackupDestination($id: BigInteger, $destination: DestinationRequestInput) {
    checkBackupDestination(id: $id, destination: $destination) {
      reachable
      message
    }
  }
`;

/** Reaches the destination and reports what happened. A mutation: it leaves the building. */
export const useCheckDestination = (): UseMutationResult<DestinationCheck, Error, number> => {
  const { graphql } = useContext(ServiceContext);
  return useMutation({
    mutationFn: (id: number) =>
      graphql
        .query<{ checkBackupDestination: DestinationCheck }>(CHECK_DESTINATION, {
          id,
          destination: null,
        })
        .then((answer) => answer.checkBackupDestination),
  });
};

/**
 * The same attempt, against a destination nobody has saved yet.
 *
 * <p>The id goes with it when there is one: an edit form never carries the stored secret back, so
 * without it every test of an unchanged key would fail for a reason that has nothing to do with
 * the bucket.
 */
export const useCheckDestinationDraft = (): UseMutationResult<
  DestinationCheck,
  Error,
  { id?: number; request: DestinationRequest }
> => {
  const { graphql } = useContext(ServiceContext);
  return useMutation({
    mutationFn: ({ id, request }) =>
      graphql
        .query<{ checkBackupDestination: DestinationCheck }>(CHECK_DESTINATION, {
          id: id ?? null,
          destination: request,
        })
        .then((answer) => answer.checkBackupDestination),
  });
};

const BACKUP_FIELDS = `
  name
  size
  modifiedAt
  encrypted
  header {
    keydra
    connection
    connectionId
    match
    takenAt
  }
`;

const BACKUPS = `
  query Backups($connectionId: BigInteger, $destinationId: BigInteger) {
    backups(connectionId: $connectionId, destinationId: $destinationId) {
      ${BACKUP_FIELDS}
    }
  }
`;

/** What is already in a destination, for one target's page. */
export const useBackups = (
  connectionId: number,
  destinationId: number | undefined,
): UseQueryResult<BackupSummary[], Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: [...backupsQueryKey, 'list', connectionId, destinationId],
    queryFn: () =>
      graphql
        .query<{ backups: BackupSummary[] }>(BACKUPS, { connectionId, destinationId })
        .then((answer) => answer.backups),
    // Nothing to ask about until somewhere has been chosen.
    enabled: destinationId !== undefined,
    // A destination that cannot be read fails every time; retrying would turn one clear
    // message into four slow ones.
    retry: false,
  });
};

const BACKUP = `
  query Backup($connectionId: BigInteger, $destinationId: BigInteger, $name: String) {
    backup(connectionId: $connectionId, destinationId: $destinationId, name: $name) {
      ${BACKUP_FIELDS}
    }
  }
`;

/** What one backup says about itself. Its own request, because reading it means fetching it. */
export const useBackupHeader = (
  connectionId: number,
  destinationId: number | undefined,
  name: string | undefined,
): UseQueryResult<BackupSummary, Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: [...backupsQueryKey, 'header', connectionId, destinationId, name],
    queryFn: () =>
      graphql
        .query<{ backup: BackupSummary }>(BACKUP, { connectionId, destinationId, name })
        .then((answer) => answer.backup),
    enabled: destinationId !== undefined && !!name,
    retry: false,
  });
};

export interface TakeBackup {
  connectionId: number;
  destinationId: number;
  prefix?: string;
  match?: string;
  keepLast?: number;
}

const TAKE = `
  mutation TakeBackup(
    $connectionId: BigInteger
    $destinationId: BigInteger
    $prefix: String
    $match: String
    $keepLast: Int
  ) {
    takeBackup(
      connectionId: $connectionId
      destinationId: $destinationId
      prefix: $prefix
      match: $match
      keepLast: $keepLast
    ) {
      name
      size
      keys
      destination
      removed
    }
  }
`;

export const useTakeBackup = (): UseMutationResult<BackupTaken, Error, TakeBackup> => {
  const { graphql } = useContext(ServiceContext);
  const invalidate = useInvalidateBackups();
  return useMutation({
    mutationFn: ({ connectionId, destinationId, prefix, match, keepLast }) =>
      graphql
        .query<{ takeBackup: BackupTaken }>(TAKE, {
          connectionId,
          destinationId,
          prefix: prefix ?? null,
          match: match ?? null,
          keepLast: keepLast ?? null,
        })
        .then((answer) => answer.takeBackup),
    onSuccess: invalidate,
  });
};

const RESTORE = `
  mutation RestoreBackup($connectionId: BigInteger, $restore: RestoreRequestInput) {
    restoreBackup(connectionId: $connectionId, restore: $restore) {
      restored
      skipped
      failed
      reason
    }
  }
`;

export const useRestoreBackup = (): UseMutationResult<
  ImportResult,
  Error,
  { connectionId: number; request: RestoreRequest }
> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ connectionId, request }) =>
      graphql
        .query<{ restoreBackup: ImportResult }>(RESTORE, { connectionId, restore: request })
        .then((answer) => answer.restoreBackup),
    // A restore writes keys, so whatever was showing the keyspace is now showing the old one.
    onSuccess: () => queryClient.invalidateQueries(),
  });
};
