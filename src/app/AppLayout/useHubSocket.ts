import { useContext, useEffect } from 'react';
import { ServiceContext } from '@app/Shared/Services/Services';

/**
 * Opens the one WebSocket the application has, and closes it on the way out.
 *
 * <p>Here rather than at the root of the provider tree, and the difference is not tidiness. The
 * root renders before anybody has signed in — on the login page, and on the page an invitation
 * link leads to — so a socket opened there is a socket opened by somebody who has not said who
 * they are. The server refuses it, the client dials again, and the login page spends its time
 * reconnecting to something it may not have.
 *
 * <p>This component only renders behind the sign-in wall, so a socket opened from here is opened
 * by somebody the server has already identified.
 */
export const useHubSocket = (): void => {
  const { notifications } = useContext(ServiceContext);

  useEffect(() => {
    notifications.connect();
    return () => notifications.disconnect();
  }, [notifications]);
};
