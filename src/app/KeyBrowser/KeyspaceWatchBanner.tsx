import type { FC } from 'react';
import { Alert, AlertActionLink, Spinner } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { Permission, usePermissionCheck } from '@app/Login/queries';
import { useSupports } from '@app/Connections/capabilities';
import { Feature } from '@app/Topology/types';
import { useAnnounceKeyspaceChanges, useKeyspaceWatch } from './useKeyspaceWatch';

export interface KeyspaceWatchBannerProps {
  connectionId: number;
  database?: number;
  /**
   * Keys this page has open, carried on the lease.
   *
   * <p>Here because this is the component that holds it. A batch's sample is bounded, so a viewer
   * whose key is not in it cannot tell that its key did not change — and a key named on the lease
   * is always in the message when it moves.
   */
  watching?: readonly string[];
}

/**
 * Says when this list is only half true, and offers the one thing that fixes it.
 *
 * <p>Mounting this is what holds the watch: the hook takes a lease while it is on the page and
 * gives it back when it leaves. So the banner is not decoration around a feature — it is the
 * feature's presence on the page, which is why it lives here rather than in a corner of the
 * toolbar.
 *
 * <p>It shows nothing at all when the target is announcing, because then there is nothing to say:
 * a list that is keeping up does not need a bar explaining that it is.
 */
export const KeyspaceWatchBanner: FC<KeyspaceWatchBannerProps> = ({
  connectionId,
  database,
  watching,
}) => {
  const { t } = useTranslation();
  const supports = useSupports(connectionId);
  const holds = usePermissionCheck();
  const watch = useKeyspaceWatch(connectionId, database, watching);
  const announce = useAnnounceKeyspaceChanges(connectionId, database);

  // A store that changes silently has nothing to turn on, and a banner offering it would be an
  // offer that cannot be accepted.
  if (!supports(Feature.KeyspaceEvents) || !watch.data || watch.data.announcing) {
    return null;
  }

  const mayConfigure = holds(Permission.ServerConfigure, connectionId);

  return (
    <Alert
      variant="info"
      isInline
      component="h4"
      title={t('KeyBrowser.KEYSPACE_SILENT_TITLE')}
      actionLinks={
        mayConfigure ? (
          <AlertActionLink
            onClick={() => announce.mutate()}
            isDisabled={announce.isPending}
            aria-label={t('KeyBrowser.KEYSPACE_ANNOUNCE')}
          >
            {announce.isPending ? (
              <Spinner size="sm" aria-label={t('KeyBrowser.KEYSPACE_ANNOUNCING')} />
            ) : (
              t('KeyBrowser.KEYSPACE_ANNOUNCE')
            )}
          </AlertActionLink>
        ) : undefined
      }
    >
      {announce.isError
        ? t('KeyBrowser.KEYSPACE_ANNOUNCE_FAILED', { reason: announce.error.message })
        : mayConfigure
          ? t('KeyBrowser.KEYSPACE_SILENT_BODY', { setting: watch.data.wouldBecome })
          : t('KeyBrowser.KEYSPACE_SILENT_BODY_READONLY')}
    </Alert>
  );
};
