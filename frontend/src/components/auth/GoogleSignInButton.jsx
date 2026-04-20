import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { liftHover } from '../motion/variants';
import Spinner from '../shared/Spinner';

/**
 * GoogleSignInButton
 * ------------------
 * In production this should be wired to Google Identity Services
 * (window.google.accounts.id.prompt). For now it simulates a Google sign-in
 * payload so the auth flow can be exercised end-to-end against /auth/google.
 *
 * @param {string}   role     Role to assign to a newly-created Google account.
 * @param {function} onSuccess Optional callback fired after successful sign-in.
 */
export default function GoogleSignInButton({ role = 'buyer', onSuccess }) {
  const { googleLogin } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    // ───────────────────────────────────────────────────────────────
    // Simulated Google profile. Replace with real GIS response in prod.
    //   window.google.accounts.id.initialize({ client_id, callback: ... })
    //   The `callback` receives `{ credential }` (JWT id_token); decode it
    //   on the backend with google-auth-library to get `email`, `sub`, etc.
    // ───────────────────────────────────────────────────────────────
    const simulatedProfile = {
      idToken: 'simulated_google_id_token',
      googleId: `gid_${Date.now()}`,
      email: `google.user.${Date.now()}@gmail.com`,
      name: 'Google User',
      avatar: 'https://api.dicebear.com/8.x/initials/svg?seed=Google',
      role,
    };

    const result = await googleLogin(simulatedProfile);
    setLoading(false);
    if (result.success && onSuccess) onSuccess();
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={loading}
      variants={liftHover}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      className="w-full flex items-center justify-center gap-3 border border-gray-300 bg-white text-gray-700 py-2.5 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors disabled:opacity-60"
    >
      {loading ? (
        <Spinner size="sm" className="py-0" />
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.5-5.9 7.7-11.3 7.7-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.3 5.7 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.8 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.3 6.7 29.4 5 24 5c-7.4 0-13.7 4.4-16.7 10.7z" />
            <path fill="#4CAF50" d="M24 44c5.3 0 10.1-1.8 13.7-4.8l-6.3-5.3c-2 1.4-4.6 2.2-7.4 2.2-5.4 0-9.9-3.4-11.6-8L6 32.6C9 39.4 15.9 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 2-2.1 3.7-3.9 4.9l6.3 5.3C40.9 35.3 44 30 44 24c0-1.2-.1-2.4-.4-3.5z" />
          </svg>
          <span>Continue with Google</span>
        </>
      )}
    </motion.button>
  );
}
