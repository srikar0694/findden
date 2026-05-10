const { v4: uuidv4 } = require('uuid');
const MessageModel = require('../models/message.model');
const PropertyModel = require('../models/property.model');
const PricingService = require('./pricing.service');

const FREE_TIER_QUOTA = 3;
const WINDOW_DAYS = 30;

async function quotaForUser(userId) {
  const ent = await PricingService.getEntitlement(userId);
  if (!ent || !ent.hasSubscription) return FREE_TIER_QUOTA;
  const plan = ent.plan;
  if (!plan) return FREE_TIER_QUOTA;
  return plan.message_quota || plan.unlock_quota || plan.quota || FREE_TIER_QUOTA;
}

const MessagesService = {
  async getQuotaStatus(userId) {
    const total = await quotaForUser(userId);
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const used = await MessageModel.countSentInWindow(userId, since);
    const ent = await PricingService.getEntitlement(userId);
    const planName = ent && ent.hasSubscription && ent.plan
      ? (ent.plan.name || ent.plan.slug || null)
      : 'free';
    return {
      total,
      used,
      remaining: Math.max(0, total - used),
      windowDays: WINDOW_DAYS,
      plan: planName,
    };
  },

  async send(senderId, propertyId, body, senderInfo = {}) {
    const property = await PropertyModel.findById(propertyId);
    if (!property) {
      throw Object.assign(new Error('Property not found'), { code: 'NOT_FOUND', statusCode: 404 });
    }
    if (property.owner_id === senderId) {
      throw Object.assign(new Error("You can't message your own property"),
        { code: 'BAD_REQUEST', statusCode: 400 });
    }

    const quota = await MessagesService.getQuotaStatus(senderId);
    if (quota.remaining <= 0) {
      throw Object.assign(
        new Error(`Message limit reached (${quota.used}/${quota.total} in last ${quota.windowDays} days)`),
        { code: 'PAYMENT_REQUIRED', statusCode: 402, redirectTo: '/pricing' }
      );
    }

    const message = await MessageModel.create({
      id: uuidv4(),
      sender_id: senderId,
      sender_name: senderInfo.name || null,
      sender_phone: senderInfo.phone || null,
      sender_email: senderInfo.email || null,
      recipient_id: property.owner_id,
      property_id: propertyId,
      body: String(body).slice(0, 2000),
      read: false,
    });

    return {
      message,
      quota: await MessagesService.getQuotaStatus(senderId),
    };
  },

  async contactedProperties(userId) {
    const summary = await MessageModel.contactedSummary(userId);
    const results = await Promise.all(
      summary.map(async ({ propertyId, lastContactedAt }) => {
        const prop = await PropertyModel.findById(propertyId);
        return prop ? { property: prop, lastContactedAt } : null;
      })
    );
    return results.filter(Boolean);
  },
};

module.exports = MessagesService;
