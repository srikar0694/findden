const PropertyModel = require('../models/property.model');
const TransactionModel = require('../models/transaction.model');
const PricingService = require('./pricing.service');
const UserModel = require('../models/user.model');
const WishlistModel = require('../models/wishlist.model');
const MessagesService = require('./messages.service');
const PropertiesService = require('./properties.service');

const DashboardService = {
  async getSummary(userId) {
    const [user, allListings, { rows: recentTransactions }, totalViews] = await Promise.all([
      UserModel.findById(userId),
      PropertyModel.findByOwnerId(userId),
      TransactionModel.findByUserId(userId, 5, 0),
      PropertyModel.totalViewsByOwner(userId),
    ]);

    const listingBreakdown = {
      total:   allListings.length,
      active:  allListings.filter((p) => p.status === 'active').length,
      paused:  allListings.filter((p) => p.status === 'paused').length,
      draft:   allListings.filter((p) => p.status === 'draft').length,
      expired: allListings.filter((p) => p.status === 'expired').length,
      sold:    allListings.filter((p) => p.status === 'sold').length,
    };

    const recentListings = [...allListings]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map((p) => ({
        id: p.id, title: p.title, status: p.status, price: p.price,
        listingType: p.listing_type, city: p.city,
        thumbnail: (p.images && p.images[0]) || null,
        viewsCount: p.views_count, createdAt: p.created_at,
      }));

    // Run independent async operations in parallel
    const [subscription, wishlist, contactedList, messageQuota] = await Promise.all([
      PricingService.getSubscriptionSummary(userId),
      WishlistModel.findByUserId(userId),
      MessagesService.contactedProperties(userId),
      MessagesService.getQuotaStatus(userId),
    ]);

    const [favoriteProperties, contactedProperties] = await Promise.all([
      Promise.all(
        wishlist.map(async (w) => {
          const p = await PropertyModel.findById(w.property_id || w.propertyId);
          return p ? PropertiesService.getById(p.id, userId) : null;
        })
      ).then((r) => r.filter(Boolean)),
      Promise.all(
        contactedList.map(({ property }) => PropertiesService.getById(property.id, userId))
      ).then((r) => r.filter(Boolean)),
    ]);

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatar_url },
      favorites: favoriteProperties,
      contacted: contactedProperties,
      messageQuota,
      subscription: subscription && subscription.hasSubscription
        ? {
            plan: subscription.plan ? subscription.plan.name : 'Unknown',
            planId: subscription.plan ? subscription.plan.id : null,
            planSlug: subscription.plan ? subscription.plan.slug : null,
            // CR §1.2 — surface the plan amount + currency in the dashboard.
            amount: subscription.plan ? Number(subscription.plan.price) : null,
            currency: subscription.plan ? subscription.plan.currency : 'INR',
            quotaUsed: subscription.unlocksUsed,
            quotaTotal: subscription.unlocksTotal,
            quotaRemaining: subscription.unlocksRemaining,
            expiresAt: subscription.expiresAt,
            status: subscription.subscription?.status,
          }
        : null,
      listings: listingBreakdown,
      recentListings,
      recentTransactions: recentTransactions.map((t) => ({
        id: t.id, amount: t.amount, currency: t.currency,
        type: t.type, status: t.status, createdAt: t.created_at,
      })),
      totalViews,
    };
  },
};

module.exports = DashboardService;
