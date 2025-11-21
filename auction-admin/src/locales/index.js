import en from '../../locales/en.default.json';
import pl from '../../locales/pl.json';
import de from '../../locales/de.json';
import es from '../../locales/es.json';
import fr from '../../locales/fr.json';
import it from '../../locales/it.json';
import nl from '../../locales/nl.json';
import ar from '../../locales/ar.json';
import ja from '../../locales/ja.json';
import ko from '../../locales/ko.json';

export const DEFAULT_LOCALE = 'en';
const RTL_LOCALES = ['ar'];

const BASE_TRANSLATIONS = {
  en,
  'en-us': en,
  'en-ca': en,
  'en-gb': en,
  pl,
  'pl-pl': pl,
  de,
  'de-de': de,
  es,
  'es-es': es,
  fr,
  'fr-fr': fr,
  it,
  'it-it': it,
  nl,
  'nl-nl': nl,
  ar,
  'ar-ar': ar,
  ja,
  'ja-jp': ja,
  ko,
  'ko-kr': ko
};

export function normalizeLocale(locale) {
  if (typeof locale !== 'string') {
    return DEFAULT_LOCALE;
  }
  return locale.toLowerCase();
}

export function resolveLocale(locale) {
  const normalized = normalizeLocale(locale);
  if (BASE_TRANSLATIONS[normalized]) {
    return normalized;
  }
  const shortCode = normalized.split('-')[0];
  if (BASE_TRANSLATIONS[shortCode]) {
    return shortCode;
  }
  return DEFAULT_LOCALE;
}

export function detectLocale() {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  const shopifyLocale =
    window.Shopify?.locale ||
    window.__SHOPIFY_DEV_TOOLS__?.locale ||
    document?.documentElement?.lang ||
    navigator?.language;

  return resolveLocale(shopifyLocale || DEFAULT_LOCALE);
}

export function getTranslationsForLocale(locale) {
  const resolved = resolveLocale(locale);
  return BASE_TRANSLATIONS[resolved] || en;
}

export function isRtlLocale(locale) {
  const resolved = resolveLocale(locale);
  return RTL_LOCALES.includes(resolved.split('-')[0]);
}

