import { Link, NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';

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

  const handleLogout = () => {
    logout();
    navigate('/');
  };

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
                <NavItem to="/dashboard">Dashboard</NavItem>
              </>
            )}
          </div>

          {/* Auth */}
          <div className="flex items-center gap-3">
            {token ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700 hidden sm:block">
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
