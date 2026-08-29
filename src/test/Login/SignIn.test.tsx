import { describe, expect, it } from 'vitest';
import { whyItFailed } from '@app/Login/signInFailure';
import { ApiError } from '@app/Shared/Services/Api.service';

/**
 * What a failed sign-in is told.
 *
 * <p>Three answers, because they send somebody to three different places, and getting it wrong
 * costs either way: "wrong password" shown to somebody whose password was never read sends them to
 * change a password that was fine, and "try again in a moment" shown for a database that is down
 * has them trying all afternoon.
 *
 * <p>Tested as the decision rather than through the form: what is worth pinning is which of the
 * three a given failure is, and a test that typed into PatternFly's login markup would break on
 * the day that markup changed while the rule stayed right.
 */
describe('why a sign-in failed', () => {
  const answered = (status: number) => new ApiError(status, 'Refused', '/api/v1/auth/login');

  it('blames the credentials only when Keydra refused them', () => {
    expect(whyItFailed(answered(401))).toBe('Login.REFUSED');
  });

  it('does not blame them for a request that never arrived', () => {
    // A dropped connection, a backend restarting, a proxy with nothing behind it.
    expect(whyItFailed(new Error('Failed to fetch'))).toBe('Login.UNREACHABLE');
    expect(whyItFailed(answered(502))).toBe('Login.UNREACHABLE');
    expect(whyItFailed(answered(503))).toBe('Login.UNREACHABLE');
    expect(whyItFailed(null)).toBe('Login.UNREACHABLE');
  });

  it('sends somebody to the logs when Keydra itself failed', () => {
    // Keydra answering that it could not do it — most often its database — which nobody
    // at the keyboard fixes by trying again.
    expect(whyItFailed(answered(500))).toBe('Login.FAILED');
  });
});
