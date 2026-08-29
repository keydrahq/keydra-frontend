import type { FC, ReactNode } from 'react';
import { Alert } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import { LoginShell } from '@app/Login/LoginShell';
import { EnrolSecondFactor } from '@app/Login/EnrolSecondFactor';
import { SignIn } from '@app/Login/SignIn';
import { useAuthState } from '@app/Login/queries';

export interface RequiresSignInProps {
  children?: ReactNode;
}

/**
 * Shows the application, or the login page in front of it.
 *
 * <p>Only when Keydra is enforcing access. A development instance with security off has nobody to
 * sign in as, and putting a sign-in wall in front of it would make the open instance look like the
 * secured one — which is precisely the confusion the security state is displayed to avoid.
 *
 * <p>Sits outside the layout rather than inside it. A login page framed by a navigation of pages
 * nobody can open yet is an odd thing to look at, and it is also a lie: those links do not work.
 *
 * <p>Three answers, not two, and the third is the one that was missing. "You are not signed in" is
 * an answer from a server; "the server could not be reached" is the absence of one. Treating them
 * alike put a login form in front of somebody whose backend was restarting — a form that cannot
 * work, offering no hint of why, and blaming them for being signed out when they were not.
 */
export const RequiresSignIn: FC<RequiresSignInProps> = ({ children }) => {
  const { t } = useTranslation();
  const state = useAuthState();

  /**
   * Asked, and came back with nothing.
   *
   * <p>Derived rather than remembered, and it exists because of what "pending" means: no data yet.
   * A query that has never succeeded returns to pending every time it tries again, so a screen
   * keyed on that flashed a spinner every three seconds for as long as the server was down — the
   * failure and the retry looked exactly alike, and the page appeared to keep starting over.
   *
   * <p>"Has been fetched at least once, and still has nothing" is true from the first failure until
   * the first answer, including while a retry is in flight. The first ask shows a spinner because
   * nothing is known yet; everything after a failure keeps the failure on screen.
   */
  const stillFailing = state.isFetched && !state.data;

  if (stillFailing) {
    // An alert inside the login card, which is what PatternFly puts there — the same element the
    // sign-in form uses to say a password was wrong. An EmptyState belongs in a page body and
    // renders as an unstyled block inside a card, repeating the card's own heading.
    //
    // No retry button: the query keeps asking while it is failing, so a server that comes back is
    // noticed within a few seconds and this screen gives way on its own. A button offering to do
    // what is already happening reads as "nothing will change until you press this".
    //
    // In the login page's own frame rather than on a bare page: an unreachable server should not
    // make Keydra look like a broken application with no name, no wordmark, and no way to change
    // the language it is failing in.
    return (
      <LoginShell title={t('SignIn.UNREACHABLE_TITLE')} subtitle={t('SignIn.UNREACHABLE_BODY')}>
        <Alert
          isInline
          variant="warning"
          title={t('SignIn.RETRYING')}
          aria-live="polite"
          component="p"
        />
      </LoginShell>
    );
  }

  if (state.isPending) {
    return <LoadingView />;
  }

  const auth = state.data;

  // An answer saying nobody is signed in means the login page. Showing the shell to somebody who
  // is not signed in is not the permissive choice — it is the broken one: every request answers
  // 401, every page is an error, and there is no way from there back to a form.
  if (!auth || (auth.securityEnabled && !auth.authenticated)) {
    return <SignIn needsSetup={auth?.needsSetup ?? false} />;
  }

  // Signed in, and holding nothing. This instance requires a second factor and this account has
  // not paired one, so the server has already taken its roles away — every gated request answers
  // 403 on its own. Drawing the application anyway would be drawing a navigation of pages that
  // all fail, which is the same lie an unauthenticated shell would be.
  if (auth.mustEnrolSecondFactor) {
    return <EnrolSecondFactor />;
  }

  return <>{children}</>;
};
