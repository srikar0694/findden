import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function Navbar() {
  const { user, token, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-blue-600 text-white font-bold text-xl px-3 py-1 rounded-lg">FD</div>
            <span className="text-xl font-bold text-gray-900">FindDen</span>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-gray-600 hover:text-blue-600 text-sm font-medium transition-colors">
              Buy / Rent
            </Link>
            <Link to="/pricing" className="text-gray-600 hover:text-blue-600 text-sm font-medium transition-colors">
              Pricing
            </Link>
            {token && (
              <>
                <Link to="/post-property" className="text-gray-600 hover:text-blue-600 text-sm font-medium transition-colors">
                  Post Property
                </Link>
                <Link to="/dashboard" className="text-gray-600 hover:text-blue-600 text-sm font-medium transition-colors">
                  Dashboard
                </Link>
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
                <Link
                  to="/post-property"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  + Post Property
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="text-sm text-gray-700 hover:text-blue-600 font-medium transition-colors">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
