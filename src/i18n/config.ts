import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { i18nLanguages, i18nNamespaces, i18nResources } from './i18nextUtil';

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: i18nResources,
    ns: i18nNamespaces,
    defaultNS: 'public',
    fallbackNS: 'common',
    fallbackLng: 'en',
    supportedLngs: i18nLanguages,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

export default i18next;
