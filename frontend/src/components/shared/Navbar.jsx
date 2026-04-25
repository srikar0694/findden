import { Link, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useWishlistStore } from '../../store/wishlistStore';

const navLinkBase =
  'text-sm font-medium transition-colors relative py-1';

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `${navLinkBase} ${
          isActive
            ? 'text-blue-700'
            : 'text-gray-600 hover:text-blue-600'
        }`
      }
    >
      {({ isActive }) => (
        <span className="inline-flex flex-col items-center">
          <span>{children}</span>
          {isActive && (
            <motion.span
              layoutId="nav-underline"
              className="absolute -bottom-1 left-0 right-0 h-[2px] bg-blue-600 rounded-full"
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            />
          )}
        </span>
      )}
    </NavLink>
  );
}

export default function Navbar() {
  const { user, token, logout } = useAuthStore();
  const navigate = useNavigate();

  const wishlistIds = useWishlistStore((s) => s.ids);
  const fetchWishlist = useWishlistStore((s) => s.fetch);
  const wishlistCount = wishlistIds.size;

  // Refresh wishlist on login / token change
  useEffect(() => {
    if (token) fetchWishlist();
  }, [token, fetchWishlist]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const initials = user?.name
    ? user.name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()
    : '👤';

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="bg-white/90 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <motion.div
              whileHover={{ rotate: -6, scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-xl px-3 py-1 rounded-lg shadow-sm"
            >
              FD
            </motion.div>
            <span className="text-xl font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
              FindDen
            </span>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-7">
            <NavItem to="/search">Buy / Rent</NavItem>
            <NavItem to="/pricing">Pricing</NavItem>
            {token && (
              <>
                <NavItem to="/post-property">Post Property</NavItem>
                <NavItem to="/quick-post">⚡ Quick Post</NavItem>
                <NavItem to="/dashboard">Dashboard</NavItem>
                {user?.role === 'admin' && <NavItem to="/admin">Admin</NavItem>}
              </>
            )}
          </div>

          {/* Auth */}
          <div className="flex items-center gap-3">
            {token ? (
              <div className="flex items-center gap-3">
                {/* Wishlist icon — only renders when there are items */}
                <AnimatePresence>
                  {wishlistCount > 0 && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    >
                      <Link
                        to="/wishlist"
                        title={`${wishlistCount} item${wishlistCount === 1 ? '' : 's'} in your wishlist`}
                        className="relative inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-rose-50 transition-colors"
                      >
                        <span className="text-rose-500 text-xl leading-none">♥</span>
                        <motion.span
                          key={wishlistCount}
                          initial={{ scale: 0.5 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                          className="absolute -top-0.5 -right-0.5 bg-rose-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-sm"
                        >
                          {wishlistCount > 99 ? '99+' : wishlistCount}
                        </motion.span>
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Profile avatar */}
                <Link
                  to="/dashboard"
                  title={user?.name || 'My account'}
                  className="hidden sm:flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold shadow-sm hover:shadow-md transition-shadow"
                >
                  {initials}
                </Link>

                <span className="text-sm text-gray-700 hidden lg:block">
                  Hi, {user?.name?.split(' ')[0]}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-600 hover:text-red-600 transition-colors"
                >
                  Logout
                </button>
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                  <Link
                    to="/post-property"
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
                  >
                    + Post Property
                  </Link>
                </motion.div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="text-sm text-gray-700 hover:text-blue-600 font-medium transition-colors"
                >
                  Login
                </Link>
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                  <Link
                    to="/register"
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
                  >
                    Register
                  </Link>
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
