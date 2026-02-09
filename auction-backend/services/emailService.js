import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from '../models/Store.js';
import { planMeetsRequirement, sanitizePlan } from '../config/billingPlans.js';
import { DEFAULT_EMAIL_TEMPLATES, EMAIL_TEMPLATE_KEYS } from '../constants/emailTemplates.js';
import {
  getEmailSettingsForShop,
  normalizeEmailSettingsDomain
} from './emailSettingsService.js';
import { t } from './i18n.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CUSTOMIZATION_PLAN = 'pro';
const DEFAULT_FRONTEND_URL = process.env.FRONTEND_URL || 'https://bidly.app';

const transportCache = new Map();
const defaultTransportState = {
  initialized: false,
  transporter: null,
  isConfigured: false,
  fromEmail: 'Bidly <noreply@auctions.com>'
};

function initDefaultTransport() {
  if (defaultTransportState.initialized) {
    return;
  }

  console.log('🔍 Email Service Debug:');
  console.log('  - EMAIL_USER:', process.env.EMAIL_USER ? 'Present' : 'Missing');
  console.log('  - EMAIL_PASS:', process.env.EMAIL_PASS ? 'Present' : 'Missing');
  console.log('  - EMAIL_HOST:', process.env.EMAIL_HOST ? 'Present' : 'Missing');
  console.log('  - EMAIL_SERVICE:', process.env.EMAIL_SERVICE || 'gmail (default)');

  defaultTransportState.isConfigured = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

  if (defaultTransportState.isConfigured) {
    // If EMAIL_HOST is set, use custom SMTP configuration (for SendGrid, Mailgun, AWS SES, etc.)
    if (process.env.EMAIL_HOST) {
      defaultTransportState.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587', 10),
        secure: process.env.EMAIL_SECURE === 'true' || process.env.EMAIL_PORT === '465',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
      console.log('📧 Email service configured with custom SMTP:', process.env.EMAIL_HOST);
    } else {
      // Fall back to service-based configuration (Gmail, Outlook, etc.)
      defaultTransportState.transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
      console.log('📧 Email service configured with service-based credentials:', process.env.EMAIL_SERVICE || 'gmail');
    }
  } else {
    // Use a stream transport to avoid actual network calls in demo mode
    defaultTransportState.transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true
    });
    console.log('📧 Email service running in DEMO mode (no real credentials)');
  }

  // Set from email - prioritize EMAIL_FROM, then use EMAIL_USER if available, otherwise default
  const fallbackFrom = process.env.EMAIL_USER ? `Bidly <${process.env.EMAIL_USER}>` : defaultTransportState.fromEmail;
  defaultTransportState.fromEmail = process.env.EMAIL_FROM || fallbackFrom;
  defaultTransportState.initialized = true;
}

function renderTemplate(templateString, data = {}) {
  if (!templateString) return '';
  return templateString.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
    const value = data[key];
    if (value === null || value === undefined) {
      return '';
    }
    return value.toString();
  });
}

