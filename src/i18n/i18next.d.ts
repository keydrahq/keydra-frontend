import 'i18next';
import type { i18nResources } from './i18nextUtil';

/** Makes `t()` keys type-checked against the English source bundle. */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'public';
    resources: (typeof i18nResources)['en'];
  }
}
