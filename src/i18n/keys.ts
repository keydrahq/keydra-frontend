import type { ParseKeys } from 'i18next';

/**
 * Keys of the `public` translation namespace, checked at compile time.
 *
 * <p>Lives here rather than in the route table so any feature can type a translation key without
 * importing routing.
 */
export type TranslationKey = ParseKeys<'public'>;
