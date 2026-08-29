/**
 * Kept as the name every page already imports; the implementation moved.
 *
 * <p>Phase 37 made a preference belong to an account rather than to a browser, and the hook that
 * does both lives in {@code preferences.ts} next to the query it needs. Re-exported rather than
 * renamed at half a dozen call sites, because what those pages ask for has not changed — only
 * where the answer is kept.
 */
export { usePreference } from './preferences';
