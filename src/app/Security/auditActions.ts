import type { TFunction } from 'i18next';

/**
 * What an audit row says, in words.
 *
 * <p>The backend records a stable identifier — `backup.destination.check` — because a log is
 * searched, filtered and kept for years, and a sentence is none of those things. What a person
 * reads has to be a sentence all the same, and this is where the identifier becomes one.
 *
 * <p>Composed from two halves rather than listed one line per action. There are seventy-odd
 * actions and every feature adds more; a table of whole sentences goes stale silently, and the
 * symptom is an audit log that shows raw identifiers again for exactly the newest, least familiar
 * operations. Split into a subject and a verb, a new action inherits a reasonable sentence the day
 * it is added, and anything genuinely unusual is written out in full below.
 */
export const describeAction = (action: string, t: TFunction): string => {
  const whole = lookup(t, 'WHOLE', action);
  if (whole) {
    return whole;
  }

  const cut = action.lastIndexOf('.');
  if (cut < 0) {
    return prettify(action);
  }
  const subject = lookup(t, 'SUBJECT', action.slice(0, cut));
  const verb = lookup(t, 'VERB', action.slice(cut + 1));
  if (!subject || !verb) {
    // An action nobody has named yet. Better a readable approximation of the identifier
    // than the identifier: it is at least a phrase, and it says which feature it came from.
    return prettify(action);
  }
  return `${subject} ${verb}`;
};

/**
 * The i18n key for one half of an action.
 *
 * <p>Flat keys built from the identifier, because a dotted key would be read as nesting by i18next
 * — and every one of these identifiers is dotted.
 */
const lookup = (t: TFunction, kind: 'WHOLE' | 'SUBJECT' | 'VERB', part: string): string => {
  const key = `Audit.${kind}_${part
    .replace(/\./g, '_')
    // A hyphen is a word break in an identifier the same way a dot is — `second-factor`,
    // `end-others`. Without this the key keeps the hyphen, which reads as a different
    // convention from every other key here and is the sort of thing somebody writes a
    // translation for and then cannot find.
    .replace(/-/g, '_')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toUpperCase()}`;
  return t(key as 'Audit.VERB_CREATE', { defaultValue: '' });
};

/** An identifier as close to a phrase as it can be got without knowing anything about it. */
const prettify = (action: string): string =>
  action
    .replace(/\./g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
