# Blast Email & Customer List Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add customer email listing, blast/push email composition with trickle delivery, and rich text editing to the Mail Service section of the admin dashboard.

**Architecture:** Tab-based UI in the existing Mail Service page (Email Templates | Customer List | Blast Emails). New `BlastEmail` MongoDB model stores drafts and sent history. Backend blast service handles batch/trickle sending via `setTimeout` with crash recovery on restart. Rich text editor (`react-quill-new`) replaces the broken simple editor across all email surfaces.

**Tech Stack:** Express.js, MongoDB/Mongoose, react-quill-new, DOMPurify, Shopify Polaris, React Router

**Spec:** `docs/superpowers/specs/2026-03-16-blast-email-customer-list-design.md`

---

## Chunk 1: Backend Models & Customer Schema Update

### Task 1: BlastEmail Mongoose Model

**Files:**
- Create: `auction-backend/models/BlastEmail.js`

- [ ] **Step 1: Create the BlastEmail model**

```javascript
import mongoose from 'mongoose';

const recipientSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  email: { type: String, required: true },
  displayName: { type: String, default: '' },
  customerName: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending'
  },
  sentAt: { type: Date },
  error: { type: String }
}, { _id: false });

const blastEmailSchema = new mongoose.Schema({
  shopDomain: {
    type: String,
    required: true,
    index: true
  },
  subject: {
    type: String,
    required: true,
    maxlength: 200
  },
  body: {
    type: String,
    required: true,
    maxlength: 512000 // 500KB
  },
  status: {
    type: String,
    enum: ['draft', 'sending', 'completed', 'failed'],
    default: 'draft'
  },
  deliveryMode: {
    type: String,
    enum: ['all', 'trickle'],
    default: 'all'
  },
  trickleConfig: {
    batchSize: { type: Number, default: 50, min: 1, max: 500 },
    intervalMinutes: { type: Number, default: 5, min: 1, max: 60 }
  },
  recipients: [recipientSchema],
  stats: {
    total: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 }
  },
  sentAt: { type: Date }
}, {
  timestamps: true
});

blastEmailSchema.index({ shopDomain: 1, status: 1 });
blastEmailSchema.index({ shopDomain: 1, createdAt: -1 });

const BlastEmail = mongoose.model('BlastEmail', blastEmailSchema);
export default BlastEmail;
```

- [ ] **Step 2: Verify model loads without errors**

Run: `cd auction-backend && node -e "import('./models/BlastEmail.js').then(() => console.log('OK')).catch(e => console.error(e))"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add auction-backend/models/BlastEmail.js
git commit -m "feat: add BlastEmail mongoose model"
```

---

### Task 2: Add `unsubscribed` field to Customer model

**Files:**
- Modify: `auction-backend/models/Customer.js:152` (after `lastLoginAt`, before `shopifyMetafields`)

- [ ] **Step 1: Add the unsubscribed field**

In `auction-backend/models/Customer.js`, add this field after the `lastLoginAt` field (line ~152) and before the `shopifyMetafields` block (line ~155):

```javascript
  unsubscribed: {
    type: Boolean,
    default: false
  },
```

- [ ] **Step 2: Verify model loads**

Run: `cd auction-backend && node -e "import('./models/Customer.js').then(() => console.log('OK')).catch(e => console.error(e))"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add auction-backend/models/Customer.js
git commit -m "feat: add unsubscribed field to Customer model"
```

---

## Chunk 2: Backend Services

### Task 3: Blast Email Service

**Files:**
- Create: `auction-backend/services/blastEmailService.js`

This service handles sending blasts (all-at-once and trickle), crash recovery, and progress tracking. It bypasses `emailService.sendEmail()` (which requires a known template type) and instead uses the transport resolution directly to send raw pre-rendered HTML. It reuses `getTransportForShop()` pattern for SMTP transport.

**Important:** `emailService.sendEmail()` throws on unknown template types (line 426: `Unknown email template type`). Blast emails don't map to any existing template key, so we must use the transporter directly.

- [ ] **Step 1: Create the blast email service**

