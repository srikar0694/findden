const PricingService = require('./pricing.service');
const ContactUnlockModel = require('../models/contactUnlock.model');
const PropertyModel = require('../models/property.model');
const UserModel = require('../models/user.model');

const ContactsService = {
  async getContactForProperty(userId, propertyId, { consumeQuota = false } = {}) {
    const property = await PropertyModel.findById(propertyId);
    if (!property) {
      throw Object.assign(new Error('Property not found'), { code: 'NOT_FOUND', statusCode: 404 });
    }
    if (property.owner_id === userId) {
      return { status: 'owner', contact: await contactOf(property) };
    }

    const access = await PricingService.checkContactAccess(userId, propertyId);
    if (access.method === 'already_unlocked') {
      return { status: 'unlocked', contact: await contactOf(property) };
    }
    if (access.method === 'deduct_subscription') {
      if (!consumeQuota) {
        return {
          status: 'available_via_subscription',
          unlocksRemaining: access.entitlement.unlocksRemaining,
          planSlug: access.entitlement.plan.slug,
          planName: access.entitlement.plan.name,
        };
      }
      await PricingService.consumeSubscriptionForUnlock(userId, propertyId);
      const after = await PricingService.getEntitlement(userId);
      return {
        status: 'granted_via_subscription',
        contact: await contactOf(property),
        unlocksRemaining: after.unlocksRemaining || 0,
      };
    }
    return { status: 'payment_required', reason: access.reason };
  },

  async unlockMany(userId, propertyIds) {
    const unique = Array.from(new Set(propertyIds));
    const { unlocked, needsPayment } = await PricingService.consumeSubscriptionForMany(userId, unique);
    const contacts = (
      await Promise.all(
        unlocked.map(async (pid) => {
          const prop = await PropertyModel.findById(pid);
          return prop ? { propertyId: pid, contact: await contactOf(prop) } : null;
        })
      )
    ).filter(Boolean);
    return {
      unlockedContacts: contacts,
      needsPayment,
      entitlement: await PricingService.getEntitlement(userId),
    };
  },

  async listMyUnlocks(userId) {
    const rows = await ContactUnlockModel.findByUserId(userId);
    const results = await Promise.all(
      rows.map(async (u) => {
        const prop = await PropertyModel.findById(u.property_id);
        if (!prop) return null;
        return {
          id: u.id,
          propertyId: u.property_id,
          propertyTitle: prop.title,
          propertyCity: prop.city,
          propertyThumbnail: (prop.images && prop.images[0]) || null,
          source: u.source,
          grantedAt: u.granted_at,
          contact: await contactOf(prop),
        };
      })
    );
    return results
      .filter(Boolean)
      .sort((a, b) => new Date(b.grantedAt) - new Date(a.grantedAt));
  },
};

async function contactOf(property) {
  const owner = await UserModel.findById(property.owner_id);
  return {
    name: owner?.name || property.contact_name || 'Owner',
    phone: property.contact_phone || owner?.phone || null,
    email: property.contact_email || owner?.email || null,
    role: owner?.role || 'owner',
  };
}

module.exports = ContactsService;
