import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import Spinner from '../components/shared/Spinner';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import { FadeIn, SlideUp, Stagger, Hover } from '../components/motion';

/**
 * LoginPage
 * ---------
 * Updated logic: a single `identifier` field accepts EITHER an email OR a
 * phone number; the backend resolves the right account.
 * Also exposes Google sign-in.
 */
export default function LoginPage() {
  const [form, setForm] = useState({ identifier: '', password: '' });
  const { login, loading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(form);
    if (result.success) navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4">
      <FadeIn whileInView={false} className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white rounded-2xl shadow-xl shadow-blue-100/40 border border-gray-100 w-full p-8"
        >
          <SlideUp whileInView={false} className="text-center mb-7">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-2xl w-12 h-12 flex items-center justify-center rounded-xl mx-auto mb-3 shadow-lg shadow-blue-200">
              FD
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-gray-500 text-sm mt-1">Sign in with email or phone</p>
          </SlideUp>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700"
            >
              {error}
            </motion.div>
          )}

          <GoogleSignInButton onSuccess={() => navigate('/dashboard')} />

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">or sign in</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit}>
            <Stagger as="div" className="space-y-4" stagger={0.06} whileInView={false}>
              <Stagger.Item>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email or Phone
                </label>
                <input
                  type="text"
                  value={form.identifier}
                  onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                  placeholder="you@example.com  or  +91 9876543210"
                  required
                  autoComplete="username"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Stagger.Item>

              <Stagger.Item>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Stagger.Item>

              <Stagger.Item>
                <Hover preset="lift">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 rounded-lg font-semibold text-sm shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300 transition-shadow disabled:opacity-60"
                  >
                    {loading ? <Spinner size="sm" className="py-0" /> : 'Sign In'}
                  </button>
                </Hover>
              </Stagger.Item>
            </Stagger>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don&rsquo;t have an account?{' '}
            <Link to="/register" className="text-blue-600 font-medium hover:underline">Register</Link>
          </p>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
            <strong>Demo accounts</strong> (password: <code>password123</code>):<br />
            Admin: admin@findden.in<br />
            Agent: priya@findden.in &nbsp;or&nbsp; +919876543210<br />
            Buyer: rahul@gmail.com &nbsp;or&nbsp; +919123456789
          </div>
        </motion.div>
      </FadeIn>
    </div>
  );
}
