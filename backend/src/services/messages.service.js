/**
 * Messages Service
 * --------------------------------------------------------------
 * Buyer-side messaging to property owners. Quota-gated:
 *   - Free tier: 3 messages per rolling 30-day window
 *   - Paid plans: use plan.message_quota (defaults to plan.quota when unset)
 * On quota-exhaustion the controller responds with 402 PAYMENT_REQUIRED so
 * the UI can redirect to /pricing (CR §UserDashboard.3).
 */

const { v4: uuidv4 } = require('uuid');
const MessageModel = require('../models/message.model');
const PropertyModel = require('../models/property.model');
const PricingService = require('./pricing.service');

const FREE_TIER_QUOTA = 3;
const WINDOW_DAYS = 30;

function quotaForUser(userId) {
  const ent = PricingService.getEntitlement(userId);
  if (!ent || !ent.hasSubscription) return FREE_TIER_QUOTA;
  const plan = ent.plan;
  if (!plan) return FREE_TIER_QUOTA;
  // Plans don't currently expose a separate message quota — reuse the
  // contact unlock quota as a proxy until a dedicated field is added.
  return plan.message_quota || plan.unlock_quota || plan.quota || FREE_TIER_QUOTA;
}

const MessagesService = {
  /** Get the user's message quota status for the rolling window. */
  getQuotaStatus(userId) {
    const total = quotaForUser(userId);
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const used = MessageModel.countSentInWindow(userId, since);
    const ent = PricingService.getEntitlement(userId);
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

  /** Send a message to the owner of a property. */
  async send(senderId, propertyId, body, senderInfo = {}) {
    const property = PropertyModel.findById(propertyId);
    if (!property) {
      throw Object.assign(new Error('Property not found'), { code: 'NOT_FOUND', statusCode: 404 });
    }
    if (property.owner_id === senderId) {
      throw Object.assign(new Error("You can't message your own property"),
        { code: 'BAD_REQUEST', statusCode: 400 });
    }

    const quota = MessagesService.getQuotaStatus(senderId);
    if (quota.remaining <= 0) {
      throw Object.assign(
        new Error(`Message limit reached (${quota.used}/${quota.total} in last ${quota.windowDays} days)`),
        { code: 'PAYMENT_REQUIRED', statusCode: 402, redirectTo: '/pricing' }
      );
    }

    const message = MessageModel.create({
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
      quota: MessagesService.getQuotaStatus(senderId),
    };
  },

  /** List properties the buyer has contacted (for the dashboard). */
  contactedProperties(userId) {
    return MessageModel.contactedSummary(userId)
      .map(({ propertyId, lastContactedAt }) => {
        const prop = PropertyModel.findById(propertyId);
        return prop ? { property: prop, lastContactedAt } : null;
      })
      .filter(Boolean);
  },
};

module.exports = MessagesService;