```javascript
import crypto from 'crypto';
import BlastEmail from '../models/BlastEmail.js';
import Customer from '../models/Customer.js';
import Store from '../models/Store.js';
import EmailSettings from '../models/EmailSettings.js';
import emailService from './emailService.js';

// In-memory map of active trickle timers: blastId -> timeoutId
const activeTrickles = new Map();

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || 'bidly-unsubscribe-key';

/**
 * Generate HMAC token for unsubscribe link verification.
 */
export function generateUnsubscribeToken(email, shopDomain) {
  return crypto.createHmac('sha256', UNSUBSCRIBE_SECRET)
    .update(email.toLowerCase() + shopDomain)
    .digest('hex');
}

/**
 * Verify HMAC token for unsubscribe link.
 */
export function verifyUnsubscribeToken(email, shopDomain, token) {
  const expected = generateUnsubscribeToken(email, shopDomain);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

/**
 * Render template tokens in a string.
 */
function renderTemplate(str, data = {}) {
  if (!str) return '';
  return str.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
    const value = data[key];
    if (value === null || value === undefined) return '';
    return value.toString();
  });
}

/**
 * Resolve recipients for a blast.
 * If selectAll, queries all non-unsubscribed customers for the shop.
 * If recipientIds provided, queries those specific customers.
 */
async function resolveRecipients(shopDomain, selectAll, recipientIds = []) {
  const query = { shopDomain, unsubscribed: { $ne: true } };
  if (!selectAll && recipientIds.length > 0) {
    query._id = { $in: recipientIds };
  }
  const customers = await Customer.find(query)
    .select('_id email displayName firstName lastName')
    .lean();

  return customers.map(c => ({
    customerId: c._id,
    email: c.email,
    displayName: c.displayName || c.email,
    customerName: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.displayName || c.email,
    status: 'pending'
  }));
}

/**
 * Get the email transporter for a shop (custom SMTP or default).
 * Uses emailService's sendEmail with adminNotification type but we actually
 * need direct transport access. We replicate the transport logic here.
 */
async function getShopTransporter(shopDomain) {
  // Get the effective email config to determine SMTP settings
  const settings = await EmailSettings.findOne({ shopDomain }).lean();

  if (settings?.useCustomSmtp && settings?.smtp?.host) {
    const { default: nodemailer } = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: settings.smtp.host,
      port: settings.smtp.port || 587,
      secure: settings.smtp.secure ?? false,
      auth: {
        user: settings.smtp.user,
        pass: settings.smtp.pass
      }
    });
    const fromEmail = settings.smtp.fromEmail || settings.smtp.user;
    const fromName = settings.smtp.fromName || 'Bidly';
    return { transporter, from: `"${fromName}" <${fromEmail}>` };
  }

  // Use default transport
  const { default: nodemailer } = await import('nodemailer');
  const host = process.env.EMAIL_HOST;
  const service = process.env.EMAIL_SERVICE || 'gmail';
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    // Demo mode — log instead of sending
    return { transporter: null, from: null, demo: true };
  }

  const transportConfig = host
    ? { host, port: parseInt(process.env.EMAIL_PORT || '587'), secure: process.env.EMAIL_SECURE === 'true', auth: { user, pass } }
    : { service, auth: { user, pass } };

  const transporter = nodemailer.createTransport(transportConfig);
  const from = process.env.EMAIL_FROM || user;
  return { transporter, from };
}

/**
 * Send a single email for a blast recipient.
 */
async function sendOneEmail(shopDomain, storeName, blast, recipient, transport) {
  const templateData = {
    customer_name: recipient.customerName || recipient.displayName,
    display_name: recipient.displayName,
    store_name: storeName
  };

  const renderedSubject = renderTemplate(blast.subject, templateData);
  const renderedBody = renderTemplate(blast.body, templateData);

  // Add unsubscribe footer with HMAC token
  const token = generateUnsubscribeToken(recipient.email, shopDomain);
  const unsubscribeUrl = `${process.env.BACKEND_URL || ''}/api/email-settings/unsubscribe?email=${encodeURIComponent(recipient.email)}&shop=${encodeURIComponent(shopDomain)}&token=${token}`;
  const bodyWithFooter = renderedBody + `
    <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center;">
      <a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a>
    </div>`;

  if (transport.demo) {
    console.log(`📧 [DEMO] Blast to ${recipient.email}: ${renderedSubject}`);
    return { success: true, messageId: 'demo-mode', demo: true };
  }

  const result = await transport.transporter.sendMail({
    from: transport.from,
    to: recipient.email,
    subject: renderedSubject,
    html: bodyWithFooter
  });

  return { success: true, messageId: result.messageId };
}

/**
 * Send a batch of recipients. Updates DB after each send.
 */
async function sendBatch(blastId, startIndex, batchSize) {
  const blast = await BlastEmail.findById(blastId);
  if (!blast || blast.status !== 'sending') return;

  const store = await Store.findOne({ shopDomain: blast.shopDomain }).lean();
  const storeName = store?.storeName || blast.shopDomain;
  const transport = await getShopTransporter(blast.shopDomain);

  const batch = blast.recipients.slice(startIndex, startIndex + batchSize);
  let batchFailed = 0;

  for (const recipient of batch) {
    if (recipient.status !== 'pending') continue;

    try {
      const result = await sendOneEmail(blast.shopDomain, storeName, blast, recipient, transport);
      if (result.success) {
        recipient.status = 'sent';
        recipient.sentAt = new Date();
        blast.stats.sent += 1;
      } else {
        recipient.status = 'failed';
        recipient.error = result.error || 'Send failed';
        blast.stats.failed += 1;
        batchFailed += 1;
      }
    } catch (err) {
      recipient.status = 'failed';
      recipient.error = err.message;
      blast.stats.failed += 1;
      batchFailed += 1;
    }
  }

  await blast.save();

  // If >50% of batch failed, abort
  if (batch.length > 0 && batchFailed / batch.length > 0.5) {
    blast.status = 'failed';
    await blast.save();
    activeTrickles.delete(blastId.toString());
    return;
  }

  return blast;
}

/**
 * Send blast — all at once.
 */
async function sendAllAtOnce(blastId) {
  const blast = await BlastEmail.findById(blastId);
  if (!blast) return;

  await sendBatch(blastId, 0, blast.recipients.length);

  const updated = await BlastEmail.findById(blastId);
  if (updated && updated.status === 'sending') {
    updated.status = 'completed';
    await updated.save();
  }
}

/**
 * Send blast — trickle mode. Sends one batch, schedules next.
 */
async function sendTrickleBatch(blastId, batchIndex = 0) {
  const blast = await BlastEmail.findById(blastId);
  if (!blast || blast.status !== 'sending') {
    activeTrickles.delete(blastId.toString());
    return;
  }

  const { batchSize, intervalMinutes } = blast.trickleConfig;
  const startIndex = batchIndex * batchSize;

  // All batches done?
  if (startIndex >= blast.recipients.length) {
    blast.status = 'completed';
    await blast.save();
    activeTrickles.delete(blastId.toString());
    return;
  }

  const result = await sendBatch(blastId, startIndex, batchSize);
  if (!result || result.status === 'failed') {
    activeTrickles.delete(blastId.toString());
    return;
  }

  // Schedule next batch
  const nextBatchIndex = batchIndex + 1;
  const nextStartIndex = nextBatchIndex * batchSize;
  if (nextStartIndex < blast.recipients.length) {
    const timeoutId = setTimeout(
      () => sendTrickleBatch(blastId, nextBatchIndex),
      intervalMinutes * 60 * 1000
    );
    activeTrickles.set(blastId.toString(), timeoutId);
  } else {
    const updated = await BlastEmail.findById(blastId);
    if (updated && updated.status === 'sending') {
      updated.status = 'completed';
      await updated.save();
    }
    activeTrickles.delete(blastId.toString());
  }
}

/**
 * Start sending a blast email.
 */
export async function sendBlast(blastId) {
  const blast = await BlastEmail.findById(blastId);
  if (!blast) throw new Error('Blast not found');
  if (blast.status === 'sending') throw new Error('Blast is already sending');

  blast.status = 'sending';
  blast.sentAt = new Date();
  await blast.save();

  if (blast.deliveryMode === 'trickle') {
    sendTrickleBatch(blastId, 0);
  } else {
    sendAllAtOnce(blastId);
  }
}

/**
 * Resume interrupted blasts on server startup.
 */
export async function resumeInterruptedBlasts() {
  const interrupted = await BlastEmail.find({ status: 'sending' });
  for (const blast of interrupted) {
    console.log(`Resuming interrupted blast: ${blast._id} for ${blast.shopDomain}`);
    const firstPendingIndex = blast.recipients.findIndex(r => r.status === 'pending');
    if (firstPendingIndex === -1) {
      blast.status = 'completed';
      await blast.save();
      continue;
    }

    if (blast.deliveryMode === 'trickle') {
      const batchIndex = Math.floor(firstPendingIndex / blast.trickleConfig.batchSize);
      sendTrickleBatch(blast._id, batchIndex);
    } else {
      sendBatch(blast._id, firstPendingIndex, blast.recipients.length - firstPendingIndex)
        .then(async () => {
          const updated = await BlastEmail.findById(blast._id);
          if (updated && updated.status === 'sending') {
            updated.status = 'completed';
            await updated.save();
          }
        });
    }
  }
}

/**
 * Get progress stats for a blast.
 */
export async function getBlastProgress(blastId) {
  const blast = await BlastEmail.findById(blastId).select('status stats recipients.status').lean();
  if (!blast) return null;
  return {
    status: blast.status,
    stats: blast.stats,
    total: blast.recipients.length
  };
}

export { resolveRecipients };
```

- [ ] **Step 2: Verify service loads without errors**

Run: `cd auction-backend && node -e "import('./services/blastEmailService.js').then(() => console.log('OK')).catch(e => console.error(e))"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add auction-backend/services/blastEmailService.js
git commit -m "feat: add blast email service with trickle delivery and crash recovery"
```

---

## Chunk 3: Backend Routes

### Task 4: Customer List Endpoint

**Files:**
- Modify: `auction-backend/routes/emailSettings.js`

Add a new endpoint for listing customers. This goes in the existing email settings router, after the existing route definitions (before the `export default router` line at ~354).

- [ ] **Step 1: Add the customer list route**

Import `Customer` at the top of `auction-backend/routes/emailSettings.js` (after existing imports, around line 14):

```javascript
import Customer from '../models/Customer.js';
```

Add the route before the `export default router;` line:

