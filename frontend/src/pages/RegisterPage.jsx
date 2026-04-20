import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import Spinner from '../components/shared/Spinner';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import { FadeIn, SlideUp, Stagger, Hover } from '../components/motion';

const ROLES = [
  { value: 'buyer', label: '🏠 Buyer / Tenant', desc: 'Looking for properties' },
  { value: 'agent', label: '🤝 Real Estate Agent', desc: 'List & manage properties' },
  { value: 'owner', label: '🔑 Property Owner', desc: 'Rent or sell your property' },
];

export default function RegisterPage() {
  // Phone is mandatory; email is optional (per updated requirements).
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    role: 'buyer',
  });
  const [localError, setLocalError] = useState('');
  const { register, loading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (!/^\+?[0-9]{10,15}$/.test(form.phone)) {
      setLocalError('Please enter a valid phone number (10–15 digits, optional + prefix).');
      return;
    }
    const payload = {
      ...form,
      email: form.email.trim() || undefined,
    };
    const result = await register(payload);
    if (result.success) navigate('/dashboard');
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 py-10">
      <FadeIn whileInView={false} duration={0.5} className="w-full max-w-md">
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
            <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
            <p className="text-gray-500 text-sm mt-1">Join thousands of property seekers on FindDen</p>
          </SlideUp>

          {displayError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700"
            >
              {displayError}
            </motion.div>
          )}

          {/* Google Sign-Up */}
          <GoogleSignInButton role={form.role} onSuccess={() => navigate('/dashboard')} />

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">or sign up with phone</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit}>
            <Stagger as="div" className="space-y-4" stagger={0.06} whileInView={false}>
              {/* Role */}
              <Stagger.Item>
                <label className="block text-sm font-medium text-gray-700 mb-2">I am a…</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map((role) => (
                    <Hover key={role.value} preset="lift" as="button" className="block">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, role: role.value })}
                        className={`w-full p-3 rounded-xl border-2 text-center text-xs transition-colors ${
                          form.role === role.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-lg mb-1">{role.label.split(' ')[0]}</div>
                        <div className="font-medium">{role.label.split(' ').slice(1).join(' ')}</div>
                      </button>
                    </Hover>
                  ))}
                </div>
              </Stagger.Item>

              <Stagger.Item>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Priya Sharma"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                />
              </Stagger.Item>

              <Stagger.Item>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 9876543210"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">We use this for OTP verification and listing enquiries.</p>
              </Stagger.Item>

              <Stagger.Item>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Stagger.Item>

              <Stagger.Item>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
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
                    {loading ? <Spinner size="sm" className="py-0" /> : 'Create Account'}
                  </button>
                </Hover>
              </Stagger.Item>
            </Stagger>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
          </p>
        </motion.div>
      </FadeIn>
    </div>
  );
}
