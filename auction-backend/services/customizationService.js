import CustomizationSetting, { COLORS_SCHEMA_DEFINITION } from '../models/CustomizationSetting.js';

const CACHE_TTL_MS = 30 * 1000; // 30 seconds
const cache = new Map();

const COLOR_KEYS = Object.keys(COLORS_SCHEMA_DEFINITION);
const FONT_OPTIONS = ['Poppins', 'Inter', 'Roboto', 'Lato'];
const TEMPLATE_KEYS = ['A', 'B', 'C', 'D'];
const BOX_SHADOW_OPTIONS = ['none', 'subtle', 'medium'];
const BORDER_RADIUS_OPTIONS = [4, 8, 16];

const WIDGET_TEMPLATES = {
  A: {
    id: 'A',
    name: 'Aurora',
    description: 'Vibrant gradient with modern rounded corners and bright call-to-action',
    font: 'Poppins',
    borderRadius: 16,
    boxShadow: 'medium',
    gradientEnabled: false,
    colors: {
      accent: '#18688B',
      text: '#EDEEF3',
      timer: '#B23434',
      bg_solid: '#1F364C',
      bg_gradient_start: '#B7BDD2',
      bg_gradient_end: '#283E3B',
      button_bg: '#212736',
      button_hover: '#7FD2C1',
      button_text: '#FFFFFF',
      border: '#36516C'
    },
    layout: 'airy'
  },
  B: {
    id: 'B',
    name: 'Midnight Glass',
    description: 'Glassmorphism with cool tones and subtle glow for premium feel',
    font: 'Inter',
    borderRadius: 8,
    boxShadow: 'medium',
    gradientEnabled: true,
    colors: {
      accent: '#a855f7',
      text: '#e0f2fe',
      timer: '#fde68a',
      bg_solid: '#111827',
      bg_gradient_start: '#312e81',
      bg_gradient_end: '#1e1b4b',
      button_bg: '#8b5cf6',
      button_hover: '#7c3aed',
      button_text: '#f8fafc',
      border: '#3730a3'
    },
    layout: 'compact'
  },
  C: {
    id: 'C',
    name: 'Sunrise',
    description: 'Warm gradient with friendly rounded edges and light surfaces',
    font: 'Roboto',
    borderRadius: 16,
    boxShadow: 'subtle',
    gradientEnabled: true,
    colors: {
      accent: '#f97316',
      text: '#1f2937',
      timer: '#dc2626',
      bg_solid: '#fdf2f8',
      bg_gradient_start: '#fca5a5',
      bg_gradient_end: '#f97316',
      button_bg: '#fb7185',
      button_hover: '#f43f5e',
      button_text: '#fff7ed',
      border: '#fed7aa'
    },
    layout: 'airy'
  },
  D: {
    id: 'D',
    name: 'Slate Minimal',
    description: 'Minimal neutral palette with sharp edges and strong accent',
    font: 'Lato',
    borderRadius: 4,
    boxShadow: 'subtle',
    gradientEnabled: false,
    colors: {
      accent: '#0ea5e9',
      text: '#0f172a',
      timer: '#ea580c',
      bg_solid: '#f8fafc',
      bg_gradient_start: '#f8fafc',
      bg_gradient_end: '#f8fafc',
      button_bg: '#0f172a',
      button_hover: '#1e293b',
      button_text: '#f8fafc',
      border: '#cbd5f5'
    },
    layout: 'compact'
  }
};

