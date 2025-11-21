import {useI18n} from '@shopify/react-i18n';
import {DEFAULT_LOCALE, getTranslationsForLocale} from '../locales';

const fallbackTranslations = getTranslationsForLocale(DEFAULT_LOCALE);

export function useAdminI18n(options = {}) {
  const [i18n] = useI18n({
    id: 'admin',
    fallback: fallbackTranslations,
    translations: (locale) => getTranslationsForLocale(locale),
    ...options
  });

  return i18n;
}

export default useAdminI18n;

