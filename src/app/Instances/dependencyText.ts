import type { TFunction } from 'i18next';
import type { DependencyState } from './queries';

/**
 * What each of these needs, rather than the whole row.
 *
 * <p>The graph card holds a flattened copy of a dependency rather than the record itself, and a
 * function that demanded the record would need a cast at every call. Naming the two fields it
 * reads is the same thing said honestly.
 */
type Named = Pick<DependencyState, 'id' | 'name'>;
type Kinded = Pick<DependencyState, 'id' | 'kind'>;

/**
 * What one dependency is called, what sort of thing it is, and what its row says.
 *
 * <p>The backend sends a stable `id` and the numbers; the sentences are written here, with the
 * rest of the interface text. Before this, the page drew ten English names on a graph and an
 * English sentence beside each of them whatever language it was asked for — the labels were the
 * one part of Keydra that had no translation at all.
 *
 * <p>Everything falls back to what the server sent. A dependency this build has no name for is
 * better drawn with its English name than with a blank card, and a script reading the API still
 * gets readable English out of `name` and `kind`.
 */

/** The name on the card and in the What column. */
export const dependencyName = (dependency: Named, t: TFunction): string =>
  t(`Instances.DEP_${key(dependency.id)}` as 'Instances.DEP_DATABASE', { defaultValue: '' }) ||
  dependency.name;

/**
 * What sort of thing it is, under the name.
 *
 * <p>Translated only where the server's answer is a description rather than a value. `PostgreSQL`
 * and `ClickHouse` are names, and the mail row's kind is the relay's own host — none of those is
 * ours to rewrite, so they have no key and fall through.
 */
export const dependencyKind = (dependency: Kinded, t: TFunction): string =>
  t(`Instances.DEP_KIND_${key(dependency.id)}` as 'Instances.DEP_KIND_TARGETS', {
    defaultValue: '',
  }) || dependency.kind;

/**
 * The detail line: what is known about this row beyond its state.
 *
 * <p>Composed here rather than sent as a sentence, because every part of it is a number the row
 * already carries. `note` is the one part that is not — a standing explanation of something
 * nobody has configured — and it arrives as a key. `detail` is what is left: an exception's own
 * words, which are diagnostic and are shown as they are.
 */
export const dependencyDetail = (dependency: DependencyState, t: TFunction): string[] => {
  const parts: string[] = [];
  if (dependency.note) {
    const note = t(`Instances.DEP_NOTE_${key(dependency.note)}` as 'Instances.DEP_NOTE_MAIL_OFF', {
      defaultValue: '',
    });
    if (note) parts.push(note);
  }
  if (dependency.detail) parts.push(dependency.detail);

  // "3 of 4 enabled" only where that is a different number from the whole, and only for a group:
  // saying it about the database, of which there is one, would be noise on every page load.
  if (dependency.count > 0 && dependency.healthy !== dependency.count) {
    parts.push(
      t('Instances.DEP_ENABLED', { healthy: dependency.healthy, count: dependency.count }),
    );
  }
  // The absence of an answer is itself worth saying: a page that showed a brand-new destination
  // as simply fine would be inventing the one fact it exists to report.
  if (dependency.count > 0 && !dependency.reached && asked(dependency)) {
    parts.push(t('Instances.DEP_NOT_CHECKED'));
  }
  if (dependency.reached && dependency.reached.answering !== dependency.reached.asked) {
    parts.push(
      t('Instances.DEP_ANSWERING', {
        answering: dependency.reached.answering,
        asked: dependency.reached.asked,
      }),
    );
  }
  return parts;
};

/**
 * Whether this is a group anything asks.
 *
 * <p>Only the two the backend checks on its slow clock have a reachability reading at all, and
 * only those should say "not checked yet" when they have none. Anything else has not been asked
 * because nothing asks it, which is not news.
 */
const ASKED = new Set(['identity-providers', 'backup-destinations']);
const asked = (dependency: DependencyState): boolean => ASKED.has(dependency.id);

/** An id or a note key as the flat, upper-case tail of a translation key. */
const key = (value: string): string => value.replace(/-/g, '_').toUpperCase();
