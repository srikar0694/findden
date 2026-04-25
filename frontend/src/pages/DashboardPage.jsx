import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardService } from '../services/dashboard.service';
import { messagesService } from '../services/messages.service';
import { formatCurrency, formatRent } from '../utils/formatCurrency';
import { formatDate, timeAgo } from '../utils/formatDate';
import Spinner from '../components/shared/Spinner';
import { resolveImageUrl } from '../components/property/ImageUploader';
import MessageOwnerButton from '../components/property/MessageOwnerButton';
import { useWishlistStore } from '../store/wishlistStore';

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  draft: 'bg-gray-100 text-gray-600',
  expired: 'bg-red-100 text-red-600',
  sold: 'bg-blue-100 text-blue-700',
  rented: 'bg-purple-100 text-purple-700',
};

const TXN_STATUS_COLORS = {
  success: 'text-green-600',
  pending: 'text-yellow-600',
  failed: 'text-red-600',
  refunded: 'text-gray-500',
};

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    dashboardService.getSummary()
      .then((res) => { setData(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center items-center h-96"><Spinner size="lg" /></div>;
  if (!data) return <div className="text-center py-20 text-gray-500">Failed to load dashboard.</div>;

  const { user, subscription, listings, recentListings, recentTransactions, totalViews } = data;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Welcome back, {user.name} 👋</p>
        </div>
        <Link
          to="/post-property"
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          + Post Property
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {['overview', 'listings', 'favorites', 'contacted', 'transactions'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard label="Active Listings" value={listings.active} icon="🏠" color="blue" />
            <KpiCard label="Total Views" value={totalViews?.toLocaleString()} icon="👁" color="purple" />
            <KpiCard label="Quota Used" value={subscription ? `${subscription.quotaUsed}/${subscription.quotaTotal}` : '—'} icon="📊" color="amber" />
            <KpiCard label="Total Listings" value={listings.total} icon="📋" color="green" />
          </div>

          {/* Subscription status */}
          {subscription ? (
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-blue-100 text-sm font-medium">{subscription.plan} Plan</p>
                  <p className="text-2xl font-bold mt-1">{subscription.quotaRemaining} listings left</p>
                  <p className="text-blue-100 text-sm mt-1">
                    Expires {formatDate(subscription.expiresAt)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm font-medium">
                    {subscription.status}
                  </div>
                  <Link to="/pricing" className="block mt-2 text-xs text-blue-100 underline hover:text-white">
                    Upgrade plan →
                  </Link>
                </div>
              </div>
              {/* Quota bar */}
              <div className="mt-4 bg-white/20 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-white h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (subscription.quotaUsed / subscription.quotaTotal) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-blue-100 mt-1">{subscription.quotaUsed} of {subscription.quotaTotal} used</p>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
              <p className="text-gray-600 font-medium mb-3">No active subscription</p>
              <p className="text-gray-400 text-sm mb-4">Subscribe to post multiple listings at a lower cost per listing.</p>
              <Link
                to="/pricing"
                className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                View Plans
              </Link>
            </div>
          )}

          {/* Recent listings */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Listings</h2>
            <div className="space-y-2">
              {recentListings.length === 0 ? (
                <p className="text-gray-400 text-sm py-4 text-center">No listings yet. <Link to="/post-property" className="text-blue-600 underline">Post your first property</Link></p>
              ) : recentListings.map((l) => (
                <Link
                  key={l.id}
                  to={`/property/${l.id}`}
                  className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 transition-colors"
                >
                  {l.thumbnail && (
                    <img src={l.thumbnail} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{l.title}</p>
                    <p className="text-xs text-gray-500">{l.city} · {timeAgo(l.createdAt)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-600'}`}>
                      {l.status}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">👁 {l.viewsCount}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'listings' && (
        <ListingsTab />
      )}

      {activeTab === 'favorites' && (
        <FavoritesTab />
      )}

      {activeTab === 'contacted' && (
        <ContactedTab />
      )}

      {activeTab === 'transactions' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Transaction History</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentTransactions.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-400">No transactions yet</td></tr>
                ) : recentTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 capitalize">{t.type?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 font-semibold">₹{t.amount?.toLocaleString()}</td>
                    <td className={`px-4 py-3 font-medium capitalize ${TXN_STATUS_COLORS[t.status]}`}>{t.status}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className={`inline-flex text-xl p-2 rounded-lg mb-2 ${colors[color]}`}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function ListingsTab() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('../services/properties.service').then(({ propertiesService }) => {
      propertiesService.getMyListings({}).then((res) => {
        setListings(res.data);
        setLoading(false);
      });
    });
  }, []);

  if (loading) return <Spinner className="py-8" />;
  if (listings.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-4xl mb-3">🏠</p>
        <p className="font-medium">No listings yet</p>
        <Link to="/post-property" className="text-blue-600 text-sm underline mt-2 inline-block">Post your first property</Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {listings.map((l) => (
        <div key={l.id} className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl">
          {l.thumbnail && (
            <img src={resolveImageUrl(l.thumbnail)} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <Link to={`/property/${l.id}`} className="font-semibold text-sm text-gray-900 hover:text-blue-600 truncate block">
              {l.title}
              {l.verified && (
                <span title="Verified" className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-600 text-white text-[9px] font-bold align-middle">✓</span>
              )}
            </Link>
            <p className="text-xs text-gray-500 mt-0.5">{l.city}, {l.state}</p>
            <p className="text-sm font-bold text-blue-700 mt-1">
              {l.listingType === 'rent' ? formatRent(l.price) : formatCurrency(l.price)}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-600'}`}>
              {l.status}
            </span>
            <p className="text-xs text-gray-400 mt-1">👁 {l.viewsCount} views</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * FavoritesTab — CR §4.1: shows the buyer's wishlist (favorites).
 */
function FavoritesTab() {
  const fetch = useWishlistStore((s) => s.fetch);
  const items = useWishlistStore((s) => s.items);
  const ids = useWishlistStore((s) => s.ids);
  const toggle = useWishlistStore((s) => s.toggle);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.resolve(fetch()).finally(() => setLoading(false));
  }, [fetch]);

  if (loading) return <Spinner className="py-8" />;
  const list = items && items.length ? items : [];
  if (list.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-4xl mb-3">♡</p>
        <p className="font-medium">No favorites yet</p>
        <Link to="/search" className="text-blue-600 text-sm underline mt-2 inline-block">
          Browse properties
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-end mb-3">
        <h2 className="text-lg font-semibold text-gray-900">Your favorites ({list.length})</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((w) => {
          const p = w.property || {};
          const pid = w.propertyId;
          return (
            <div key={w.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
              <Link to={`/property/${pid}`} className="block relative">
                <img
                  src={resolveImageUrl(p.thumbnail || p.images?.[0])}
                  alt={p.title}
                  className="w-full h-36 object-cover bg-gray-100"
                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400'; }}
                />
                {p.verified && (
                  <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-600 text-white shadow">
                    ✓ Verified
                  </span>
                )}
                {p.isQuickPost && (
                  <span className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow">
                    ⚡ Quick
                  </span>
                )}
              </Link>
              <div className="p-3 flex-1 flex flex-col">
                <Link to={`/property/${pid}`} className="font-semibold text-sm text-gray-900 hover:text-blue-600 line-clamp-2">
                  {p.title}
                </Link>
                <p className="text-xs text-gray-500 mt-0.5 truncate">📍 {p.city}, {p.state}</p>
                <p className="text-sm font-bold text-blue-700 mt-1">
                  {p.listingType === 'rent' ? formatRent(p.price) : formatCurrency(p.price)}
                </p>
                <div className="grid grid-cols-2 gap-2 mt-auto pt-3">
                  <button
                    onClick={() => toggle(pid)}
                    className={`text-xs py-1.5 rounded-lg font-medium transition-colors ${
                      ids.has(pid)
                        ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {ids.has(pid) ? '♥ Remove' : '♡ Add back'}
                  </button>
                  <MessageOwnerButton
                    propertyId={pid}
                    propertyTitle={p.title}
                    className="text-xs py-1.5 rounded-lg font-medium border border-blue-600 text-blue-600 hover:bg-blue-50 transition-colors"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ContactedTab — CR §4.2: lists every property the buyer has messaged.
 */
function ContactedTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quota, setQuota] = useState(null);

  useEffect(() => {
    Promise.all([
      messagesService.contacted().then((res) => setItems(res?.data || [])).catch(() => setItems([])),
      messagesService.getQuota().then((res) => setQuota(res?.data || null)).catch(() => setQuota(null)),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner className="py-8" />;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Properties you've contacted</h2>
          {quota && (
            <p className="text-xs text-gray-500 mt-0.5">
              Messages this month:{' '}
              <span className="font-semibold text-gray-700">
                {quota.used}/{quota.limit}
              </span>{' '}
              ({quota.remaining} remaining)
              {quota.plan && quota.plan !== 'free' && (
                <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
                  {quota.plan}
                </span>
              )}
            </p>
          )}
        </div>
        {quota && quota.remaining <= 0 && (
          <Link
            to="/pricing"
            className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            Upgrade for more →
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">💬</p>
          <p className="font-medium">No messages sent yet</p>
          <Link to="/search" className="text-blue-600 text-sm underline mt-2 inline-block">
            Find a property to contact
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((p) => (
            <div key={p.id} className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl">
              <img
                src={resolveImageUrl(p.thumbnail || p.images?.[0])}
                alt=""
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-gray-100"
                onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400'; }}
              />
              <div className="flex-1 min-w-0">
                <Link
                  to={`/property/${p.id}`}
                  className="font-semibold text-sm text-gray-900 hover:text-blue-600 truncate block"
                >
                  {p.title}
                  {p.verified && (
                    <span title="Verified" className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-600 text-white text-[9px] font-bold align-middle">✓</span>
                  )}
                </Link>
                <p className="text-xs text-gray-500 mt-0.5">{p.city}, {p.state}</p>
                {p.lastContactedAt && (
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Last contacted {timeAgo(p.lastContactedAt)}
                  </p>
                )}
                <p className="text-sm font-bold text-blue-700 mt-1">
                  {p.listingType === 'rent' ? formatRent(p.price) : formatCurrency(p.price)}
                </p>
              </div>
              <div className="flex-shrink-0">
                <MessageOwnerButton propertyId={p.id} propertyTitle={p.title} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
