import { useContext, useEffect, useState } from 'react';
import { NotificationCategory } from '@app/Shared/Services/api.types';
import { ServiceContext } from '@app/Shared/Services/Services';

/** What the hub sends as a purge walks. */
interface PurgeProgress {
  connectionId: number;
  match: string;
  deleted: number;
}

/**
 * How many keys a purge has removed so far, for the dialog waiting on it.
 *
 * <p>Clearing a namespace on a large target walks the keyspace and deletes as it goes, and the
 * request does not answer until it has finished — which is a minute of a dialog that says nothing
 * and a button that looks stuck. The work reports itself over the same socket a migration's
 * progress uses; nothing was listening.
 *
 * @param connectionId the target being cleared
 * @param isRunning whether a purge is in flight, which is also what starts the count again
 */
export const usePurgeProgress = (connectionId: number, isRunning: boolean): number => {
  const { notifications } = useContext(ServiceContext);
  const [deleted, setDeleted] = useState(0);
  const [countingFor, setCountingFor] = useState(isRunning);

  // Back to zero when a purge begins, adjusted during render rather than in an effect: two
  // purges in a row would otherwise open at the previous one's total, which reads as instant
  // progress followed by a long pause.
  if (countingFor !== isRunning) {
    setCountingFor(isRunning);
    setDeleted(0);
  }

  useEffect(() => {
    return notifications.subscribe<PurgeProgress>(
      NotificationCategory.PurgeProgress,
      ({ payload }) => {
        if (payload.connectionId === connectionId) {
          setDeleted(payload.deleted);
        }
      },
    );
  }, [connectionId, notifications]);

  return deleted;
};
