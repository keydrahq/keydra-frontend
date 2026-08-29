import { useCallback, useContext, useEffect, useState } from 'react';
import { NotificationCategory } from '@app/Shared/Services/api.types';
import { ServiceContext } from '@app/Shared/Services/Services';
import { recordedInstead } from '@app/Approvals/recorded';
import { keysApi } from './api';
import type { MigrateRequest, MigrationJob } from './types';

export interface Migration {
  /** The job on screen, or undefined before one has been started. */
  job: MigrationJob | undefined;
  isStarting: boolean;
  error: string | undefined;
  /**
   * The server's sentence when the migration was recorded rather than started.
   *
   * <p>Beside `error` rather than inside it, because it is not one: the destination asks for two
   * people, the request is written down, and a dialog that painted that red would be describing
   * the guard as a fault.
   */
  recorded: string | undefined;
  start: (request: MigrateRequest) => void;
  cancel: () => void;
  /** Forgets the finished job so the dialog can be used again. */
  reset: () => void;
}

/**
 * One migration, followed live.
 *
 * <p>The job is started over REST and then watched over the notification hub rather than polled.
 * Moving a large keyspace takes minutes, and the server is already broadcasting its progress for
 * anyone else looking at the same target — a page that polled on top of that would ask for numbers
 * it is being sent anyway.
 *
 * <p>Every event carries the job's whole state rather than a delta, so a page that joins late, or
 * misses an event, shows the truth at the next one instead of an accumulated guess.
 */
export const useMigration = (connectionId: number): Migration => {
  const { graphql, notifications } = useContext(ServiceContext);
  const [job, setJob] = useState<MigrationJob | undefined>();
  const [isStarting, setStarting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [recorded, setRecorded] = useState<string | undefined>();

  useEffect(
    () =>
      notifications.subscribe<MigrationJob>(
        NotificationCategory.MigrationProgress,
        ({ payload }) => {
          // Only this dialog's job: several may be running, and against other targets.
          setJob((current) => (current && payload.id === current.id ? payload : current));
        },
      ),
    [notifications],
  );

  const start = useCallback(
    (request: MigrateRequest) => {
      setStarting(true);
      setError(undefined);
      setRecorded(undefined);
      keysApi
        .migrate(graphql, connectionId, request)
        .then(setJob)
        .catch((failure: Error) => {
          const waiting = recordedInstead(failure);
          if (waiting === undefined) {
            setError(failure.message);
          } else {
            setRecorded(waiting);
          }
        })
        .finally(() => setStarting(false));
    },
    [graphql, connectionId],
  );

  const cancel = useCallback(() => {
    if (!job || job.state !== 'RUNNING') {
      return;
    }
    // The job's own ending arrives over the hub, so nothing is assumed here about what
    // the numbers were when it stopped.
    keysApi.cancelMigration(graphql, connectionId, job.id).catch((failure: Error) => {
      setError(failure.message);
    });
  }, [graphql, connectionId, job]);

  const reset = useCallback(() => {
    setJob(undefined);
    setError(undefined);
    setRecorded(undefined);
  }, []);

  return { job, isStarting, error, recorded, start, cancel, reset };
};
