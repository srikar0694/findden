/**
 * Contacts Service — expose seller contact info (phone/email) to users
 * who have paid (or who hold an active quota) for that property.
 */

const PricingService = require('./pricing.service');
const ContactUnlockModel = require('../models/contactUnlock.model');
const PropertyModel = require('../models/property.model');
const UserModel = require('../models/user.model');

const ContactsService = {
  /**
   * Return the full unmasked contact for a single property if the caller
   * is entitled, else a decision payload instructing them how to unlock.
   *
   *   { status: 'unlocked', contact: {...} }
   *   { status: 'granted_via_subscription', contact: {...}, unlocksRemaining }
   *   { status: 'payment_required', reason }
   */
  getContactForProperty(userId, propertyId, { consumeQuota = false } = {}) {
    const property = PropertyModel.findById(propertyId);
    if (!property) {
      throw Object.assign(new Error('Property not found'), {
        code: 'NOT_FOUND', statusCode: 404,
      });
    }
    // Owner always sees their own contact.
    if (property.owner_id === userId) {
      return { status: 'owner', contact: contactOf(property) };
    }

    const access = PricingService.checkContactAccess(userId, propertyId);
    if (access.method === 'already_unlocked') {
      return { status: 'unlocked', contact: contactOf(property) };
    }
    if (access.method === 'deduct_subscription') {
      if (!consumeQuota) {
        // Preview — we'd deduct if you confirm.
        return {
          status: 'available_via_subscription',
          unlocksRemaining: access.entitlement.unlocksRemaining,
          planSlug: access.entitlement.plan.slug,
          planName: access.entitlement.plan.name,
        };
      }
      PricingService.consumeSubscriptionForUnlock(userId, propertyId);
      const after = PricingService.getEntitlement(userId);
      return {
        status: 'granted_via_subscription',
        contact: contactOf(property),
        unlocksRemaining: after.unlocksRemaining || 0,
      };
    }
    return { status: 'payment_required', reason: access.reason };
  },

  /**
   * Batch: attempt to unlock many property contacts at once
   * (used by the Wishlist "unlock all" button).
   * Uses the subscription quota if present; the leftover IDs are returned
   * so the frontend can route them into the pricing/checkout flow.
   */
  unlockMany(userId, propertyIds) {
    const unique = Array.from(new Set(propertyIds));
    const { unlocked, needsPayment } = PricingService.consumeSubscriptionForMany(userId, unique);
    const contacts = unlocked.map((pid) => {
      const prop = PropertyModel.findById(pid);
      return prop ? { propertyId: pid, contact: contactOf(prop) } : null;
    }).filter(Boolean);
    return {
      unlockedContacts: contacts,
      needsPayment,
      entitlement: PricingService.getEntitlement(userId),
    };
  },

  listMyUnlocks(userId) {
    const rows = ContactUnlockModel.findByUserId(userId);
    return rows
      .map((u) => {
        const prop = PropertyModel.findById(u.property_id);
        if (!prop) return null;
        return {
          id: u.id,
          propertyId: u.property_id,
          propertyTitle: prop.title,
          propertyCity: prop.city,
          propertyThumbnail: (prop.images && prop.images[0]) || null,
          source: u.source,
          grantedAt: u.granted_at,
          contact: contactOf(prop),
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.grantedAt) - new Date(a.grantedAt));
  },
};

/** Return the unmasked contact details for a property. */
function contactOf(property) {
  const owner = UserModel.findById(property.owner_id);
  return {
    name: owner?.name || property.contact_name || 'Owner',
    phone: property.contact_phone || owner?.phone || null,
    email: property.contact_email || owner?.email || null,
    role: owner?.role || 'owner',
  };
}

module.exports = ContactsService;
