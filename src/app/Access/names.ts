/**
 * A group's name, as it should be read.
 *
 * <p>Shown with a capital rather than stored with one: what somebody typed is what they typed,
 * and rewriting it would mean the name in the API, the audit log and the provider's claim mapping
 * all quietly disagreed with each other. Only the first character, and only where it is a letter —
 * `payments-devs` becomes `Payments-devs`, not `Payments-Devs`, because the second word is part of
 * a name somebody chose rather than a word this application gets to title-case.
 */
export const groupName = (name: string): string =>
  name.length === 0 ? name : name.charAt(0).toLocaleUpperCase() + name.slice(1);
