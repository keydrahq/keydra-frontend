import { ApiError } from '@app/Shared/Services/Api.service';

/**
 * Whether the instance turned a sign-in down, as opposed to never reading it.
 *
 * <p>A gateway error, a dropped connection or a backend that is restarting all arrive as a failed
 * request, and none of them is a wrong password. Telling somebody their password is wrong when it
 * was never read sends them to change a password that was fine.
 */
const refused = (error: Error | null): boolean => error instanceof ApiError && error.status === 401;

/**
 * Whether the password was not read at all, because too many had just been tried.
 *
 * <p>A different thing from a refusal and worth saying differently. The credentials may have been
 * right; nobody looked. Somebody told "wrong username or password" here would go and change a
 * password that was never the problem, and somebody told nothing would keep trying — which is
 * exactly what the limit exists to stop.
 */
const throttled = (error: Error | null): boolean =>
  error instanceof ApiError && error.status === 429;

/** Which sentence a failed sign-in gets. */
export type SignInFailure =
  'Login.REFUSED' | 'Login.THROTTLED' | 'Login.FAILED' | 'Login.UNREACHABLE';

/**
 * What to say about a sign-in that did not work.
 *
 * <p>Four answers, because they send somebody to four different places. A refusal is about the
 * credentials. Being turned away for having tried too often is not — the password may have been
 * right and nobody read it, so the thing to do is wait rather than change anything. A failure
 * inside Keydra — most often its database — is nothing the person at the keyboard can fix, and
 * telling them to try again in a moment would have them try all afternoon. Anything else never
 * reached the application at all.
 *
 * <p>In its own file rather than beside the page, because it is a rule and not a component: a
 * module that exports both stops the dev server from refreshing either.
 */
export const whyItFailed = (error: Error | null): SignInFailure => {
  if (refused(error)) {
    return 'Login.REFUSED';
  }
  if (throttled(error)) {
    return 'Login.THROTTLED';
  }
  // 500 is Keydra answering that it could not do it; 502, 503 and 504 are something in
  // front of Keydra saying it is not there, which is the same as no answer at all.
  if (error instanceof ApiError && error.status === 500) {
    return 'Login.FAILED';
  }
  return 'Login.UNREACHABLE';
};

/** Whether to mark the fields themselves as wrong, which only a refusal justifies. */
export const blamesTheFields = (error: Error | null): boolean => refused(error);
