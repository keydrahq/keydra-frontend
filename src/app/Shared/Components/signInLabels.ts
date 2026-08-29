import type { TFunction } from 'i18next';

/**
 * How a browser describes itself, shortened to something a person recognises.
 *
 * <p>A user agent is a paragraph of history — every browser claims to be several others — and what
 * somebody needs from it is "this is my laptop" or "this is not". So the browser and the platform,
 * and nothing else.
 */
export const describeAgent = (agent: string | null): string => {
  if (!agent) {
    return '';
  }
  const browser =
    /(Firefox|Edg|OPR|Chrome|Safari)\/[\d.]+/.exec(agent)?.[1]?.replace('Edg', 'Edge') ?? '';
  const platform =
    /\(([^;)]+)/.exec(agent)?.[1]?.replace('Macintosh', 'Mac').replace('X11', 'Linux') ?? '';
  return [browser, platform].filter(Boolean).join(' · ');
};

/** When something happened, in the reader's own locale. */
export const whenLocal = (moment: string | null): string =>
  moment ? new Date(moment).toLocaleString() : '';

/**
 * The country as a flag and its two letters.
 *
 * <p>Built from the letters rather than looked up: a regional indicator pair is exactly the two
 * letters shifted into another block, so every country a database can name draws without a table
 * of flags to keep up to date. The letters stay beside it, because a flag at this size is not
 * always legible and a country nobody recognises is still a country somebody can search for.
 */
export const countryLabel = (code: string | null): string => {
  if (!code || code.length !== 2) {
    return '';
  }
  const upper = code.toUpperCase();
  const flag = String.fromCodePoint(
    ...[...upper].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  );
  return `${flag} ${upper}`;
};

/**
 * The severity an anomaly is drawn at.
 *
 * <p>Three of these mean somebody else is signing in as this person, if they mean anything at all;
 * the rest mean the shape of a sign-in changed, which is usually a new laptop. Drawing them the
 * same would make the list one colour, and a list that is one colour is a list nobody reads twice.
 */
export const anomalySeverity = (anomaly: string): 'red' | 'orange' =>
  anomaly === 'IMPOSSIBLE_TRAVEL' ||
  anomaly === 'AFTER_REPEATED_FAILURES' ||
  anomaly === 'MANY_ACCOUNTS_ONE_SOURCE'
    ? 'red'
    : 'orange';

/** What an anomaly is called, falling back to its own name where a translation is missing. */
export const anomalyLabel = (t: TFunction, anomaly: string): string =>
  t(`SignIns.ANOMALY.${anomaly}`, { defaultValue: anomaly });

/** What an outcome is called. */
export const outcomeLabel = (t: TFunction, outcome: string): string =>
  t(`SignIns.OUTCOME.${outcome}`, { defaultValue: outcome });
