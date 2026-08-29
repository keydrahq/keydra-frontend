import type { TFunction } from 'i18next';

/**
 * Why the console refuses a command, in words.
 *
 * <p>The backend sends a stable key — `runs-code`, `writes-a-file` — because the reason is a fact
 * about the command and a fact is not a language. The sentence is interface text and lives with
 * the rest of it; before this, the one screen where somebody decides whether to allow MODULE on a
 * target was the one screen that stayed English whatever language it was asked for.
 *
 * <p>An unknown key falls back to a readable approximation of itself rather than to a blank. A
 * reason nobody has written a sentence for is a heading somebody can still tell apart from the
 * heading above it, which is what the grouping needs; an empty string would silently merge two
 * groups into one.
 */
export const describeConsoleReason = (reason: string, t: TFunction): string => {
  const key = `Console.REASON_${reason.replace(/-/g, '_').toUpperCase()}`;
  return t(key as 'Console.REASON_RUNS_CODE', { defaultValue: '' }) || prettify(reason);
};

/** A key as close to a phrase as it can be got without knowing anything about it. */
const prettify = (reason: string): string => reason.replace(/-/g, ' ');