```javascript
// ── Customer list for blast emails ──────────────────────────────
router.get('/customers', requireAuth, async (req, res) => {
  try {
    const shopDomain = req.shopDomain;
    if (!shopDomain) {
      return res.status(400).json({ error: 'Shop domain is required' });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const search = req.query.search?.trim();

    const query = { shopDomain };
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { email: regex },
        { displayName: regex },
        { firstName: regex },
        { lastName: regex }
      ];
    }

    const [customers, total] = await Promise.all([
      Customer.find(query)
        .select('email displayName firstName lastName totalBids auctionsWon unsubscribed')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Customer.countDocuments(query)
    ]);

    res.json({ customers, total, page, limit });
  } catch (error) {
    console.error('Failed to load customers:', error);
    res.status(500).json({ error: 'Failed to load customers' });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add auction-backend/routes/emailSettings.js
git commit -m "feat: add customer list endpoint for mail service"
```

---

### Task 5: Blast Email Routes

**Files:**
- Create: `auction-backend/routes/blastEmailRoutes.js`

- [ ] **Step 1: Create the blast email routes file**

```javascript
import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { identifyStore } from '../middleware/storeMiddleware.js';
import { attachPlanContext } from '../middleware/planGuard.js';
import { planMeetsRequirement } from '../config/billingPlans.js';
import BlastEmail from '../models/BlastEmail.js';
import Customer from '../models/Customer.js';
import { sendBlast, resolveRecipients, getBlastProgress } from '../services/blastEmailService.js';

const router = express.Router();

router.use(identifyStore);
router.use(requireAuth);
router.use(attachPlanContext);

const PLAN_REQUIRED = 'pro';

// Plan check middleware
const requirePlan = (req, res, next) => {
  const plan = req.storePlan || 'free';
  if (!planMeetsRequirement(plan, PLAN_REQUIRED)) {
    return res.status(403).json({ error: 'Upgrade to Pro to use blast emails' });
  }
  next();
};

// ── List blasts ─────────────────────────────────────────────────
router.get('/', requirePlan, async (req, res) => {
  try {
    const shopDomain = req.shopDomain;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

    const [blasts, total] = await Promise.all([
      BlastEmail.find({ shopDomain })
        .select('subject status deliveryMode stats createdAt sentAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      BlastEmail.countDocuments({ shopDomain })
    ]);

    res.json({ blasts, total, page, limit });
  } catch (error) {
    console.error('Failed to list blasts:', error);
    res.status(500).json({ error: 'Failed to list blasts' });
  }
});

// ── Get single blast with recipients ────────────────────────────
router.get('/:id', requirePlan, async (req, res) => {
  try {
    const blast = await BlastEmail.findOne({
      _id: req.params.id,
      shopDomain: req.shopDomain
    }).lean();

    if (!blast) {
      return res.status(404).json({ error: 'Blast not found' });
    }

    res.json({ blast });
  } catch (error) {
    console.error('Failed to get blast:', error);
    res.status(500).json({ error: 'Failed to get blast' });
  }
});

// ── Get blast progress (lightweight) ────────────────────────────
router.get('/:id/progress', requirePlan, async (req, res) => {
  try {
    const progress = await getBlastProgress(req.params.id);
    if (!progress) {
      return res.status(404).json({ error: 'Blast not found' });
    }
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get progress' });
  }
});

// ── Create blast ────────────────────────────────────────────────
router.post('/', requirePlan, async (req, res) => {
  try {
    const shopDomain = req.shopDomain;
    const {
      subject, body, deliveryMode = 'all',
      trickleConfig, recipientIds, saveAsDraft = false
    } = req.body;
    // Default selectAll based on whether recipientIds were provided
    const selectAll = req.body.selectAll ?? (!recipientIds || recipientIds.length === 0);

    // Validation
    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      return res.status(400).json({ error: 'Subject is required' });
    }
    if (subject.length > 200) {
      return res.status(400).json({ error: 'Subject must be 200 characters or less' });
    }
    if (!body || typeof body !== 'string' || body.trim().length === 0) {
      return res.status(400).json({ error: 'Body is required' });
    }
    if (body.length > 512000) {
      return res.status(400).json({ error: 'Body exceeds maximum size (500KB)' });
    }
    if (selectAll && recipientIds && recipientIds.length > 0) {
      return res.status(400).json({ error: 'Cannot use both selectAll and recipientIds' });
    }
    if (!selectAll && (!recipientIds || recipientIds.length === 0)) {
      return res.status(400).json({ error: 'recipientIds required when selectAll is false' });
    }

    // Validate trickle config
    if (deliveryMode === 'trickle' && trickleConfig) {
      if (trickleConfig.batchSize && (trickleConfig.batchSize < 1 || trickleConfig.batchSize > 500)) {
        return res.status(400).json({ error: 'Batch size must be between 1 and 500' });
      }
      if (trickleConfig.intervalMinutes && (trickleConfig.intervalMinutes < 1 || trickleConfig.intervalMinutes > 60)) {
        return res.status(400).json({ error: 'Interval must be between 1 and 60 minutes' });
      }
    }

    // Check max concurrent sending
    if (!saveAsDraft) {
      const activeSending = await BlastEmail.countDocuments({
        shopDomain,
        status: 'sending'
      });
      if (activeSending > 0) {
        return res.status(409).json({ error: 'Another blast is currently sending. Wait for it to complete.' });
      }
    }

    // Resolve recipients
    const recipients = await resolveRecipients(shopDomain, selectAll, recipientIds);
    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No eligible recipients found' });
    }
    if (recipients.length > 10000) {
      return res.status(400).json({ error: 'Maximum 10,000 recipients per blast' });
    }

    const blast = new BlastEmail({
      shopDomain,
      subject: subject.trim(),
      body,
      status: saveAsDraft ? 'draft' : 'draft', // Will be set to 'sending' by sendBlast
      deliveryMode,
      trickleConfig: deliveryMode === 'trickle' ? {
        batchSize: trickleConfig?.batchSize || 50,
        intervalMinutes: trickleConfig?.intervalMinutes || 5
      } : undefined,
      recipients,
      stats: { total: recipients.length, sent: 0, failed: 0 }
    });

    await blast.save();

    if (!saveAsDraft) {
      await sendBlast(blast._id);
    }

    res.status(201).json({ blast: { _id: blast._id, status: blast.status, stats: blast.stats } });
  } catch (error) {
    console.error('Failed to create blast:', error);
    res.status(500).json({ error: error.message || 'Failed to create blast' });
  }
});

// ── Update draft ────────────────────────────────────────────────
router.put('/:id', requirePlan, async (req, res) => {
  try {
    const blast = await BlastEmail.findOne({
      _id: req.params.id,
      shopDomain: req.shopDomain
    });

    if (!blast) {
      return res.status(404).json({ error: 'Blast not found' });
    }
    if (blast.status !== 'draft') {
      return res.status(400).json({ error: 'Only drafts can be edited' });
    }

    const { subject, body, deliveryMode, trickleConfig, recipientIds, selectAll } = req.body;

    if (subject !== undefined) {
      if (subject.length > 200) return res.status(400).json({ error: 'Subject too long' });
      blast.subject = subject.trim();
    }
    if (body !== undefined) {
      if (body.length > 512000) return res.status(400).json({ error: 'Body too large' });
      blast.body = body;
    }
    if (deliveryMode !== undefined) blast.deliveryMode = deliveryMode;
    if (trickleConfig !== undefined) blast.trickleConfig = trickleConfig;

    // Re-resolve recipients if changed
    if (selectAll !== undefined || recipientIds !== undefined) {
      const recipients = await resolveRecipients(
        req.shopDomain,
        selectAll ?? true,
        recipientIds || []
      );
      if (recipients.length === 0) {
        return res.status(400).json({ error: 'No eligible recipients found' });
      }
      if (recipients.length > 10000) {
        return res.status(400).json({ error: 'Maximum 10,000 recipients per blast' });
      }
      blast.recipients = recipients;
      blast.stats = { total: recipients.length, sent: 0, failed: 0 };
    }

    await blast.save();
    res.json({ blast: { _id: blast._id, subject: blast.subject, status: blast.status, stats: blast.stats } });
  } catch (error) {
    console.error('Failed to update blast:', error);
    res.status(500).json({ error: 'Failed to update blast' });
  }
});

// ── Send a draft ────────────────────────────────────────────────
router.post('/:id/send', requirePlan, async (req, res) => {
  try {
    const blast = await BlastEmail.findOne({
      _id: req.params.id,
      shopDomain: req.shopDomain
    });

    if (!blast) {
      return res.status(404).json({ error: 'Blast not found' });
    }
    if (blast.status !== 'draft') {
      return res.status(400).json({ error: 'Only drafts can be sent' });
    }

    // Check max concurrent
    const activeSending = await BlastEmail.countDocuments({
      shopDomain: req.shopDomain,
      status: 'sending'
    });
    if (activeSending > 0) {
      return res.status(409).json({ error: 'Another blast is currently sending' });
    }

    await sendBlast(blast._id);
    res.json({ message: 'Blast sending started', blastId: blast._id });
  } catch (error) {
    console.error('Failed to send blast:', error);
    res.status(500).json({ error: error.message || 'Failed to send blast' });
  }
});

// ── Delete a draft ──────────────────────────────────────────────
router.delete('/:id', requirePlan, async (req, res) => {
  try {
    const blast = await BlastEmail.findOne({
      _id: req.params.id,
      shopDomain: req.shopDomain
    });

    if (!blast) {
      return res.status(404).json({ error: 'Blast not found' });
    }
    if (blast.status !== 'draft') {
      return res.status(400).json({ error: 'Only drafts can be deleted' });
    }

    await BlastEmail.deleteOne({ _id: blast._id });
    res.json({ message: 'Draft deleted' });
  } catch (error) {
    console.error('Failed to delete blast:', error);
    res.status(500).json({ error: 'Failed to delete blast' });
  }
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add auction-backend/routes/blastEmailRoutes.js
git commit -m "feat: add blast email CRUD and send routes"
```

