import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../services/admin.service';
import { resolveImageUrl } from '../components/property/ImageUploader';
import { formatCurrency, formatRent } from '../utils/formatCurrency';
import { formatDate } from '../utils/formatDate';
import Spinner from '../components/shared/Spinner';

/**
 * AdminDashboardPage
 * ------------------
 * Implements CR §5 (Admin Dashboard).
 *
 *  - Lists every property in the system, paginated.
 *  - Filters: verified status, price range, city, free-text search across
 *    owner name / phone / email.
 *  - Verify/Unverify action per row (POST /properties/:id/verify, admin only).
 *  - Aggregate stat cards across the top.
 *
 * Route is guarded by <AdminRoute> in App.jsx.
 */

const PAGE_SIZE = 20;

const initialFilters = {
  verified: 'all',      // 'all' | 'true' | 'false'
  isQuickPost: 'all',
  minPrice: '',
  maxPrice: '',
  city: '',
  q: '',
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [properties, setProperties] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [verifyingId, setVerifyingId] = useState(null);

  // Debounce filter changes — avoid hammering the server while the user types.
  const debounceRef = useRef(null);

  const queryParams = useMemo(() => {
    const p = { page, limit: PAGE_SIZE };
    if (filters.verified !== 'all') p.verified = filters.verified;
    if (filters.isQuickPost !== 'all') p.isQuickPost = filters.isQuickPost;
    if (filters.minPrice) p.minPrice = filters.minPrice;
    if (filters.maxPrice) p.maxPrice = filters.maxPrice;
    if (filters.city.trim()) p.city = filters.city.trim();
    if (filters.q.trim()) p.q = filters.q.trim();
    return p;
  }, [filters, page]);

  useEffect(() => {
    adminService.stats()
      .then((res) => setStats(res?.data || null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setError('');
      adminService.listProperties(queryParams)
        .then((res) => {
          setProperties(res?.data || []);
          setMeta(res?.meta || { total: 0, page: 1 });
        })
        .catch((err) => {
          setError(err.message || 'Failed to load properties');
          setProperties([]);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [queryParams]);

  const updateFilter = (key, val) => {
    setFilters((f) => ({ ...f, [key]: val }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setPage(1);
  };

  const handleToggleVerify = async (prop) => {
    const next = !prop.verified;
    if (next === false) {
      const ok = window.confirm(`Revoke verification for "${prop.title}"?`);
      if (!ok) return;
    }
    setVerifyingId(prop.id);
    try {
      await adminService.setVerified(prop.id, next);
      setProperties((rows) =>
        rows.map((r) => (r.id === prop.id ? { ...r, verified: next, verifiedAt: next ? new Date().toISOString() : null } : r))
      );
      // Refresh stats opportunistically.
      adminService.stats().then((res) => setStats(res?.data || null)).catch(() => {});
    } catch (err) {
      alert(err.message || 'Could not update verification');
    } finally {
      setVerifyingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / PAGE_SIZE));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Manage every property on FindDen. Verify, filter, and audit.
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <StatCard label="Total" value={stats.total} color="gray" />
          <StatCard label="Verified" value={stats.verified} color="blue" />
          <StatCard label="Unverified" value={stats.unverified} color="amber" />
          <StatCard label="Quick Posts" value={stats.quickPosts} color="orange" />
          <StatCard label="Active" value={stats.active} color="green" />
          <StatCard label="Sold/Rented" value={stats.sold} color="purple" />
          <StatCard label="Users" value={stats.totalUsers} color="indigo" />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <FilterField label="Verified status">
            <select
              value={filters.verified}
              onChange={(e) => updateFilter('verified', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="all">All</option>
              <option value="true">Verified only</option>
              <option value="false">Unverified only</option>
            </select>
          </FilterField>

          <FilterField label="Quick post">
            <select
              value={filters.isQuickPost}
              onChange={(e) => updateFilter('isQuickPost', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="all">All</option>
              <option value="true">Quick posts</option>
              <option value="false">Full posts</option>
            </select>
          </FilterField>

          <FilterField label="City">
            <input
              type="text"
              value={filters.city}
              onChange={(e) => updateFilter('city', e.target.value)}
              placeholder="e.g. Bangalore"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </FilterField>

          <FilterField label="Owner / Phone / Email">
            <input
              type="search"
              value={filters.q}
              onChange={(e) => updateFilter('q', e.target.value)}
              placeholder="Search by owner contact"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </FilterField>

          <FilterField label="Min Price (₹)">
            <input
              type="number"
              value={filters.minPrice}
              onChange={(e) => updateFilter('minPrice', e.target.value)}
              placeholder="0"
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </FilterField>

          <FilterField label="Max Price (₹)">
            <input
              type="number"
              value={filters.maxPrice}
              onChange={(e) => updateFilter('maxPrice', e.target.value)}
              placeholder="No limit"
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </FilterField>

          <div className="lg:col-span-2 flex items-end justify-end gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-xs text-gray-500 flex justify-between items-center">
          <span>
            {meta.total || 0} {meta.total === 1 ? 'property' : 'properties'} · page {page} of {totalPages}
          </span>
          {loading && <span className="text-blue-600">Loading…</span>}
        </div>

        {error && (
          <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-100">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Property</th>
                <th className="text-left px-4 py-3">Owner</th>
                <th className="text-right px-4 py-3">Price</th>
                <th className="text-left px-4 py-3">City</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-center px-4 py-3">Verified</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {properties.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 py-12">
                    No properties match these filters.
                  </td>
                </tr>
              )}
              {properties.map((p) => (
                <tr key={p.id} className="hover:bg-blue-50/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={resolveImageUrl(p.thumbnail)}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover bg-gray-100 flex-shrink-0"
                        onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=200'; }}
                      />
                      <div className="min-w-0">
                        <Link
                          to={`/property/${p.id}`}
                          className="font-medium text-gray-900 hover:text-blue-600 line-clamp-1"
                        >
                          {p.title}
                        </Link>
                        <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                          <span className="capitalize">{p.propertyType}</span>
                          <span>·</span>
                          <span className="capitalize">For {p.listingType}</span>
                          {p.bhk && <><span>·</span><span>{p.bhk} BHK</span></>}
                          {p.isQuickPost && (
                            <span className="ml-1 inline-flex items-center text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full font-medium">
                              ⚡ Quick
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{p.owner?.name || p.contact?.name || '—'}</div>
                    <div className="text-[11px] text-gray-500">
                      {p.contact?.phone || p.owner?.phone || '—'}
                    </div>
                    <div className="text-[11px] text-gray-400 truncate max-w-[180px]">
                      {p.contact?.email || p.owner?.email || ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-700 whitespace-nowrap">
                    {p.listingType === 'rent' ? formatRent(p.price) : formatCurrency(p.price)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{p.city}, {p.state}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${
                      p.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : p.status === 'paused'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.verified ? (
                      <span title={p.verifiedAt ? `Verified ${formatDate(p.verifiedAt)}` : 'Verified'} className="inline-flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-semibold">
                        <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-blue-600 text-white text-[8px] font-bold">✓</span>
                        Verified
                      </span>
                    ) : (
                      <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleToggleVerify(p)}
                      disabled={verifyingId === p.id}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 ${
                        p.verified
                          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {verifyingId === p.id ? <Spinner size="sm" className="py-0" /> : (p.verified ? 'Unverify' : 'Verify')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-gray-100 bg-gray-50">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((n) => Math.max(1, n - 1))}
              className="text-xs border border-gray-300 px-3 py-1.5 rounded-md disabled:opacity-50 hover:bg-white"
            >
              ← Previous
            </button>
            <span className="text-xs text-gray-500">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((n) => Math.min(totalPages, n + 1))}
              className="text-xs border border-gray-300 px-3 py-1.5 rounded-md disabled:opacity-50 hover:bg-white"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'gray' }) {
  const colors = {
    gray: 'bg-gray-50 text-gray-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    orange: 'bg-orange-50 text-orange-700',
    green: 'bg-green-50 text-green-700',
    purple: 'bg-purple-50 text-purple-700',
    indigo: 'bg-indigo-50 text-indigo-700',
  };
  return (
    <div className={`rounded-lg p-3 border border-transparent ${colors[color]}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="text-xl font-bold mt-0.5">{value ?? '—'}</div>
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <label className="block">
      <div className="text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">{label}</div>
      {children}
    </label>
  );
}
