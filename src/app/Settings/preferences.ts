import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ServiceContext } from '@app/Shared/Services/Services';

/** What the server answers: what somebody prefers, and whether there was anywhere to keep it. */
export interface StoredPreferences {
  preferences: Record<string, string>;
  stored: boolean;
}

export const preferencesQueryKey = ['preferences'] as const;

/**
 * What this person prefers, from their account.
 *
 * <p>Asked once and held: preferences change when somebody clicks a switch on this tab, and this
 * hook is told about that by the mutation below rather than by asking again.
 */
export const usePreferences = () => {
  const { api } = useContext(ServiceContext);
  return useQuery({
    queryKey: preferencesQueryKey,
    queryFn: () => api.doGet<StoredPreferences>('/preferences'),
    staleTime: Infinity,
  });
};

/**
 * Reads the browser's own copy, which is the one that exists before any request has finished.
 *
 * <p>A stored value that will not parse is treated as absent: preferences are written by earlier
 * versions of this application, and a shape that has since changed should cost the default rather
 * than an unreadable page.
 */
const fromBrowser = <T>(key: string, fallback: T): T => {
  const stored = window.localStorage.getItem(key);
  if (stored === null) {
    return fallback;
  }
  try {
    return JSON.parse(stored) as T;
  } catch {
    /*
     * A value written before preferences were JSON. The theme, the brand and the contrast were
     * each stored as the bare word — "dark", not "\"dark\"" — so parsing them fails, and treating
     * that as absent would reset the appearance of every existing browser exactly once. Narrow on
     * purpose: only where the default is a string, which is the only shape that was ever stored
     * that way.
     */
    return typeof fallback === 'string' ? (stored as unknown as T) : fallback;
  }
};

const toBrowser = (key: string, value: unknown): void => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A browser refusing to store a preference is not worth failing a page over: private mode and
    // a full quota both land here, and the setting still applies for as long as the tab is open.
  }
};

/**
 * One preference: the account's if there is one, the browser's otherwise.
 *
 * <p>Both, and in that order, because they answer different halves of the same need. The account is
 * the truth — sign in from a second machine and your theme is your theme — but a round trip cannot
 * happen before the first paint, and a page that waited for one would show the default theme and
 * then change colour. So the browser's copy is read synchronously for the initial value and the
 * account's replaces it when it arrives; every write goes to both.
 *
 * <p>On an instance with enforcement off there is no account, the server says so, and this is
 * exactly what it was before any of it existed: a value in {@code localStorage}.
 *
 * <p>Values are JSON on both sides, so a number stays a number and a preference whose shape grows
 * does not need a parser here.
 */
export const usePreference = <T>(key: string, fallback: T): [T, (next: T) => void] => {
  const { api } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  const stored = usePreferences();

  /** What somebody has chosen in this tab since the page loaded, if anything. */
  const [chosen, setChosen] = useState<T | undefined>(undefined);

  /** The browser's copy, read once — it is the one that exists before any request has finished. */
  const [browser] = useState<T>(() => fromBrowser(key, fallback));

  /** The account's, when the request has answered. */
  const account = useMemo(() => {
    const mine = stored.data?.stored ? stored.data.preferences[key] : undefined;
    if (mine === undefined) {
      return undefined;
    }
    try {
      return JSON.parse(mine) as T;
    } catch {
      // Written by a version that stored it differently. The browser's copy stands.
      return undefined;
    }
  }, [stored.data, key]);

  /*
   * Read in order of authority rather than copied from one place into another: what this tab chose
   * wins, then the account, then the browser.
   *
   * <p>This was an effect that applied the account's value once, and "once" was the whole problem.
   * Applying it every time the query answered would undo a change somebody made while a refetch was
   * in flight, so it needed a flag saying it had already happened — which is a piece of state whose
   * only job is to remember that some other state is no longer to be trusted. Three values and an
   * order between them says the same thing with nothing to get out of step.
   */
  const value = chosen ?? account ?? browser;

  /*
   * The account's value cached in the browser, so the next first paint is right rather than default
   * for one round trip. Not while somebody is mid-change in this tab: their choice is on its way to
   * the account, and the answer that has not caught up yet is not the one to write down.
   */
  useEffect(() => {
    if (chosen === undefined && account !== undefined) {
      toBrowser(key, account);
    }
  }, [account, chosen, key]);

  const save = useMutation({
    mutationFn: (next: T) =>
      api.doPost<boolean>('/preferences', { name: key, value: JSON.stringify(next) }),
    onSuccess: (_kept, next) =>
      queryClient.setQueryData<StoredPreferences>(preferencesQueryKey, (held) =>
        held === undefined
          ? held
          : { ...held, preferences: { ...held.preferences, [key]: JSON.stringify(next) } },
      ),
  });

  const store = useCallback(
    (next: T) => {
      setChosen(next);
      toBrowser(key, next);
      // The browser first and the account after, so the switch moves at the speed of a click
      // rather than at the speed of the network. A failed write leaves the browser's copy, which
      // is the same place it lived before this existed.
      if (stored.data?.stored) {
        save.mutate(next);
      }
    },
    // `save` is rebuilt by TanStack on every render; keying on it would rebuild this on every
    // render too, and every consumer of it with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, stored.data?.stored],
  );

  return [value, store];
};
