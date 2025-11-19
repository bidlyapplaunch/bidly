import express from 'express';
import nodemailer from 'nodemailer';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { identifyStore } from '../middleware/storeMiddleware.js';
import { attachPlanContext, getStorePlan } from '../middleware/planGuard.js';
import { planMeetsRequirement } from '../config/billingPlans.js';
import EmailSettings from '../models/EmailSettings.js';
import {
  DEFAULT_EMAIL_SETTINGS,
  EMAIL_TEMPLATE_KEYS,
  DEFAULT_EMAIL_TEMPLATES
} from '../constants/emailTemplates.js';
import { mergeWithDefaultEmailSettings } from '../services/emailSettingsService.js';
import emailService, { clearEmailTransportCache } from '../services/emailService.js';

const router = express.Router();
const CUSTOMIZATION_PLAN = 'pro';
const SUBJECT_LIMIT = 200;

router.use(optionalAuth);
router.use(identifyStore);
router.use(attachPlanContext);

function cloneDefaultSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_EMAIL_SETTINGS));
}

function sanitizeString(value) {
  if (value === undefined || value === null) return '';
  return value.toString().trim();
}

function applyPayloadToSettings(baseSettings, payload = {}) {
  const next = JSON.parse(JSON.stringify(baseSettings));
  const errors = [];

  if (payload.enabled !== undefined) {
    next.enabled = !!payload.enabled;
  }

  if (payload.useCustomSmtp !== undefined) {
    next.useCustomSmtp = !!payload.useCustomSmtp;
  }

  if (payload.smtp && typeof payload.smtp === 'object') {
    const smtp = payload.smtp;
    if (smtp.host !== undefined) next.smtp.host = sanitizeString(smtp.host);
    if (smtp.user !== undefined) next.smtp.user = sanitizeString(smtp.user);
    if (smtp.pass !== undefined) next.smtp.pass = smtp.pass ? smtp.pass.toString() : '';
    if (smtp.fromName !== undefined) next.smtp.fromName = sanitizeString(smtp.fromName);
    if (smtp.fromEmail !== undefined) next.smtp.fromEmail = sanitizeString(smtp.fromEmail);
    if (smtp.port !== undefined) {
      const parsed = Number(smtp.port);
      if (!Number.isNaN(parsed)) {
        next.smtp.port = parsed;
      }
    }
    if (smtp.secure !== undefined) {
      next.smtp.secure = !!smtp.secure;
    }
  }

  if (payload.templates && typeof payload.templates === 'object') {
    EMAIL_TEMPLATE_KEYS.forEach((key) => {
      const incoming = payload.templates[key];
      if (!incoming) return;

      if (incoming.subject !== undefined) {
        const trimmed = incoming.subject.toString();
        if (trimmed.length > SUBJECT_LIMIT) {
          errors.push(`Subject for "${key}" exceeds ${SUBJECT_LIMIT} characters.`);
        } else {
          next.templates[key].subject = trimmed;
        }
      }

      if (incoming.html !== undefined) {
        next.templates[key].html = incoming.html.toString();
      }

      if (incoming.enabled !== undefined) {
        next.templates[key].enabled = !!incoming.enabled;
      }
    });
  }

  return { nextSettings: next, errors };
}

function buildSampleTemplateData(storeName = 'Bidly Store') {
  return {
    customer_name: 'Jane Doe',
    display_name: 'Jane Doe',
    auction_title: 'Demo Auction Item',
    product_title: 'Exclusive Collectible',
    current_bid: '$250.00',
    winning_bid: '$300.00',
    buy_now_price: '$350.00',
    bid_amount: '$250.00',
    auction_end_time: new Date().toLocaleString(),
    time_remaining: '2 hours',
    store_name: storeName || 'Bidly Store',
    cta_url: 'https://example.com/auctions/demo',
    auction_status: 'Active',
    bid_count: '5',
    message: 'This is a test notification from Bidly.',
    admin_message: 'This is a demo admin message.',
    subject_override: 'Demo Subject'
  };
}

