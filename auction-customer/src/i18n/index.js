import en from './en.json';
import pl from './pl.json';
import de from './de.json';
import es from './es.json';
import fr from './fr.json';
import it from './it.json';
import nl from './nl.json';
import ar from './ar.json';
import ja from './ja.json';
import ko from './ko.json';

export const DEFAULT_LOCALE = 'en';

const translations = {
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

function normalizeLocale(locale) {
  if (typeof locale !== 'string') {
    return DEFAULT_LOCALE;
  }
  return locale.toLowerCase();
}

function resolveLocale(locale) {
  const normalized = normalizeLocale(locale);
  if (translations[normalized]) {
    return normalized;
  }
  const shortCode = normalized.split('-')[0];
  if (translations[shortCode]) {
    return shortCode;
  }
  return DEFAULT_LOCALE;
}

export function detectLocale() {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  const locale =
    window.Shopify?.locale ||
    document.documentElement?.lang ||
    (navigator?.language || 'en').split('-')[0] ||
    'en';

  return resolveLocale(locale);
}

export function t(key, params = {}, fallback = null) {
  const locale = detectLocale();
  const localeTranslations = translations[locale] || translations[DEFAULT_LOCALE];
  
  const keys = key.split('.');
  let value = localeTranslations;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Fallback to English
      value = translations[DEFAULT_LOCALE];
      for (const fallbackKey of keys) {
        if (value && typeof value === 'object' && fallbackKey in value) {
          value = value[fallbackKey];
        } else {
          return fallback !== null ? fallback : key;
        }
      }
      break;
    }
  }
  
  if (typeof value === 'string') {
    // Replace variables like {name}, {amount}, {shop}, etc.
    let result = value;
    for (const [paramKey, paramValue] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), paramValue);
      result = result.replace(new RegExp(`\\$\\{${paramKey}\\}`, 'g'), paramValue);
    }
    return result;
  }
  
  return fallback !== null ? fallback : key;
}

export function getTranslationsForLocale(locale) {
  const resolved = resolveLocale(locale);
  return translations[resolved] || translations[DEFAULT_LOCALE];
}