const MARKETPLACE_TEMPLATES = {
  A: {
    id: 'A',
    name: 'Gallery Light',
    description: 'Clean card layout with gentle shadows and soft accent highlights',
    font: 'Inter',
    borderRadius: 16,
    boxShadow: 'subtle',
    gradientEnabled: false,
    colors: {
      accent: '#2563eb',
      text: '#111827',
      bg_solid: '#f9fafb',
      bg_gradient_start: '#f9fafb',
      bg_gradient_end: '#f9fafb',
      button_bg: '#2563eb',
      button_hover: '#1d4ed8',
      button_text: '#f9fafb',
      border: '#e5e7eb'
    },
    layout: 'grid'
  },
  B: {
    id: 'B',
    name: 'Noir Showcase',
    description: 'Dark immersive experience with vibrant accent for standout bids',
    font: 'Poppins',
    borderRadius: 8,
    boxShadow: 'medium',
    gradientEnabled: true,
    colors: {
      accent: '#facc15',
      text: '#f8fafc',
      bg_solid: '#0f172a',
      bg_gradient_start: '#1f2937',
      bg_gradient_end: '#111827',
      button_bg: '#facc15',
      button_hover: '#eab308',
      button_text: '#0f172a',
      border: '#1f2937'
    },
    layout: 'showcase'
  },
  C: {
    id: 'C',
    name: 'Pastel Board',
    description: 'Soft pastel palette with spacious layout and subtle dividers',
    font: 'Lato',
    borderRadius: 16,
    boxShadow: 'none',
    gradientEnabled: false,
    colors: {
      accent: '#fb7185',
      text: '#1f2937',
      bg_solid: '#fef2f2',
      bg_gradient_start: '#fef2f2',
      bg_gradient_end: '#fef2f2',
      button_bg: '#fb7185',
      button_hover: '#f43f5e',
      button_text: '#fff7ed',
      border: '#fecdd3'
    },
    layout: 'board'
  },
  D: {
    id: 'D',
    name: 'Slate Pro',
    description: 'Professional neutral palette with structured layout and crisp edges',
    font: 'Roboto',
    borderRadius: 4,
    boxShadow: 'medium',
    gradientEnabled: false,
    colors: {
      accent: '#22d3ee',
      text: '#0f172a',
      bg_solid: '#ffffff',
      bg_gradient_start: '#ffffff',
      bg_gradient_end: '#ffffff',
      button_bg: '#0f172a',
      button_hover: '#1e293b',
      button_text: '#f8fafc',
      border: '#e2e8f0'
    },
    layout: 'list'
  }
};

const COLOR_PALETTES = [
  {
    id: 'cool-blue',
    name: 'Cool Blue',
      colors: {
        accent: '#3b82f6',
        bg_solid: '#0f172a',
        text: '#f8fafc',
        timer: '#fbbf24',
        button_bg: '#2563eb'
      }
  },
  {
    id: 'sunset',
    name: 'Sunset',
      colors: {
        accent: '#fb7185',
        bg_solid: '#fff7ed',
        text: '#1f2937',
        timer: '#ea580c',
        button_bg: '#f97316'
      }
  },
  {
    id: 'emerald',
    name: 'Emerald',
      colors: {
        accent: '#22c55e',
        bg_solid: '#ecfdf5',
        text: '#064e3b',
        timer: '#15803d',
        button_bg: '#16a34a'
      }
  },
  {
    id: 'slate',
    name: 'Slate',
      colors: {
        accent: '#38bdf8',
        bg_solid: '#f8fafc',
        text: '#0f172a',
        timer: '#ef4444',
        button_bg: '#0f172a'
      }
  }
];

const BOX_SHADOW_MAP = {
  none: 'none',
  subtle: '0 6px 18px rgba(15, 23, 42, 0.08)',
  medium: '0 18px 45px rgba(15, 23, 42, 0.14)'
};

