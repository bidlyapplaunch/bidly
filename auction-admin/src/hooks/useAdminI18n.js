import {useI18n} from '@shopify/react-i18n';
import {DEFAULT_LOCALE, getTranslationsForLocale, resolveLocale} from '../locales';

const fallbackTranslations = getTranslationsForLocale(DEFAULT_LOCALE);

export function useAdminI18n(options = {}) {
  const [i18n] = useI18n({
    id: 'admin',
    fallback: fallbackTranslations,
    translations: (locale) => {
      const resolved = resolveLocale(locale);
      const translations = getTranslationsForLocale(resolved);
      console.log(`📦 Loading translations for locale: ${locale} -> ${resolved}`, translations ? '✅' : '❌');
      return translations;
    },
    ...options
  });

  return i18n;
}

export default useAdminI18n;

