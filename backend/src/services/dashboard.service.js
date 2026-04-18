const PropertyModel = require('../models/property.model');
const TransactionModel = require('../models/transaction.model');
const PricingService = require('./pricing.service');
const UserModel = require('../models/user.model');

const DashboardService = {
  getSummary(userId) {
    const user = UserModel.findById(userId);

    // Listings breakdown
    const allListings = PropertyModel.findByOwnerId(userId);
    const listingBreakdown = {
      total: allListings.length,
      active: allListings.filter((p) => p.status === 'active').length,
      paused: allListings.filter((p) => p.status === 'paused').length,
      draft: allListings.filter((p) => p.status === 'draft').length,
      expired: allListings.filter((p) => p.status === 'expired').length,
      sold: allListings.filter((p) => p.status === 'sold').length,
    };

    // Subscription summary
    const subscription = PricingService.getSubscriptionSummary(userId);

    // Recent transactions
    const { rows: recentTransactions } = TransactionModel.findByUserId(userId, 5, 0);

    // Total views across all properties
    const totalViews = PropertyModel.totalViewsByOwner(userId);

    // Recent listings
    const recentListings = [...allListings]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        price: p.price,
        listingType: p.listing_type,
        city: p.city,
        thumbnail: (p.images && p.images[0]) || null,
        viewsCount: p.views_count,
        createdAt: p.created_at,
      }));

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatar_url,
      },
      subscription: subscription
        ? {
            plan: subscription.plan ? subscription.plan.name : 'Unknown',
            planId: subscription.plan ? subscription.plan.id : null,
            quotaUsed: subscription.quota_used,
            quotaTotal: subscription.plan ? subscription.plan.quota : 0,
            quotaRemaining: subscription.quota_remaining,
            expiresAt: subscription.expires_at,
            status: subscription.status,
          }
        : null,
      listings: listingBreakdown,
      recentListings,
      recentTransactions: recentTransactions.map((t) => ({
        id: t.id,
        amount: t.amount,
        currency: t.currency,
        type: t.type,
        status: t.status,
        createdAt: t.created_at,
      })),
      totalViews,
    };
  },
};

module.exports = DashboardService;
