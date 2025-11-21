import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from '../models/Store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supported locales
const SUPPORTED_LOCALES = ['en', 'pl', 'de', 'es', 'fr', 'it', 'nl', 'ar', 'ja', 'ko'];
const DEFAULT_LOCALE = 'en';

// Cache for loaded translations
const translationCache = new Map();

/**
 * Load translation file for a locale
 */
function loadTranslations(locale) {
  if (translationCache.has(locale)) {
    return translationCache.get(locale);
  }

  const localeFile = path.join(__dirname, '..', 'locales', `${locale}.json`);
  
  try {
    if (fs.existsSync(localeFile)) {
      const content = fs.readFileSync(localeFile, 'utf8');
      const translations = JSON.parse(content);
      translationCache.set(locale, translations);
      return translations;
    }
  } catch (error) {
    console.warn(`Failed to load translations for locale ${locale}:`, error.message);
  }

  // Fallback to English if locale file doesn't exist
  if (locale !== DEFAULT_LOCALE) {
    return loadTranslations(DEFAULT_LOCALE);
  }

  // If even English fails, return empty object
  return {};
}

/**
 * Get shop's primary language
 * Tries to get from Store model, falls back to 'en'
 */
async function getShopLocale(shopDomain) {
  if (!shopDomain) {
    return DEFAULT_LOCALE;
  }

  try {
    const store = await Store.findOne({ shopDomain }).lean();
    if (store?.primaryLanguage && SUPPORTED_LOCALES.includes(store.primaryLanguage)) {
      return store.primaryLanguage;
    }
  } catch (error) {
    console.warn(`Failed to get locale for shop ${shopDomain}:`, error.message);
  }

  return DEFAULT_LOCALE;
}

/**
 * Replace tokens in a string
 * Supports both {{token}} and {token} formats
 */
function replaceTokens(text, tokens = {}) {
  if (!text || typeof text !== 'string') {
    return text || '';
  }

  let result = text;
  for (const [key, value] of Object.entries(tokens)) {
    const valueStr = value !== null && value !== undefined ? String(value) : '';
    // Replace {{key}} format
    result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), valueStr);
    // Replace {key} format
    result = result.replace(new RegExp(`{\\s*${key}\\s*}`, 'g'), valueStr);
  }

  return result;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj, path) {
  const keys = path.split('.');
  let value = obj;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return null;
    }
  }
  
  return value;
}

/**
 * Translation function
 * @param {string} shopDomain - Shop domain to determine locale
 * @param {string} key - Translation key (supports dot notation, e.g., 'errors.validation_failed')
 * @param {object} tokens - Optional tokens to replace in the translation
 * @returns {Promise<string>} Translated string
 */
export async function t(shopDomain, key, tokens = {}) {
  if (!key) {
    return '';
  }

  const locale = await getShopLocale(shopDomain);
  const translations = loadTranslations(locale);
  
  // Try to get translation
  let translation = getNestedValue(translations, key);
  
  // Fallback to English if not found
  if (!translation && locale !== DEFAULT_LOCALE) {
    const enTranslations = loadTranslations(DEFAULT_LOCALE);
    translation = getNestedValue(enTranslations, key);
  }
  
  // If still not found, return the key itself
  if (!translation) {
    console.warn(`Translation key not found: ${key} (locale: ${locale})`);
    return key;
  }
  
  // Replace tokens if provided
  if (tokens && Object.keys(tokens).length > 0) {
    return replaceTokens(translation, tokens);
  }
  
  return translation;
}

/**
 * Synchronous version (uses default locale)
 * Useful for error handlers where async might be problematic
 */
export function tSync(key, tokens = {}) {
  if (!key) {
    return '';
  }

  const translations = loadTranslations(DEFAULT_LOCALE);
  let translation = getNestedValue(translations, key);
  
  if (!translation) {
    console.warn(`Translation key not found: ${key}`);
    return key;
  }
  
  if (tokens && Object.keys(tokens).length > 0) {
    return replaceTokens(translation, tokens);
  }
  
  return translation;
}

/**
 * Clear translation cache (useful for testing or hot-reloading)
 */
export function clearCache() {
  translationCache.clear();
}