function wrapPlainText(text = '') {
  const safeText = text || '';
  const escaped = safeText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n|\n\r|\r|\n/g, '<br>');

  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        ${escaped}
      </body>
    </html>
  `;
}

function formatFromAddress(name, email) {
  if (!email) {
    return defaultTransportState.fromEmail;
  }
  const trimmedName = (name || '').toString().trim();
  return trimmedName ? `${trimmedName} <${email}>` : email;
}

function formatCurrency(amount, currency = 'USD') {
  if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
    return '';
  }
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2
    }).format(Number(amount));
  } catch {
    return `$${Number(amount).toFixed(2)}`;
  }
}

function formatDateTime(value, timeZone) {
  if (!value) return '';
  try {
    const date = new Date(value);
    return date.toLocaleString('en-US', timeZone ? { timeZone } : undefined);
  } catch {
    return '';
  }
}

function getAuctionTitle(auction) {
  return (
    auction?.productData?.title ||
    auction?.productTitle ||
    auction?.title ||
    'your auction item'
  );
}

function getProductTitle(auction) {
  return auction?.productData?.title || auction?.productTitle || getAuctionTitle(auction);
}

function getTimeRemaining(endTime) {
  if (!endTime) return '';
  const now = new Date();
  const end = new Date(endTime);
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return 'Auction has ended';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Load email template from locale-specific directory
 */
async function loadLocalizedTemplate(shopDomain, templateKey) {
  try {
    const store = await Store.findOne({ shopDomain }).lean();
    const locale = (store?.primaryLanguage && ['en', 'pl', 'de', 'es', 'fr', 'it', 'nl', 'ar', 'ja', 'ko'].includes(store.primaryLanguage))
      ? store.primaryLanguage
      : 'en';
    
    const templateDir = path.join(__dirname, '..', 'email-templates', locale);
    const templateFile = path.join(templateDir, `${templateKey}.html`);
    const subjectFile = path.join(templateDir, 'subject.json');
    
    let html = null;
    let subject = null;
    
    // Try to load localized template
    if (fs.existsSync(templateFile)) {
      html = fs.readFileSync(templateFile, 'utf8');
    }
    
    // Try to load localized subject
    if (fs.existsSync(subjectFile)) {
      const subjects = JSON.parse(fs.readFileSync(subjectFile, 'utf8'));
      subject = subjects[templateKey] || null;
    }
    
    // Fallback to default if localized not found
    if (!html || !subject) {
      const defaults = DEFAULT_EMAIL_TEMPLATES[templateKey];
      if (defaults) {
        html = html || defaults.html;
        subject = subject || defaults.subject;
      }
    }
    
    return { html, subject };
  } catch (error) {
    console.warn(`Failed to load localized template for ${templateKey} (shop: ${shopDomain}):`, error.message);
    // Fallback to default
    const defaults = DEFAULT_EMAIL_TEMPLATES[templateKey];
    return {
      html: defaults?.html || '',
      subject: defaults?.subject || ''
    };
  }
}

function getDefaultTemplateConfig() {
  return EMAIL_TEMPLATE_KEYS.reduce((acc, key) => {
    const defaults = DEFAULT_EMAIL_TEMPLATES[key];
    acc[key] = {
      enabled: true,
      subject: defaults.subject,
      html: defaults.html,
      mode: defaults.mode === 'text' ? 'text' : 'html'
    };
    return acc;
  }, {});
}

async function getEffectiveEmailConfig(rawShopDomain) {
  const normalizedShop = normalizeEmailSettingsDomain(rawShopDomain);
  const baseConfig = {
    normalizedShop,
    plan: 'free',
    canCustomize: false,
    store: null,
    useCustomSmtp: false,
    smtp: {},
    templates: getDefaultTemplateConfig()
  };

  if (!normalizedShop) {
    return baseConfig;
  }

  const store = await Store.findOne({ shopDomain: normalizedShop }).lean();
  baseConfig.store = store || null;
  const plan = sanitizePlan(store?.plan || 'free');
  baseConfig.plan = plan;
  baseConfig.canCustomize = planMeetsRequirement(plan, CUSTOMIZATION_PLAN);

  const settings = await getEmailSettingsForShop(normalizedShop);
  baseConfig.useCustomSmtp =
    baseConfig.canCustomize &&
    settings.useCustomSmtp &&
    settings.smtp?.host &&
    settings.smtp?.user &&
    settings.smtp?.pass;
  baseConfig.smtp = settings.smtp || {};

  // Load localized templates
  const localizedTemplates = {};
  for (const key of EMAIL_TEMPLATE_KEYS) {
    const localized = await loadLocalizedTemplate(normalizedShop, key);
    localizedTemplates[key] = localized;
  }

  const mergedTemplates = {};
  EMAIL_TEMPLATE_KEYS.forEach((key) => {
    const defaults = DEFAULT_EMAIL_TEMPLATES[key];
    const localized = localizedTemplates[key];
    const custom = settings.templates?.[key];
    const enabled = baseConfig.canCustomize ? custom?.enabled !== false : true;
    
    // Priority: custom > localized > default
    const subject =
      baseConfig.canCustomize && custom?.subject?.trim()
        ? custom.subject.trim()
        : (localized?.subject || defaults.subject);
    const html =
      baseConfig.canCustomize && custom?.html?.trim()
        ? custom.html
        : (localized?.html || defaults.html);
    const defaultMode = defaults.mode === 'text' ? 'text' : 'html';
    const mode = baseConfig.canCustomize
      ? custom?.mode === 'text'
        ? 'text'
        : custom?.mode === 'html'
        ? 'html'
        : defaultMode
      : defaultMode;

    mergedTemplates[key] = { enabled, subject, html, mode };
  });
  baseConfig.templates = mergedTemplates;

  return baseConfig;
}

async function getTransportForShop(normalizedShop, emailConfig) {
  if (!emailConfig.useCustomSmtp) {
    initDefaultTransport();
    return defaultTransportState.transporter;
  }

  if (!normalizedShop) {
    throw new Error('Custom SMTP requires a shop domain.');
  }

  const cacheKey = `shop:${normalizedShop}`;
  if (transportCache.has(cacheKey)) {
    return transportCache.get(cacheKey);
  }

  const transporter = nodemailer.createTransport({
    host: emailConfig.smtp.host,
    port: emailConfig.smtp.port || 587,
    secure: emailConfig.smtp.secure ?? false,
    auth: {
      user: emailConfig.smtp.user,
      pass: emailConfig.smtp.pass
    }
  });

  transportCache.set(cacheKey, transporter);
  return transporter;
}

function buildAuctionTemplateData({ bidderName, auction, currency }) {
  return {
    customer_name: bidderName || '',
    display_name: bidderName || '',
    auction_title: getAuctionTitle(auction),
    product_title: getProductTitle(auction),
    auction_status: auction?.status || '',
    auction_end_time: formatDateTime(auction?.endTime, auction?.timezone || auction?.timeZone),
    current_bid:
      auction?.currentBid !== undefined && auction?.currentBid !== null
        ? formatCurrency(auction.currentBid, currency)
        : '',
    bid_count:
      typeof auction?.bidHistory?.length === 'number'
        ? String(auction.bidHistory.length)
        : '',
    buy_now_price:
      auction?.buyNowPrice !== undefined && auction?.buyNowPrice !== null
        ? formatCurrency(auction.buyNowPrice, currency)
        : '',
    winning_bid: '',
    bid_amount: '',
    time_remaining: getTimeRemaining(auction?.endTime)
  };
}

class EmailService {
  async sendBidConfirmation(shopDomain, bidderEmail, bidderName, auctionData, bidAmount, options = {}) {
    const currency = options.currency || auctionData?.currency || 'USD';
    const templateData = buildAuctionTemplateData({ bidderName, auction: auctionData, currency });
    templateData.bid_amount = formatCurrency(bidAmount, currency);
    templateData.current_bid = templateData.bid_amount;
    templateData.auction_status = auctionData?.status || 'active';

    return this.sendEmail(shopDomain, 'bidConfirmation', bidderEmail, null, null, templateData);
  }

  async sendAuctionWonNotification(shopDomain, bidderEmail, bidderName, auctionData, winningBid, options = {}) {
    const currency = options.currency || auctionData?.currency || 'USD';
    const templateData = buildAuctionTemplateData({ bidderName, auction: auctionData, currency });
    templateData.winning_bid = formatCurrency(winningBid, currency);
    templateData.current_bid = templateData.winning_bid;

    return this.sendEmail(shopDomain, 'winnerNotification', bidderEmail, null, null, templateData);
  }

  async sendWinnerNotification({ shopDomain, to, subject, html, templateData = {} }) {
    return this.sendEmail(shopDomain, 'winnerNotification', to, subject || null, html || null, templateData);
  }

  async sendOutbidNotification(shopDomain, bidderEmail, bidderName, auctionData, newHighestBid, options = {}) {
    const currency = options.currency || auctionData?.currency || 'USD';
    const templateData = buildAuctionTemplateData({ bidderName, auction: auctionData, currency });
    templateData.current_bid = formatCurrency(newHighestBid, currency);
    templateData.time_remaining = getTimeRemaining(auctionData?.endTime);
    templateData.cta_url = options.ctaUrl || DEFAULT_FRONTEND_URL;

    return this.sendEmail(shopDomain, 'outbidNotification', bidderEmail, null, null, templateData);
  }

  async sendAuctionEndingSoon(shopDomain, bidderEmail, bidderName, auctionData, timeRemaining, options = {}) {
    const currency = options.currency || auctionData?.currency || 'USD';
    const templateData = buildAuctionTemplateData({ bidderName, auction: auctionData, currency });
    templateData.time_remaining = timeRemaining || getTimeRemaining(auctionData?.endTime);
    templateData.cta_url = options.ctaUrl || DEFAULT_FRONTEND_URL;

    return this.sendEmail(shopDomain, 'auctionEndingSoon', bidderEmail, null, null, templateData);
  }

  async sendAdminNotification(shopDomain, subject, message, auctionData = null) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@auctions.com';
    const templateData = {
      admin_message: message || '',
      auction_title: auctionData ? getAuctionTitle(auctionData) : '',
      auction_status: auctionData?.status || '',
      current_bid:
        auctionData?.currentBid !== undefined && auctionData?.currentBid !== null
          ? formatCurrency(auctionData.currentBid, auctionData?.currency || 'USD')
          : '',
      bid_count:
        typeof auctionData?.bidHistory?.length === 'number'
          ? String(auctionData.bidHistory.length)
          : ''
    };

    return this.sendEmail(shopDomain, 'adminNotification', adminEmail, subject, null, templateData);
  }

  async sendEmail(shopDomain, type, to, subjectOverride, htmlOverride, templateData = {}) {
    if (!to) {
      throw new Error('Recipient email is required.');
    }

    const emailConfig = await getEffectiveEmailConfig(shopDomain);
    const template = emailConfig.templates[type];

    if (!template) {
      throw new Error(`Unknown email template type "${type}"`);
    }

    if (template.enabled === false) {
      console.log(`📭 Email template "${type}" disabled for ${emailConfig.normalizedShop || 'default'} — skipping send.`);
      return { success: true, skipped: true };
    }

    const resolvedData = {
      store_name: templateData.store_name || emailConfig.store?.storeName || emailConfig.normalizedShop || 'Bidly',
      shop_domain: emailConfig.normalizedShop || '',
      ...templateData
    };

    const subject = subjectOverride || renderTemplate(template.subject, resolvedData);
    const rawBody = htmlOverride || renderTemplate(template.html, resolvedData);
    const resolvedMode = template.mode === 'text' ? 'text' : 'html';
    const html = resolvedMode === 'text' ? wrapPlainText(rawBody) : rawBody;

    if (!subject.trim() || !html.trim()) {
      console.warn(`⚠️ Email template "${type}" produced empty subject or HTML.`);
      return { success: false, error: 'EMPTY_TEMPLATE' };
    }

    if (!emailConfig.useCustomSmtp) {
      initDefaultTransport();
    }

    if (!emailConfig.useCustomSmtp && !defaultTransportState.isConfigured) {
      console.log('\n📧 ===== EMAIL NOTIFICATION (DEMO MODE) =====');
      console.log(`📮 To: ${to}`);
      console.log(`📋 Subject: ${subject}`);
      console.log(`📄 Content: ${html.substring(0, 200)}...`);
      console.log('📧 ===========================================\n');
      return { success: true, messageId: 'demo-mode', demo: true };
    }

    try {
      const transporter = await getTransportForShop(emailConfig.normalizedShop, emailConfig);
      const mailOptions = {
        from: emailConfig.useCustomSmtp
          ? formatFromAddress(emailConfig.smtp.fromName || resolvedData.store_name, emailConfig.smtp.fromEmail || emailConfig.smtp.user)
          : defaultTransportState.fromEmail,
        to,
        subject,
        html
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error sending email:', error);
      return { success: false, error: error.message };
    }
  }
}

export function clearEmailTransportCache(shopDomain) {
  if (!shopDomain) return;
  const normalized = normalizeEmailSettingsDomain(shopDomain);
  if (!normalized) return;
  transportCache.delete(`shop:${normalized}`);
}

export default new EmailService();
