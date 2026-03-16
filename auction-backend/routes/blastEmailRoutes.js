import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { identifyStore } from '../middleware/storeMiddleware.js';
import { attachPlanContext, getStorePlan } from '../middleware/planGuard.js';
import { planMeetsRequirement } from '../config/billingPlans.js';
import BlastEmail from '../models/BlastEmail.js';
import { sendBlast, resolveRecipients, getBlastProgress } from '../services/blastEmailService.js';

const router = express.Router();

router.use(identifyStore);
router.use(requireAuth);
router.use(attachPlanContext);

const PLAN_REQUIRED = 'pro';

// Plan check middleware
const requirePlan = (req, res, next) => {
  const plan = getStorePlan(req);
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
      status: 'draft',
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
