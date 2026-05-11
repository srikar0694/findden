const { v4: uuidv4 } = require('uuid');
const NotificationModel = require('../models/notification.model');
const PropertyModel = require('../models/property.model');
const UserModel = require('../models/user.model');

const NOTIFICATION_TYPES = ['request_callback', 'send_message'];

const NotificationsService = {
  async notifyOwner({ senderId, propertyId, type, message = null }) {
    if (!NOTIFICATION_TYPES.includes(type)) {
      throw Object.assign(new Error('Invalid notification type'),
        { code: 'VALIDATION_ERROR', statusCode: 400 });
    }

    const [property, sender] = await Promise.all([
      PropertyModel.findById(propertyId),
      UserModel.findById(senderId),
    ]);

    if (!property) throw Object.assign(new Error('Property not found'), { code: 'NOT_FOUND', statusCode: 404 });
    if (!sender)   throw Object.assign(new Error('Sender not found'),   { code: 'NOT_FOUND', statusCode: 404 });

    const owner = await UserModel.findById(property.owner_id);
    if (!owner) throw Object.assign(new Error('Property owner no longer exists'), { code: 'OWNER_MISSING', statusCode: 410 });

    const channels = [];
    if (owner.email) channels.push('email');
    if (owner.phone) channels.push('sms');

    const payload = buildPayload({ type, sender, property, message });
    let status = channels.length === 0 ? 'failed' : 'sent';

    for (const ch of channels) {
      if (ch === 'email') await sendEmail(owner.email, payload);
      if (ch === 'sms')   await sendSms(owner.phone, payload);
    }

    const row = await NotificationModel.create({
      id: uuidv4(),
      type,
      sender_id: senderId,
      owner_id: owner.id,
      channels,
      status,
      payload: {
        subject: payload.subject,
        preview: payload.bodyText.slice(0, 180),
        propertyId,
        message: type === 'send_message' ? (message || '').trim() : null,
      },
    });

    return {
      id: row.id,
      type: row.type,
      channels: row.channels,
      status: row.status,
      ownerName: owner.name,
      ownerContactMethods: { email: !!owner.email, sms: !!owner.phone },
    };
  },

  async listForOwner(ownerId) {
    const rows = await NotificationModel.findByOwnerId(ownerId);
    return rows.map(shapeForOwner);
  },
};

function buildPayload({ type, sender, property, message }) {
  const subject = type === 'request_callback'
    ? `Callback request for "${property.title}"`
    : `New message about "${property.title}"`;

  const senderContact = [
    sender.phone ? `Phone: ${sender.phone}` : null,
    sender.email ? `Email: ${sender.email}` : null,
  ].filter(Boolean).join('  |  ');

  const bodyText = type === 'request_callback'
    ? [`Hi,`, `${sender.name || 'A prospective buyer'} has requested a callback for your property "${property.title}" (${property.city}).`, `You can reach them at — ${senderContact || 'no contact details on file'}.`, `— FindDen`].join('\n\n')
    : [`Hi,`, `${sender.name || 'A prospective buyer'} sent a message about your property "${property.title}" (${property.city}):`, `"${(message || '').trim()}"`, `Reply to them directly at — ${senderContact || 'no contact details on file'}.`, `— FindDen`].join('\n\n');

  return { subject, bodyText };
}

function sendEmail(to, { subject, bodyText }) {
  console.log(`[EMAIL] → ${to}\nSubject: ${subject}\n${bodyText}\n`); // eslint-disable-line no-console
  return Promise.resolve(true);
}

function sendSms(to, { bodyText }) {
  console.log(`[SMS]   → ${to}\n${bodyText.replace(/\n\n/g, ' — ').slice(0, 320)}\n`); // eslint-disable-line no-console
  return Promise.resolve(true);
}

function shapeForOwner(n) {
  return {
    id: n.id, type: n.type, senderId: n.sender_id,
    channels: n.channels, status: n.status,
    payload: n.payload || {},
    createdAt: n.created_at,
  };
}

module.exports = NotificationsService;