function normalizeShopDomain(shop = '') {
  return shop
    .toString()
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getTemplateCatalogByType(type) {
  return type === 'widget' ? WIDGET_TEMPLATES : MARKETPLACE_TEMPLATES;
}

function getTemplateDefault(type, templateKey = 'A') {
  const catalog = getTemplateCatalogByType(type);
  const template = catalog[templateKey] || catalog['A'];
  const { font, colors, borderRadius, boxShadow, gradientEnabled } = template;
  return {
    template: templateKey in catalog ? templateKey : 'A',
    font,
    colors: deepClone(colors),
    borderRadius,
    boxShadow,
    gradientEnabled
  };
}

function mergeSettings(type, baseSettings, overrideSettings = {}) {
  const result = deepClone(baseSettings);
  if (overrideSettings.template && TEMPLATE_KEYS.includes(overrideSettings.template)) {
    result.template = overrideSettings.template;
  }
  if (overrideSettings.font && FONT_OPTIONS.includes(overrideSettings.font)) {
    result.font = overrideSettings.font;
  }
  if (overrideSettings.borderRadius && BORDER_RADIUS_OPTIONS.includes(overrideSettings.borderRadius)) {
    result.borderRadius = overrideSettings.borderRadius;
  }
  if (overrideSettings.boxShadow && BOX_SHADOW_OPTIONS.includes(overrideSettings.boxShadow)) {
    result.boxShadow = overrideSettings.boxShadow;
  }
  if (typeof overrideSettings.gradientEnabled === 'boolean') {
    result.gradientEnabled = overrideSettings.gradientEnabled;
  }
  if (overrideSettings.colors) {
    result.colors = {
      ...result.colors
    };
    COLOR_KEYS.forEach((key) => {
      if (overrideSettings.colors[key]) {
        result.colors[key] = overrideSettings.colors[key];
      }
    });
  }
  return result;
}

export function getDefaultSettings(type, templateKey = 'A') {
  return getTemplateDefault(type, templateKey);
}

export function getSettingsWithDefaults(type, settings) {
  if (!settings) {
    return getDefaultSettings(type);
  }

  const baseTemplateKey =
    settings.template && TEMPLATE_KEYS.includes(settings.template) ? settings.template : 'A';
  const templateDefaults = getTemplateDefault(type, baseTemplateKey);
  return mergeSettings(type, templateDefaults, settings);
}

function setCacheValue(cacheKey, payload) {
  cache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    payload
  });
}

function getCacheValue(cacheKey) {
  const cached = cache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    cache.delete(cacheKey);
    return null;
  }
  return cached.payload;
}

function invalidateCache(cacheKey) {
  cache.delete(cacheKey);
}

function isValidHexColor(value) {
  return typeof value === 'string' && /^#([0-9a-fA-F]{6})$/.test(value.trim());
}

function validateSettingsPayload(settings) {
  const errors = [];
  if (!settings || typeof settings !== 'object') {
    errors.push('Settings object is required');
    return errors;
  }
  if (settings.template && !TEMPLATE_KEYS.includes(settings.template)) {
    errors.push(`Invalid template "${settings.template}". Expected one of ${TEMPLATE_KEYS.join(', ')}`);
  }
  if (settings.font && !FONT_OPTIONS.includes(settings.font)) {
    errors.push(`Invalid font "${settings.font}". Expected one of ${FONT_OPTIONS.join(', ')}`);
  }
  if (settings.boxShadow && !BOX_SHADOW_OPTIONS.includes(settings.boxShadow)) {
    errors.push(`Invalid boxShadow "${settings.boxShadow}". Expected one of ${BOX_SHADOW_OPTIONS.join(', ')}`);
  }
  if (settings.borderRadius && !BORDER_RADIUS_OPTIONS.includes(settings.borderRadius)) {
    errors.push(`Invalid borderRadius "${settings.borderRadius}". Expected one of ${BORDER_RADIUS_OPTIONS.join(', ')}`);
  }
  if (settings.colors) {
    COLOR_KEYS.forEach((key) => {
      const value = settings.colors[key];
      if (value !== undefined && !isValidHexColor(value)) {
        errors.push(`Invalid color value for "${key}"`);
      }
    });
  }
  if (settings.gradientEnabled !== undefined && typeof settings.gradientEnabled !== 'boolean') {
    errors.push('gradientEnabled must be a boolean');
  }
  return errors;
}

function getPaletteCatalog() {
  return COLOR_PALETTES;
}

export async function getCustomization(shopDomain, type) {
  const shop = normalizeShopDomain(shopDomain);
  const cacheKey = `${shop}:${type}`;
  const cached = getCacheValue(cacheKey);
  if (cached) {
    return cached;
  }

  const doc = await CustomizationSetting.findOne({ shop, type }).lean();
  const settings = getSettingsWithDefaults(type, doc?.settings);

  const payload = {
    shop,
    type,
    settings,
    updatedAt: doc?.updatedAt || null,
    version: doc?.version || 1
  };

  setCacheValue(cacheKey, payload);
  return payload;
}