router.get('/', async (req, res) => {
  try {
    const plan = getStorePlan(req);
    const canCustomize = planMeetsRequirement(plan, CUSTOMIZATION_PLAN);

    const existing = await EmailSettings.findOne({ shopDomain: req.shopDomain }).lean();
    const settings = existing ? mergeWithDefaultEmailSettings(existing) : cloneDefaultSettings();

    return res.json({
      success: true,
      shopDomain: req.shopDomain,
      plan,
      canCustomize,
      hasCustom: !!existing,
      settings,
      defaults: {
        templates: DEFAULT_EMAIL_TEMPLATES
      }
    });
  } catch (error) {
    console.error('❌ Failed to load email settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load email settings'
    });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const plan = getStorePlan(req);
    if (!planMeetsRequirement(plan, CUSTOMIZATION_PLAN)) {
      return res.status(403).json({
        success: false,
        message: 'Mail customization is available on Pro and Enterprise plans.'
      });
    }

    const existing = await EmailSettings.findOne({ shopDomain: req.shopDomain }).lean();
    const baseSettings = existing ? mergeWithDefaultEmailSettings(existing) : cloneDefaultSettings();

    const { nextSettings, errors } = applyPayloadToSettings(baseSettings, req.body || {});
    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    const updated = await EmailSettings.findOneAndUpdate(
      { shopDomain: req.shopDomain },
      {
        $set: {
          enabled: nextSettings.enabled,
          useCustomSmtp: nextSettings.useCustomSmtp,
          smtp: nextSettings.smtp,
          templates: nextSettings.templates,
          updatedAt: new Date()
        },
        $setOnInsert: {
          shopDomain: req.shopDomain,
          createdAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    clearEmailTransportCache(req.shopDomain);

    return res.json({
      success: true,
      settings: mergeWithDefaultEmailSettings(updated.toObject())
    });
  } catch (error) {
    console.error('❌ Failed to save email settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save email settings'
    });
  }
});

router.post('/test-smtp', requireAuth, async (req, res) => {
  try {
    const plan = getStorePlan(req);
    if (!planMeetsRequirement(plan, CUSTOMIZATION_PLAN)) {
      return res.status(403).json({
        success: false,
        message: 'SMTP tests are available on Pro and Enterprise plans.'
      });
    }

    const incoming = req.body?.smtp || req.body || {};
    const existing = await EmailSettings.findOne({ shopDomain: req.shopDomain }).lean();
    const fallback = existing?.smtp || {};

    const smtpConfig = {
      host: sanitizeString(incoming.host || fallback.host),
      port: Number(
        incoming.port !== undefined
          ? incoming.port
          : fallback.port !== undefined
          ? fallback.port
          : 587
      ),
      secure:
        incoming.secure !== undefined
          ? !!incoming.secure
          : fallback.secure !== undefined
          ? !!fallback.secure
          : false,
      user: sanitizeString(incoming.user || fallback.user),
      pass: incoming.pass !== undefined ? incoming.pass.toString() : fallback.pass || '',
      fromName: sanitizeString(incoming.fromName || fallback.fromName || req.store?.storeName || 'Bidly'),
      fromEmail: sanitizeString(incoming.fromEmail || fallback.fromEmail || incoming.user || fallback.user)
    };

    const validationErrors = [];
    if (!smtpConfig.host) validationErrors.push('SMTP host is required.');
    if (!smtpConfig.user) validationErrors.push('SMTP username is required.');
    if (!smtpConfig.pass) validationErrors.push('SMTP password is required.');
    if (!smtpConfig.fromEmail) validationErrors.push('From email is required.');

    if (validationErrors.length) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    const testRecipient =
      sanitizeString(req.body?.testEmail) ||
      req.store?.storeEmail ||
      process.env.ADMIN_EMAIL ||
      'admin@auctions.com';

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port || 587,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass
      }
    });

    await transporter.sendMail({
      from: sanitizeString(smtpConfig.fromName)
        ? `${smtpConfig.fromName} <${smtpConfig.fromEmail}>`
        : smtpConfig.fromEmail,
      to: testRecipient,
      subject: 'Bidly mail service test',
      text: 'This is a test email from your Bidly mail service configuration.',
      html: '<p>This is a <strong>test email</strong> from your Bidly mail service configuration.</p>'
    });

    return res.json({
      success: true,
      message: `Test email sent to ${testRecipient}`
    });
  } catch (error) {
    console.error('❌ SMTP test failed:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'SMTP test failed'
    });
  }
});

router.post('/test-template', requireAuth, async (req, res) => {
  try {
    const plan = getStorePlan(req);
    if (!planMeetsRequirement(plan, CUSTOMIZATION_PLAN)) {
      return res.status(403).json({
        success: false,
        message: 'Template tests are available on Pro and Enterprise plans.'
      });
    }

    const { templateKey, to, overrides = {} } = req.body || {};
    if (!templateKey || !EMAIL_TEMPLATE_KEYS.includes(templateKey)) {
      return res.status(400).json({
        success: false,
        message: 'A valid templateKey is required.'
      });
    }

    const recipient = typeof to === 'string' ? to.trim() : '';
    if (!recipient) {
      return res.status(400).json({
        success: false,
        message: 'A valid test recipient email is required.'
      });
    }

    const defaults = DEFAULT_EMAIL_TEMPLATES[templateKey] || { subject: '', html: '' };
    const subjectOverride =
      typeof overrides.subject === 'string' && overrides.subject.trim()
        ? overrides.subject
        : defaults.subject;
    const htmlOverride =
      typeof overrides.html === 'string' && overrides.html.trim()
        ? overrides.html
        : defaults.html;

    const templateData = buildSampleTemplateData(req.store?.storeName);

    const result = await emailService.sendEmail(
      req.shopDomain,
      templateKey,
      recipient,
      subjectOverride,
      htmlOverride,
      templateData
    );

    if (!result?.success) {
      throw new Error(result?.error || 'Unable to send test email.');
    }

    return res.json({
      success: true,
      message: `Template test sent to ${recipient}.`
    });
  } catch (error) {
    console.error('❌ Template test failed:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to send template test email.'
    });
  }
});

export default router;