---

### Task 6: Unsubscribe Endpoint

**Files:**
- Modify: `auction-backend/routes/emailSettings.js`

Add the unsubscribe endpoint to the existing email settings router. This is a public endpoint (no auth required) — customers click it from their email.

- [ ] **Step 1: Add the unsubscribe route**

Add import at the top of `auction-backend/routes/emailSettings.js` (after other imports):

```javascript
import { verifyUnsubscribeToken } from '../services/blastEmailService.js';
```

Add before the `export default router;` line:

```javascript
// ── Unsubscribe (public, no auth, HMAC-verified) ────────────────
router.get('/unsubscribe', async (req, res) => {
  try {
    const { email, shop, token } = req.query;
    if (!email || !shop || !token) {
      return res.status(400).send('<h1>Invalid unsubscribe link</h1>');
    }

    // Verify HMAC token to prevent unauthorized unsubscribes
    try {
      const valid = verifyUnsubscribeToken(email.toLowerCase().trim(), shop, token);
      if (!valid) {
        return res.status(403).send('<h1>Invalid unsubscribe link</h1>');
      }
    } catch {
      return res.status(403).send('<h1>Invalid unsubscribe link</h1>');
    }

    const customer = await Customer.findOneAndUpdate(
      { email: email.toLowerCase().trim(), shopDomain: shop },
      { unsubscribed: true },
      { new: true }
    );

    if (!customer) {
      return res.status(404).send('<h1>Subscription not found</h1>');
    }

    res.send(`
      <!DOCTYPE html>
      <html><head><title>Unsubscribed</title></head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 60px;">
        <h1>You have been unsubscribed</h1>
        <p>You will no longer receive marketing emails from this store.</p>
      </body></html>
    `);
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).send('<h1>Something went wrong</h1>');
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add auction-backend/routes/emailSettings.js
git commit -m "feat: add public unsubscribe endpoint"
```

---

### Task 7: Mount Blast Routes & Crash Recovery in server.js

**Files:**
- Modify: `auction-backend/server.js:354` (route mounting area) and `server.js:100-108` (DB connection callback)

- [ ] **Step 1: Import and mount blast routes**

Add import near other route imports at the top of `server.js`:

```javascript
import blastEmailRoutes from './routes/blastEmailRoutes.js';
```

Add route mount after the existing email settings route (line ~354):

```javascript
app.use('/api/email-settings/blasts', blastEmailRoutes);
```

**Important:** This line must come BEFORE the `app.use('/api/email-settings', emailSettingsRoutes)` line, because Express matches routes top-down. If `/api/email-settings` is mounted first, requests to `/api/email-settings/blasts` would be caught by the email settings router. Move the blast routes mount above.

- [ ] **Step 2: Add crash recovery to DB connection callback**

Add import at the top of `server.js`:

```javascript
import { resumeInterruptedBlasts } from './services/blastEmailService.js';
```

In the `connectDB().then()` callback (around line 100-108), add `resumeInterruptedBlasts()` after existing startup tasks:

```javascript
connectDB()
  .then(async () => {
    console.log('✅ MongoDB connected');
    await fixCustomerIndexes();
    // Resume any interrupted blast email sends
    resumeInterruptedBlasts().catch(err =>
      console.error('Failed to resume interrupted blasts:', err)
    );
  })
```

- [ ] **Step 3: Commit**

```bash
git add auction-backend/server.js
git commit -m "feat: mount blast email routes and add crash recovery on startup"
```

---

## Chunk 4: Frontend — Rich Text Editor & Dependencies

### Task 8: Install Frontend Dependencies

**Files:**
- Modify: `auction-admin/package.json`

- [ ] **Step 1: Install react-quill-new and dompurify**

```bash
cd auction-admin && npm install react-quill-new dompurify
```

- [ ] **Step 2: Commit**

```bash
git add auction-admin/package.json auction-admin/package-lock.json
git commit -m "feat: add react-quill-new and dompurify dependencies"
```

---

### Task 9: RichTextEditor Wrapper Component

**Files:**
- Create: `auction-admin/src/components/RichTextEditor.jsx`

This is a reusable wrapper around `react-quill-new` used by both email templates and blast emails.

- [ ] **Step 1: Create the RichTextEditor component**

```jsx
import { useCallback, useMemo } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: [] }, { background: [] }],
  [{ align: [] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link', 'image'],
  ['clean']
];

function RichTextEditor({ value, onChange, disabled = false, placeholder = '' }) {
  const modules = useMemo(() => ({
    toolbar: disabled ? false : TOOLBAR_OPTIONS
  }), [disabled]);

  const handleChange = useCallback((content) => {
    if (onChange) {
      onChange(content);
    }
  }, [onChange]);

  return (
    <div style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <ReactQuill
        theme="snow"
        value={value || ''}
        onChange={handleChange}
        modules={modules}
        placeholder={placeholder}
        readOnly={disabled}
        style={{ minHeight: 200 }}
      />
    </div>
  );
}

export default RichTextEditor;
```

- [ ] **Step 2: Commit**

```bash
git add auction-admin/src/components/RichTextEditor.jsx
git commit -m "feat: add RichTextEditor wrapper component for react-quill-new"
```

---

### Task 10: Replace Simple/HTML Toggle with Rich/HTML in MailServiceSettings

**Files:**
- Modify: `auction-admin/src/components/MailServiceSettings.jsx`