export async function saveCustomization(shopDomain, type, incomingSettings) {
  const shop = normalizeShopDomain(shopDomain);
  const errors = validateSettingsPayload(incomingSettings);
  if (errors.length > 0) {
    const error = new Error(errors.join(', '));
    error.status = 400;
    error.details = errors;
    throw error;
  }

  const mergedSettings = getSettingsWithDefaults(type, incomingSettings);

  const existing = await CustomizationSetting.findOne({ shop, type }, { version: 1 }).lean();
  const nextVersion = existing ? existing.version + 1 : 1;

  const doc = await CustomizationSetting.findOneAndUpdate(
    { shop, type },
    {
      $set: {
        settings: mergedSettings,
        version: nextVersion
      },
      $setOnInsert: {
        shop,
        type
      }
    },
    {
      new: true,
      upsert: true,
      lean: true
    }
  );

  invalidateCache(`${shop}:${type}`);

  return {
    shop,
    type,
    settings: doc.settings,
    updatedAt: doc.updatedAt,
    version: doc.version
  };
}

export function getCustomizationMeta(type) {
  const templatesCatalog = Object.values(getTemplateCatalogByType(type)).map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    font: template.font,
    borderRadius: template.borderRadius,
    boxShadow: template.boxShadow,
    gradientEnabled: template.gradientEnabled,
    colors: template.colors,
    layout: template.layout
  }));

  return {
    fonts: FONT_OPTIONS,
    templates: templatesCatalog,
    palettes: getPaletteCatalog(),
    borderRadius: BORDER_RADIUS_OPTIONS,
    boxShadows: BOX_SHADOW_OPTIONS,
    boxShadowValues: BOX_SHADOW_MAP,
    colorKeys: COLOR_KEYS
  };
}

export function getPreviewData(type, state = 'active') {
  const now = new Date();
  const baseAuction = {
    id: 'preview-auction',
    productTitle: 'Vintage Leather Backpack',
    productImage: 'https://cdn.shopify.com/s/files/1/0577/6985/collections/sample-image.png?v=1668118130',
    currentBid: 185,
    minimumBid: 190,
    bids: 8,
    reserveMet: state === 'active',
    endsAt: new Date(now.getTime() + 1000 * 60 * 60 * 6).toISOString(),
    startsAt: new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
    currency: 'USD'
  };

  if (type === 'widget') {
    return {
      state,
      auction: {
        ...baseAuction,
        status: state,
        reserveMet: state !== 'pending',
        currentBid: state === 'pending' ? 140 : state === 'ended' ? 245 : 185,
        winningBid: state === 'ended' ? 245 : null,
        minimumBid: state === 'pending' ? 150 : 190
      }
    };
  }

  return {
    state,
    marketplace: {
      featured: {
        ...baseAuction,
        status: state
      },
      auctions: [
        {
          ...baseAuction,
          id: 'preview-auction-1',
          status: 'active',
          productTitle: 'Handmade Ceramic Vase',
          currentBid: 95,
          minimumBid: 110,
          bids: 12,
          reserveMet: true
        },
        {
          ...baseAuction,
          id: 'preview-auction-2',
          status: 'pending',
          productTitle: 'Limited Edition Sneakers',
          currentBid: 0,
          minimumBid: 180,
          bids: 0,
          reserveMet: false
        },
        {
          ...baseAuction,
          id: 'preview-auction-3',
          status: 'ended',
          productTitle: 'Signed Art Print',
          currentBid: 320,
          minimumBid: 220,
          bids: 22,
          reserveMet: true
        }
      ]
    }
  };
}

export function clearCustomizationCache() {
  cache.clear();
}

export function getBoxShadowMap() {
  return BOX_SHADOW_MAP;
}

export const customizationServiceConstants = {
  FONT_OPTIONS,
  TEMPLATE_KEYS,
  BOX_SHADOW_OPTIONS,
  BORDER_RADIUS_OPTIONS,
  COLOR_KEYS
};

