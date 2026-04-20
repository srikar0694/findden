/**
 * Notifications Service
 * ----------------------------------------------------------------------
 * Two buyer-initiated actions on a property detail page:
 *
 *   1. request_callback
 *      Owner is notified that an interested buyer wants a callback.
 *      No free-form message; we pass the requester's email/phone so
 *      the owner can reach out.
 *
 *   2. send_message
 *      Owner receives the buyer's typed message.
 *
 * Channel selection rules (per requirements):
 *   - Owner has BOTH email and phone  => send EMAIL + SMS
 *   - Owner has only email            => send EMAIL
 *   - Owner has only phone            => send SMS
 *   - Owner has NEITHER               => record notification with status=failed
 *
 * The service writes a notifications row for every dispatch so the
 * owner can see them in their dashboard. The actual send is stubbed
 * for dev (console.log); swap the transport for SES / Twilio in prod.
 */

const { v4: uuidv4 } = require('uuid');
const NotificationModel = require('../models/notification.model');
const PropertyModel = require('../models/property.model');
const UserModel = require('../models/user.model');

const NOTIFICATION_TYPES = ['request_callback', 'send_message'];

const NotificationsService = {
  /**
   * Notify the property owner on behalf of `senderId`.
   *
   * @param {object}   opts
   * @param {string}   opts.senderId       — caller / buyer user ID
   * @param {string}   opts.propertyId
   * @param {string}   opts.type           — request_callback | send_message
   * @param {string}   [opts.message]      — buyer's free-form text (send_message only)
   */
  async notifyOwner({ senderId, propertyId, type, message = null }) {
    if (!NOTIFICATION_TYPES.includes(type)) {
      throw Object.assign(new Error('Invalid notification type'),
        { code: 'VALIDATION_ERROR', statusCode: 400 });
    }

    const property = PropertyModel.findById(propertyId);
    if (!property) {
      throw Object.assign(new Error('Property not found'),
        { code: 'NOT_FOUND', statusCode: 404 });
    }

    const sender = UserModel.findById(senderId);
    if (!sender) {
      throw Object.assign(new Error('Sender not found'),
        { code: 'NOT_FOUND', statusCode: 404 });
    }

    const owner = UserModel.findById(property.owner_id);
    if (!owner) {
      throw Object.assign(new Error('Property owner no longer exists'),
        { code: 'OWNER_MISSING', statusCode: 410 });
    }

    // Decide channels based on which contact methods the *owner* has registered.
    const channels = [];
    if (owner.email) channels.push('email');
    if (owner.phone) channels.push('sms');

    const payload = buildPayload({ type, sender, property, message });

    let status = 'sent';
    if (channels.length === 0) status = 'failed';

    // Dispatch on each channel (stub — logs to console in dev).
    for (const ch of channels) {
      if (ch === 'email') await sendEmail(owner.email, payload);
      if (ch === 'sms') await sendSms(owner.phone, payload);
    }

    const row = NotificationModel.create({
      id: uuidv4(),
      type,
      sender_id: senderId,
      owner_id: owner.id,
      property_id: propertyId,
      message: type === 'send_message' ? (message || '').trim() : null,
      channels,
      status,
      subject: payload.subject,
      preview: payload.bodyText.slice(0, 180),
      created_at: new Date().toISOString(),
    });

    return {
      id: row.id,
      type: row.type,
      channels: row.channels,
      status: row.status,
      ownerName: owner.name,
      // Never leak raw owner contact back to the caller
      ownerContactMethods: {
        email: !!owner.email,
        sms: !!owner.phone,
      },
    };
  },

  /** Returns all notifications a given owner has received. */
  listForOwner(ownerId) {
    return NotificationModel.findByOwnerId(ownerId).map(shapeForOwner);
  },
};

// ---- Internal helpers --------------------------------------------------------

function buildPayload({ type, sender, property, message }) {
  const subject =
    type === 'request_callback'
      ? `Callback request for "${property.title}"`
      : `New message about "${property.title}"`;

  const senderContact = [
    sender.phone ? `Phone: ${sender.phone}` : null,
    sender.email ? `Email: ${sender.email}` : null,
  ].filter(Boolean).join('  |  ');

  const bodyText =
    type === 'request_callback'
      ? [
          `Hi,`,
          `${sender.name || 'A prospective buyer'} has requested a callback for your property "${property.title}" (${property.city}).`,
          `You can reach them at — ${senderContact || 'no contact details on file'}.`,
          `— FindDen`,
        ].join('\n\n')
      : [
          `Hi,`,
          `${sender.name || 'A prospective buyer'} sent a message about your property "${property.title}" (${property.city}):`,
          `“${(message || '').trim()}”`,
          `Reply to them directly at — ${senderContact || 'no contact details on file'}.`,
          `— FindDen`,
        ].join('\n\n');

  return { subject, bodyText };
}

function sendEmail(to, { subject, bodyText }) {
  // Swap for SES / Sendgrid / Nodemailer in production.
  // eslint-disable-next-line no-console
  console.log(`[EMAIL] → ${to}\nSubject: ${subject}\n${bodyText}\n`);
  return Promise.resolve(true);
}

function sendSms(to, { bodyText }) {
  // Swap for Twilio / MSG91 in production. SMS body truncated to 320 chars.
  const sms = bodyText.replace(/\n\n/g, ' — ').slice(0, 320);
  // eslint-disable-next-line no-console
  console.log(`[SMS]   → ${to}\n${sms}\n`);
  return Promise.resolve(true);
}

function shapeForOwner(n) {
  return {
    id: n.id,
    type: n.type,
    senderId: n.sender_id,
    propertyId: n.property_id,
    message: n.message,
    channels: n.channels,
    status: n.status,
    subject: n.subject,
    preview: n.preview,
    createdAt: n.created_at,
  };
}

module.exports = NotificationsService;
