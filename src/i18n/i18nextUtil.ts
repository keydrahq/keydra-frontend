import en_common from '../../locales/en/common.json';
import en_public from '../../locales/en/public.json';
import tr_common from '../../locales/tr/common.json';
import tr_public from '../../locales/tr/public.json';

/**
 * Locale bundles are statically imported so they ship with the app bundle; no
 * HTTP backend is involved. `public` holds component-scoped strings, `common`
 * holds short strings reused across the UI.
 */
export const i18nResources = {
  en: { public: en_public, common: en_common },
  tr: { public: tr_public, common: tr_common },
} as const;

export const i18nLanguages = Object.keys(i18nResources);

export const i18nNamespaces = ['public', 'common'];

/**
 * What each language is called in its own language, which is how somebody finds theirs.
 *
 * <p>Beside the list rather than in the one page that first needed it: the masthead picker and the
 * settings page both name these, and two copies of a table like this drift the day a third
 * language is added — one place would get "Deutsch" and the other "German".
 */
export const i18nLanguageNames: Record<string, string> = {
  en: 'English',
  tr: 'Türkçe',
};
