import crypto from 'crypto';
import BlastEmail from '../models/BlastEmail.js';
import Customer from '../models/Customer.js';
import Store from '../models/Store.js';
import EmailSettings from '../models/EmailSettings.js';

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
 */
async function getShopTransporter(shopDomain) {
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
  const baseUrl = process.env.APP_URL || process.env.BACKEND_URL || '';
  const unsubscribeUrl = `${baseUrl}/api/email-settings/unsubscribe?email=${encodeURIComponent(recipient.email)}&shop=${encodeURIComponent(shopDomain)}&token=${token}`;
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