Replace the simple/HTML editor mode toggle in the template section with Rich Editor / HTML.

- [ ] **Step 1: Import RichTextEditor**

Add at the top of `MailServiceSettings.jsx` (after existing imports, around line 12):

```javascript
import RichTextEditor from './RichTextEditor';
```

- [ ] **Step 2: Replace the editor mode buttons**

In the template rendering section (around lines 746-769), replace the Simple/HTML buttons. Find:

```jsx
<Button
  size="slim"
  primary={(template.mode || 'text') === 'text'}
  pressed={(template.mode || 'text') === 'text'}
  onClick={() => handleTemplateChange(key, 'mode', 'text')}
  disabled={disabled}
>
  {i18n.translate('admin.mail_service.templates.editorSimple')}
</Button>
<Button
  size="slim"
  primary={template.mode === 'html'}
  pressed={template.mode === 'html'}
  onClick={() => handleTemplateChange(key, 'mode', 'html')}
  disabled={disabled}
>
  {i18n.translate('admin.mail_service.templates.editorHtml')}
</Button>
```

Replace with:

```jsx
<Button
  size="slim"
  primary={(template.mode || 'rich') !== 'html'}
  pressed={(template.mode || 'rich') !== 'html'}
  onClick={() => handleTemplateChange(key, 'mode', 'rich')}
  disabled={disabled}
>
  Rich Editor
</Button>
<Button
  size="slim"
  primary={template.mode === 'html'}
  pressed={template.mode === 'html'}
  onClick={() => handleTemplateChange(key, 'mode', 'html')}
  disabled={disabled}
>
  HTML
</Button>
```

- [ ] **Step 3: Replace the template body editor**

Find the TextField used for the template body (around lines 770-783):

```jsx
<TextField
  label={
    template.mode === 'html'
      ? i18n.translate('admin.mail_service.templates.htmlLabel')
      : i18n.translate('admin.mail_service.templates.textLabel')
  }
  value={template.html}
  onChange={(value) => handleTemplateChange(key, 'html', value)}
  onFocus={() => handleTemplateFocus(key, 'html')}
  multiline={template.mode === 'html' ? 8 : 6}
  autoComplete="off"
  disabled={disabled}
  style={template.mode === 'html' ? { fontFamily: 'monospace' } : undefined}
/>
```

Replace with:

```jsx
{template.mode === 'html' ? (
  <TextField
    label="HTML"
    value={template.html}
    onChange={(value) => handleTemplateChange(key, 'html', value)}
    onFocus={() => handleTemplateFocus(key, 'html')}
    multiline={8}
    autoComplete="off"
    disabled={disabled}
    monospaced
  />
) : (
  <RichTextEditor
    value={template.html}
    onChange={(value) => handleTemplateChange(key, 'html', value)}
    disabled={disabled}
    placeholder="Compose your email..."
  />
)}
```

- [ ] **Step 4: Update default template mode**

In the `createDefaultSettings` function and `TEMPLATE_DEFAULTS`, templates that had `mode: 'text'` should now default to `mode: 'rich'`. In the `createDefaultSettings` function (around line 165-187), change:

```javascript
mode: defaults?.mode || 'text'
```

to:

```javascript
mode: defaults?.mode === 'html' ? 'html' : 'rich'
```

Do this in both occurrences in `createDefaultSettings` and `mergeSettings`.

- [ ] **Step 5: Commit**

```bash
git add auction-admin/src/components/MailServiceSettings.jsx
git commit -m "feat: replace simple editor with rich text editor in email templates"
```

---

## Chunk 5: Frontend — API Services

### Task 11: Customer & Blast Email API Services

**Files:**
- Modify: `auction-admin/src/services/emailSettingsApi.js` (add `getCustomers`)
- Create: `auction-admin/src/services/blastEmailApi.js`

- [ ] **Step 1: Add getCustomers to emailSettingsApi**

Add this method to the `emailSettingsAPI` object in `auction-admin/src/services/emailSettingsApi.js`:

```javascript
  getCustomers: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);
    if (params.search) query.set('search', params.search);
    const response = await api.get(`/email-settings/customers?${query.toString()}`);
    return response.data;
  },
```

- [ ] **Step 2: Create blastEmailApi.js**

```javascript
import api from './api';

export const blastEmailAPI = {
  list: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);
    const response = await api.get(`/email-settings/blasts?${query.toString()}`);
    return response.data;
  },

  get: async (id) => {
    const response = await api.get(`/email-settings/blasts/${id}`);
    return response.data;
  },

  getProgress: async (id) => {
    const response = await api.get(`/email-settings/blasts/${id}/progress`);
    return response.data;
  },

  create: async (payload) => {
    const response = await api.post('/email-settings/blasts', payload);
    return response.data;
  },

  update: async (id, payload) => {
    const response = await api.put(`/email-settings/blasts/${id}`, payload);
    return response.data;
  },

  send: async (id) => {
    const response = await api.post(`/email-settings/blasts/${id}/send`);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/email-settings/blasts/${id}`);
    return response.data;
  }
};
```

- [ ] **Step 3: Commit**

```bash
git add auction-admin/src/services/emailSettingsApi.js auction-admin/src/services/blastEmailApi.js
git commit -m "feat: add customer list and blast email API services"
```

---

## Chunk 6: Frontend — Customer List Tab

### Task 12: CustomerListTab Component

**Files:**
- Create: `auction-admin/src/components/CustomerListTab.jsx`

A table with checkboxes, search, pagination, and a "Compose Blast Email" button that passes selected IDs to the blast tab.

- [ ] **Step 1: Create CustomerListTab**

```jsx
import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Text,
  TextField,
  Button,
  Spinner,
  Banner,
  Badge
} from '@shopify/polaris';
import { emailSettingsAPI } from '../services/emailSettingsApi';

