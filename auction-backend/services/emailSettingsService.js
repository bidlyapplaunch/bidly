import EmailSettings from '../models/EmailSettings.js';
import {
  EMAIL_TEMPLATE_KEYS,
  DEFAULT_EMAIL_SETTINGS,
  cloneDefaultEmailSettings
} from '../constants/emailTemplates.js';

function normalizeShopDomain(shopDomain = '') {
  if (!shopDomain) return null;
  return shopDomain
    .toString()
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
}

function mergeTemplate(baseTemplate, overrideTemplate = {}) {
  const next = { ...baseTemplate };
  if (overrideTemplate.enabled !== undefined) {
    next.enabled = !!overrideTemplate.enabled;
  }
  if (typeof overrideTemplate.subject === 'string') {
    next.subject = overrideTemplate.subject;
  }
  if (typeof overrideTemplate.html === 'string') {
    next.html = overrideTemplate.html;
  }
  if (typeof overrideTemplate.mode === 'string') {
    next.mode = overrideTemplate.mode === 'html' ? 'html' : 'text';
  } else if (!next.mode) {
    next.mode = 'text';
  }
  return next;
}

export function mergeWithDefaultEmailSettings(doc) {
  const base = cloneDefaultEmailSettings();
  if (!doc) {
    return base;
  }

  if (doc.enabled !== undefined) {
    base.enabled = !!doc.enabled;
  }
  if (doc.useCustomSmtp !== undefined) {
    base.useCustomSmtp = !!doc.useCustomSmtp;
  }

  base.smtp = {
    ...base.smtp,
    ...(doc.smtp || {})
  };

  EMAIL_TEMPLATE_KEYS.forEach((key) => {
    base.templates[key] = mergeTemplate(base.templates[key], doc.templates?.[key]);
  });

  return base;
}

export async function getEmailSettingsForShop(rawShopDomain) {
  const shopDomain = normalizeShopDomain(rawShopDomain);
  if (!shopDomain) {
    return {
      ...cloneDefaultEmailSettings(),
      hasCustom: false
    };
  }

  const doc = await EmailSettings.findOne({ shopDomain }).lean();
  const merged = mergeWithDefaultEmailSettings(doc);
  return {
    ...merged,
    hasCustom: !!doc
  };
}

export function normalizeEmailSettingsDomain(shopDomain) {
  return normalizeShopDomain(shopDomain);
}

