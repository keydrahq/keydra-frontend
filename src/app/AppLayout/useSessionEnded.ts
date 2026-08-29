import { useContext, useEffect } from 'react';
import { ServiceContext } from '@app/Shared/Services/Services';
import { NotificationCategory } from '@app/Shared/Services/api.types';

/**
 * Takes the page to the login screen when this session is ended somewhere else.
 *
 * <p>Ending a session already stops the next request, which is enough for somebody clicking around.
 * It is not enough for a page sitting open: the person is still looking at data they can no longer
 * fetch, and the first thing they learn is an error rather than a reason.
 *
 * <p>Nothing is compared here, because nothing needs to be. The server sends this only on the
 * sockets belonging to the session that ended — so receiving it *is* the message. That is also what
 * lets the session cookie stay `HttpOnly`: a page that had to work out whether an ending was its
 * own would have to be able to read which session it is.
 *
 * <p>A full navigation rather than a route change: what has to be true afterwards is that nothing
 * of the previous person is still loaded, and the surest way to hold nothing is to have loaded
 * nothing.
 */
export const useSessionEnded = (): void => {
  const { notifications } = useContext(ServiceContext);

  useEffect(
    () =>
      notifications.subscribe(NotificationCategory.SessionEnded, () => {
        window.location.assign('/');
      }),
    [notifications],
  );
};