function CustomerListTab({ onComposeBlast }) {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const limit = 25;

  // Debounce search input to avoid double-fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await emailSettingsAPI.getCustomers({ page, limit, search: debouncedSearch });
      setCustomers(data.customers);
      setTotal(data.total);
    } catch (err) {
      setError(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setSelectAll(false);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllToggle = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(customers.map(c => c._id)));
      setSelectAll(true);
    }
  };

  const handleCompose = () => {
    if (onComposeBlast) {
      if (selectAll && selectedIds.size === customers.length && total > customers.length) {
        // All customers across all pages
        onComposeBlast({ selectAll: true, recipientIds: [] });
      } else if (selectedIds.size > 0) {
        onComposeBlast({ selectAll: false, recipientIds: Array.from(selectedIds) });
      } else {
        // No selection = all customers
        onComposeBlast({ selectAll: true, recipientIds: [] });
      }
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && (
        <Banner tone="critical" onDismiss={() => setError(null)}>
          <p>{error}</p>
        </Banner>
      )}

      <Card sectioned>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <Text variant="headingMd">Customers</Text>
              <Text tone="subdued">{total} customer{total !== 1 ? 's' : ''} linked to this store</Text>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {selectedIds.size > 0 && (
                <Badge tone="info">{selectedIds.size} selected</Badge>
              )}
              <Button primary onClick={handleCompose}>
                Compose Blast Email
              </Button>
            </div>
          </div>

          <TextField
            placeholder="Search by email or name..."
            value={search}
            onChange={setSearch}
            autoComplete="off"
            clearButton
            onClearButtonClick={() => setSearch('')}
          />

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spinner />
            </div>
          ) : customers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Text tone="subdued">No customers found</Text>
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--p-color-border-subdued, #dfe3e8)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', width: 40 }}>
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAllToggle}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>
                      <Text variant="headingSm">Email</Text>
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>
                      <Text variant="headingSm">Display Name</Text>
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <Text variant="headingSm">Bids</Text>
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <Text variant="headingSm">Wins</Text>
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <Text variant="headingSm">Status</Text>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr
                      key={customer._id}
                      style={{
                        borderBottom: '1px solid var(--p-color-border-subdued, #dfe3e8)',
                        background: selectedIds.has(customer._id) ? 'var(--p-color-bg-surface-selected, #f0f5ff)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(customer._id)}
                          onChange={() => handleToggleSelect(customer._id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <Text>{customer.email}</Text>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <Text>{customer.displayName || '—'}</Text>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <Text>{customer.totalBids || 0}</Text>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <Text>{customer.auctionsWon || 0}</Text>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        {customer.unsubscribed ? (
                          <Badge tone="warning">Unsubscribed</Badge>
                        ) : (
                          <Badge tone="success">Subscribed</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 8 }}>
                <Button
                  size="slim"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <Text>Page {page} of {totalPages}</Text>
                <Button
                  size="slim"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

export default CustomerListTab;
```

- [ ] **Step 2: Commit**

```bash
git add auction-admin/src/components/CustomerListTab.jsx
git commit -m "feat: add CustomerListTab with search, pagination, and selection"
```

---

## Chunk 7: Frontend — Blast Email Tab

### Task 13: BlastEmailTab Component

**Files:**
- Create: `auction-admin/src/components/BlastEmailTab.jsx`

Compose section + history section. Uses RichTextEditor for composition, shows sent/draft history with progress polling.

- [ ] **Step 1: Create BlastEmailTab**

```jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Card,
  Text,
  TextField,
  Button,
  Spinner,
  Banner,
  Badge,
  Modal
} from '@shopify/polaris';
import DOMPurify from 'dompurify';
import RichTextEditor from './RichTextEditor';
import { blastEmailAPI } from '../services/blastEmailApi';

const BLAST_TOKENS = [
  '{{customer_name}}',
  '{{display_name}}',
  '{{store_name}}'
];

function BlastEmailTab({ recipientSelection, onEditRecipients, disabled = false }) {
  // ── Compose state ──
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [editorMode, setEditorMode] = useState('rich'); // 'rich' or 'html'
  const [deliveryMode, setDeliveryMode] = useState('all');
  const [batchSize, setBatchSize] = useState('50');
  const [intervalMinutes, setIntervalMinutes] = useState('5');
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState(null);

  // ── History state ──
  const [blasts, setBlasts] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedBlastId, setExpandedBlastId] = useState(null);
  const [expandedBlast, setExpandedBlast] = useState(null);

  // ── UI state ──
  const [message, setMessage] = useState(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const pollingRef = useRef(null);

  // ── Load history ──
  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const data = await blastEmailAPI.list({ page: historyPage, limit: 10 });
      setBlasts(data.blasts);
      setHistoryTotal(data.total);
    } catch (err) {
      console.error('Failed to load blast history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ── Poll sending blasts for progress ──
  useEffect(() => {
    const sendingBlasts = blasts.filter(b => b.status === 'sending');
    if (sendingBlasts.length === 0) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    pollingRef.current = setInterval(async () => {
      let changed = false;
      for (const blast of sendingBlasts) {
        try {
          const progress = await blastEmailAPI.getProgress(blast._id);
          if (progress.status !== blast.status || progress.stats.sent !== blast.stats.sent) {
            changed = true;
          }
        } catch (err) {
          // ignore
        }
      }
      if (changed) loadHistory();
    }, 10000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [blasts, loadHistory]);

  // ── Recipient count display ──
  const recipientLabel = recipientSelection?.selectAll
    ? 'all customers'
    : `${recipientSelection?.recipientIds?.length || 0} selected customer(s)`;

  // ── Handlers ──
  const resetCompose = () => {
    setSubject('');
    setBody('');
    setDeliveryMode('all');
    setBatchSize('50');
    setIntervalMinutes('5');
    setEditingDraftId(null);
  };

  const buildPayload = (saveAsDraft) => ({
    subject,
    body,
    deliveryMode,
    trickleConfig: deliveryMode === 'trickle' ? {
      batchSize: parseInt(batchSize) || 50,
      intervalMinutes: parseInt(intervalMinutes) || 5
    } : undefined,
    selectAll: recipientSelection?.selectAll ?? true,
    recipientIds: recipientSelection?.recipientIds || [],
    saveAsDraft
  });

  const handleSaveDraft = async () => {
    if (!subject.trim() || !body.trim()) {
      setMessage({ tone: 'warning', content: 'Subject and body are required' });
      return;
    }
    try {
      setSavingDraft(true);
      if (editingDraftId) {
        await blastEmailAPI.update(editingDraftId, buildPayload(true));
        setMessage({ tone: 'success', content: 'Draft updated' });
      } else {
        await blastEmailAPI.create(buildPayload(true));
        setMessage({ tone: 'success', content: 'Draft saved' });
      }
      resetCompose();
      loadHistory();
    } catch (err) {
      setMessage({ tone: 'critical', content: err.response?.data?.error || err.message || 'Failed to save draft' });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSendNow = async () => {
    if (!subject.trim() || !body.trim()) {
      setMessage({ tone: 'warning', content: 'Subject and body are required' });
      return;
    }
    setConfirmSend(true);
  };

  const handleConfirmSend = async () => {
    setConfirmSend(false);
    try {
      setSending(true);
      if (editingDraftId) {
        await blastEmailAPI.update(editingDraftId, buildPayload(true));
        await blastEmailAPI.send(editingDraftId);
      } else {
        await blastEmailAPI.create(buildPayload(false));
      }
      setMessage({ tone: 'success', content: 'Blast email sending started!' });
      resetCompose();
      loadHistory();
    } catch (err) {
      setMessage({ tone: 'critical', content: err.response?.data?.error || err.message || 'Failed to send' });
    } finally {
      setSending(false);
    }
  };

  const handleEditDraft = async (blast) => {
    try {
      const data = await blastEmailAPI.get(blast._id);
      const full = data.blast;
      setSubject(full.subject);
      setBody(full.body);
      setDeliveryMode(full.deliveryMode || 'all');
      setBatchSize(String(full.trickleConfig?.batchSize || 50));
      setIntervalMinutes(String(full.trickleConfig?.intervalMinutes || 5));
      setEditingDraftId(full._id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setMessage({ tone: 'critical', content: 'Failed to load draft' });
    }
  };

  const handleDeleteDraft = async (id) => {
    try {
      await blastEmailAPI.delete(id);
      setMessage({ tone: 'success', content: 'Draft deleted' });
      loadHistory();
    } catch (err) {
      setMessage({ tone: 'critical', content: 'Failed to delete draft' });
    }
  };

  const handleExpandBlast = async (id) => {
    if (expandedBlastId === id) {
      setExpandedBlastId(null);
      setExpandedBlast(null);
      return;
    }
    try {
      const data = await blastEmailAPI.get(id);
      setExpandedBlast(data.blast);
      setExpandedBlastId(id);
    } catch (err) {
      setMessage({ tone: 'critical', content: 'Failed to load blast details' });
    }
  };

  const handleTokenClick = (token) => {
    if (disabled) return;
    setBody(prev => prev + token);
  };

  const statusBadge = (status) => {
    const map = {
      draft: { tone: 'info', label: 'Draft' },
      sending: { tone: 'attention', label: 'Sending' },
      completed: { tone: 'success', label: 'Completed' },
      failed: { tone: 'critical', label: 'Failed' }
    };
    const config = map[status] || { tone: 'info', label: status };
    return <Badge tone={config.tone}>{config.label}</Badge>;
  };

  const historyPages = Math.ceil(historyTotal / 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {message && (
        <Banner tone={message.tone} onDismiss={() => setMessage(null)}>
          <p>{message.content}</p>
        </Banner>
      )}

      {disabled && (
        <Banner tone="warning" title="Upgrade Required">
          <p>Blast emails are available on Pro plans and above.</p>
        </Banner>
      )}

      {/* ── Compose Section ── */}
      <Card sectioned>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text variant="headingMd">
                {editingDraftId ? 'Edit Draft' : 'Compose Blast Email'}
              </Text>
              <Text tone="subdued">
                Sending to {recipientLabel}
                {' '}
                <Button size="slim" plain onClick={onEditRecipients}>
                  Edit recipients
                </Button>
              </Text>
            </div>
            {editingDraftId && (
              <Button size="slim" onClick={resetCompose}>Cancel editing</Button>
            )}
          </div>

          <TextField
            label="Subject"
            value={subject}
            onChange={setSubject}
            maxLength={200}
            showCharacterCount
            autoComplete="off"
            disabled={disabled}
          />

          {/* Editor mode toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Text variant="bodySm" fontWeight="bold">Editor Mode</Text>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                size="slim"
                primary={editorMode === 'rich'}
                pressed={editorMode === 'rich'}
                onClick={() => setEditorMode('rich')}
                disabled={disabled}
              >
                Rich Editor
              </Button>
              <Button
                size="slim"
                primary={editorMode === 'html'}
                pressed={editorMode === 'html'}
                onClick={() => setEditorMode('html')}
                disabled={disabled}
              >
                HTML
              </Button>
            </div>
          </div>

          {editorMode === 'html' ? (
            <TextField
              label="HTML Body"
              value={body}
              onChange={setBody}
              multiline={10}
              autoComplete="off"
              disabled={disabled}
              monospaced
            />
          ) : (
            <RichTextEditor
              value={body}
              onChange={setBody}
              disabled={disabled}
              placeholder="Compose your blast email..."
            />
          )}

          {/* Tokens */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Text variant="bodySm" fontWeight="bold">Available Tokens</Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {BLAST_TOKENS.map(token => (
                <code
                  key={token}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: 'var(--p-color-bg-subdued)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontSize: 12
                  }}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleTokenClick(token)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleTokenClick(token);
                    }
                  }}
                >
                  {token}
                </code>
              ))}
            </div>
          </div>

          {/* Delivery mode */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Text variant="bodySm" fontWeight="bold">Delivery Mode</Text>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                size="slim"
                primary={deliveryMode === 'all'}
                pressed={deliveryMode === 'all'}
                onClick={() => setDeliveryMode('all')}
                disabled={disabled}
              >
                Send All
              </Button>
              <Button
                size="slim"
                primary={deliveryMode === 'trickle'}
                pressed={deliveryMode === 'trickle'}
                onClick={() => setDeliveryMode('trickle')}
                disabled={disabled}
              >
                Trickle
              </Button>
            </div>
          </div>

          {deliveryMode === 'trickle' && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <TextField
                  label="Batch Size"
                  type="number"
                  value={batchSize}
                  onChange={setBatchSize}
                  min={1}
                  max={500}
                  autoComplete="off"
                  disabled={disabled}
                  helpText="1–500 emails per batch"
                />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <TextField
                  label="Interval (minutes)"
                  type="number"
                  value={intervalMinutes}
                  onChange={setIntervalMinutes}
                  min={1}
                  max={60}
                  autoComplete="off"
                  disabled={disabled}
                  helpText="1–60 minutes between batches"
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button onClick={handleSaveDraft} loading={savingDraft} disabled={disabled}>
              Save as Draft
            </Button>
            <Button primary onClick={handleSendNow} loading={sending} disabled={disabled}>
              Send Now
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Confirm Send Modal ── */}
      <Modal
        open={confirmSend}
        onClose={() => setConfirmSend(false)}
        title="Confirm Send"
        primaryAction={{
          content: 'Send',
          onAction: handleConfirmSend,
          loading: sending
        }}
        secondaryActions={[{
          content: 'Cancel',
          onAction: () => setConfirmSend(false)
        }]}
      >
        <Modal.Section>
          <Text>
            Send this email to {recipientLabel}?
            {deliveryMode === 'trickle' && ` (Trickle: ${batchSize} per batch, every ${intervalMinutes} min)`}
          </Text>
        </Modal.Section>
      </Modal>

      {/* ── History Section ── */}
      <Card sectioned>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Text variant="headingMd">Blast History</Text>

          {historyLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spinner />
            </div>
          ) : blasts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Text tone="subdued">No blast emails yet</Text>
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--p-color-border-subdued, #dfe3e8)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}><Text variant="headingSm">Subject</Text></th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}><Text variant="headingSm">Date</Text></th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}><Text variant="headingSm">Recipients</Text></th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}><Text variant="headingSm">Status</Text></th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}><Text variant="headingSm">Progress</Text></th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}><Text variant="headingSm">Actions</Text></th>
                  </tr>
                </thead>
                <tbody>
                  {blasts.map((blast) => (
                    <React.Fragment key={blast._id}>
                      <tr
                        style={{
                          borderBottom: '1px solid var(--p-color-border-subdued, #dfe3e8)',
                          cursor: 'pointer'
                        }}
                        onClick={() => handleExpandBlast(blast._id)}
                      >
                        <td style={{ padding: '8px 12px' }}>
                          <Text>{blast.subject}</Text>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <Text tone="subdued">
                            {new Date(blast.sentAt || blast.createdAt).toLocaleDateString()}
                          </Text>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <Text>{blast.stats?.total || 0}</Text>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {statusBadge(blast.status)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {blast.status === 'sending' ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                              <div style={{
                                width: 80,
                                height: 8,
                                background: 'var(--p-color-bg-subdued)',
                                borderRadius: 4,
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${blast.stats?.total ? (blast.stats.sent / blast.stats.total * 100) : 0}%`,
                                  height: '100%',
                                  background: 'var(--p-color-bg-fill-success)',
                                  borderRadius: 4,
                                  transition: 'width 0.3s'
                                }} />
                              </div>
                              <Text variant="bodySm">{blast.stats?.sent || 0}/{blast.stats?.total || 0}</Text>
                            </div>
                          ) : (
                            <Text variant="bodySm">
                              {blast.stats?.sent || 0}/{blast.stats?.total || 0}
                            </Text>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            {blast.status === 'draft' && (
                              <>
                                <Button size="slim" onClick={() => handleEditDraft(blast)}>Edit</Button>
                                <Button size="slim" tone="critical" onClick={() => handleDeleteDraft(blast._id)}>Delete</Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedBlastId === blast._id && expandedBlast && (
                        <tr key={`${blast._id}-detail`}>
                          <td colSpan={6} style={{ padding: '12px 24px', background: 'var(--p-color-bg-subdued, #f6f6f7)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <Text variant="headingSm">Email Preview</Text>
                              <div
                                style={{
                                  background: '#fff',
                                  padding: 16,
                                  borderRadius: 8,
                                  border: '1px solid var(--p-color-border-subdued)',
                                  maxHeight: 300,
                                  overflow: 'auto'
                                }}
                                dangerouslySetInnerHTML={{
                                  __html: DOMPurify.sanitize(expandedBlast.body)
                                }}
                              />
                              <Text variant="headingSm">
                                Recipients ({expandedBlast.recipients?.length || 0})
                              </Text>
                              <div style={{ maxHeight: 200, overflow: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                  <thead>
                                    <tr>
                                      <th style={{ padding: '4px 8px', textAlign: 'left' }}>Email</th>
                                      <th style={{ padding: '4px 8px', textAlign: 'left' }}>Name</th>
                                      <th style={{ padding: '4px 8px', textAlign: 'center' }}>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(expandedBlast.recipients || []).slice(0, 50).map((r, i) => (
                                      <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                                        <td style={{ padding: '4px 8px' }}>{r.email}</td>
                                        <td style={{ padding: '4px 8px' }}>{r.displayName}</td>
                                        <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                                          {statusBadge(r.status)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {(expandedBlast.recipients?.length || 0) > 50 && (
                                  <Text tone="subdued" variant="bodySm">
                                    Showing first 50 of {expandedBlast.recipients.length} recipients
                                  </Text>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              {historyPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 8 }}>
                  <Button size="slim" disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)}>
                    Previous
                  </Button>
                  <Text>Page {historyPage} of {historyPages}</Text>
                  <Button size="slim" disabled={historyPage >= historyPages} onClick={() => setHistoryPage(p => p + 1)}>
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

export default BlastEmailTab;
```

- [ ] **Step 2: Commit**

```bash
git add auction-admin/src/components/BlastEmailTab.jsx
git commit -m "feat: add BlastEmailTab with compose, trickle config, and history"
```

---

## Chunk 8: Frontend — Tab Navigation in MailServicePage

### Task 14: Update MailServicePage with Tabs

**Files:**
- Modify: `auction-admin/src/pages/MailServicePage.jsx`

Replace the current single-component page with a tabbed layout containing all three sections.

- [ ] **Step 1: Rewrite MailServicePage with tabs**

Replace the entire contents of `auction-admin/src/pages/MailServicePage.jsx` with:

```jsx
import { useCallback, useEffect, useState } from 'react';
import { Page } from '@shopify/polaris';
import { useLocation, useNavigate } from 'react-router-dom';
import MailServiceSettings from '../components/MailServiceSettings';
import CustomerListTab from '../components/CustomerListTab';
import BlastEmailTab from '../components/BlastEmailTab';
import { emailSettingsAPI } from '../services/emailSettingsApi';
import useAdminI18n from '../hooks/useAdminI18n';

const TABS = [
  { id: 'templates', label: 'Email Templates' },
  { id: 'customers', label: 'Customer List' },
  { id: 'blast', label: 'Blast Emails' }
];

export default function MailServicePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = location.search || '';
  const i18n = useAdminI18n();
  const [activeTab, setActiveTab] = useState('templates');
  const [recipientSelection, setRecipientSelection] = useState({ selectAll: true, recipientIds: [] });
  const [canCustomize, setCanCustomize] = useState(false);

  // Load plan context to determine if blast emails are available
  useEffect(() => {
    emailSettingsAPI.getSettings()
      .then(res => setCanCustomize(res.canCustomize ?? false))
      .catch(() => {});
  }, []);

  const handleComposeBlast = useCallback((selection) => {
    setRecipientSelection(selection);
    setActiveTab('blast');
  }, []);

  const handleEditRecipients = useCallback(() => {
    setActiveTab('customers');
  }, []);

  return (
    <Page
      title={i18n.translate('admin.mail_service.page.title')}
      backAction={{
        content: i18n.translate('admin.common.back'),
        onAction: () => navigate(`/${query}`)
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Tab bar */}
        <div style={{
          display: 'flex',
          gap: 0,
          borderBottom: '2px solid var(--p-color-border-subdued, #dfe3e8)'
        }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 20px',
                border: 'none',
                borderBottom: activeTab === tab.id
                  ? '2px solid var(--p-color-bg-fill-brand, #008060)'
                  : '2px solid transparent',
                marginBottom: -2,
                background: 'transparent',
                cursor: 'pointer',
                fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id
                  ? 'var(--p-color-text, #202223)'
                  : 'var(--p-color-text-subdued, #6d7175)',
                fontSize: 14,
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'templates' && <MailServiceSettings />}
        {activeTab === 'customers' && (
          <CustomerListTab onComposeBlast={handleComposeBlast} />
        )}
        {activeTab === 'blast' && (
          <BlastEmailTab
            recipientSelection={recipientSelection}
            onEditRecipients={handleEditRecipients}
            disabled={!canCustomize}
          />
        )}
      </div>
    </Page>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add auction-admin/src/pages/MailServicePage.jsx
git commit -m "feat: add tab navigation to MailServicePage (Templates, Customers, Blast)"
```

---

## Chunk 9: Integration & Testing

### Task 15: Manual Integration Test

- [ ] **Step 1: Start backend dev server**

```bash
cd auction-backend && npm run dev
```

- [ ] **Step 2: Start admin dashboard dev server**

```bash
cd auction-admin && npm run dev
```

- [ ] **Step 3: Verify tab navigation**

Navigate to the Mail Service page. Verify:
- Three tabs render: "Email Templates", "Customer List", "Blast Emails"
- Clicking each tab shows the correct content
- Email Templates tab shows existing template settings with Rich Editor / HTML toggle
- Rich editor renders with toolbar (bold, italic, etc.)

- [ ] **Step 4: Verify customer list**

In the Customer List tab:
- Customer list loads with emails, display names, stats
- Search filters customers
- Pagination works
- Checkboxes work for selection
- "Compose Blast Email" button switches to Blast tab

- [ ] **Step 5: Verify blast email compose**

In the Blast Emails tab:
- Subject and body fields work
- Rich editor / HTML toggle works
- Delivery mode toggle shows/hides trickle config
- Token chips insert into body
- "Save as Draft" creates a draft (appears in history)
- "Send Now" triggers confirmation modal

- [ ] **Step 6: Verify blast history**

- Draft appears in history with "Draft" badge
- Edit and Delete actions work on drafts
- Clicking a row expands to show preview and recipients
- HTML preview is sanitized (no script execution)

- [ ] **Step 7: Verify blast sending**

- Send a blast to a test customer
- Verify email arrives with personalized tokens
- Verify unsubscribe footer is present
- Click unsubscribe link — verify customer gets `unsubscribed: true` badge
- Verify unsubscribed customers are excluded from subsequent blasts

- [ ] **Step 8: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for blast email feature"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | BlastEmail model | `models/BlastEmail.js` |
| 2 | Customer unsubscribed field | `models/Customer.js` |
| 3 | Blast email service | `services/blastEmailService.js` |
| 4 | Customer list endpoint | `routes/emailSettings.js` |
| 5 | Blast email routes | `routes/blastEmailRoutes.js` |
| 6 | Unsubscribe endpoint | `routes/emailSettings.js` |
| 7 | Mount routes + crash recovery | `server.js` |
| 8 | Install dependencies | `package.json` |
| 9 | RichTextEditor component | `components/RichTextEditor.jsx` |
| 10 | Rich editor in templates | `components/MailServiceSettings.jsx` |
| 11 | API services | `services/emailSettingsApi.js`, `services/blastEmailApi.js` |
| 12 | Customer list tab | `components/CustomerListTab.jsx` |
| 13 | Blast email tab | `components/BlastEmailTab.jsx` |
| 14 | Tab navigation | `pages/MailServicePage.jsx` |
| 15 | Integration testing | Manual verification |
