import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { liftHover } from '../motion/variants';
import Spinner from '../shared/Spinner';

/**
 * GoogleSignInButton
 * ------------------
 * Real Google Identity Services (GIS) integration. Loads the GIS script,
 * renders Google's official One Tap / button flow, and on success decodes
 * the returned id_token's payload to extract `email`, `name`, `sub`, and
 * `picture`. Because Google id_tokens do NOT carry a phone number, we
 * follow up with a small modal to collect it before posting to /auth/google.
 *
 * If `VITE_GOOGLE_CLIENT_ID` is not configured, the component falls back
 * to a simulated profile so the auth flow can still be exercised in dev.
 *
 * @param {string}   role     Role to assign to a newly-created Google account.
 * @param {function} onSuccess Optional callback fired after successful sign-in.
 */
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

let gisLoadingPromise = null;
function loadGisScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.google?.accounts?.id) return Promise.resolve(true);
  if (gisLoadingPromise) return gisLoadingPromise;
  gisLoadingPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.body.appendChild(s);
  });
  return gisLoadingPromise;
}

// Decode the JWT id_token payload (NOT verified — backend verifies for real).
function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default function GoogleSignInButton({ role = 'buyer', onSuccess }) {
  const { googleLogin } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [pendingProfile, setPendingProfile] = useState(null); // shows phone modal
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const buttonContainer = useRef(null);

  // ─── Real GIS path ────────────────────────────────────────────────────
  useEffect(() => {
    if (!CLIENT_ID) return; // dev fallback — keep the static button visible

    let cancelled = false;
    loadGisScript()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        if (buttonContainer.current) {
          window.google.accounts.id.renderButton(buttonContainer.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 320,
          });
        }
      })
      .catch(() => {
        /* GIS failed to load — the simulated button below stays usable. */
      });
    return () => { cancelled = true; };
  }, []);

  async function handleCredentialResponse(response) {
    const claims = decodeJwtPayload(response.credential);
    if (!claims) return;
    // Stash the profile and ask for a phone before submitting.
    setPendingProfile({
      idToken: response.credential,
      googleId: claims.sub,
      email: claims.email,
      name: claims.name || claims.email?.split('@')[0] || 'Google User',
      picture: claims.picture || null,
    });
  }

  // ─── Dev fallback — simulated profile when no client_id is configured ─
  const handleSimulatedClick = () => {
    setPendingProfile({
      idToken: 'simulated_google_id_token',
      googleId: `gid_${Date.now()}`,
      email: `google.user.${Date.now()}@gmail.com`,
      name: 'Google User',
      picture: 'https://api.dicebear.com/8.x/initials/svg?seed=Google',
    });
  };

  const submitWithPhone = async () => {
    setPhoneError('');
    // Phone is encouraged but not strictly required (backend allows null).
    if (phoneInput && !/^\+?[0-9\s\-()]{7,20}$/.test(phoneInput)) {
      setPhoneError('Please enter a valid phone number.');
      return;
    }
    setLoading(true);
    const result = await googleLogin({
      ...pendingProfile,
      avatar: pendingProfile.picture,
      phone: phoneInput || undefined,
      role,
    });
    setLoading(false);
    if (result.success) {
      setPendingProfile(null);
      setPhoneInput('');
      if (onSuccess) onSuccess();
    } else {
      setPhoneError(result.error || 'Google sign-in failed.');
    }
  };

  return (
    <>
      {/* Real Google button — rendered into this div by GIS. */}
      {CLIENT_ID ? (
        <div ref={buttonContainer} className="flex justify-center" />
      ) : (
        <motion.button
          type="button"
          onClick={handleSimulatedClick}
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
              <span>Continue with Google (dev mode)</span>
            </>
          )}
        </motion.button>
      )}

      {/* Phone-collection modal — Google id_tokens don't carry a phone, so
          we ask for one as part of the sign-in flow. */}
      <AnimatePresence>
        {pendingProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setPendingProfile(null)}
          >
            <motion.div
              initial={{ y: 20, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 20, scale: 0.96, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                {pendingProfile.picture && (
                  <img src={pendingProfile.picture} alt="" className="w-10 h-10 rounded-full" />
                )}
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{pendingProfile.name}</p>
                  <p className="text-xs text-gray-500">{pendingProfile.email}</p>
                </div>
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                Add your phone number
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                We'll save it to your profile so buyers can reach you. You can
                skip this for now and add it later from your dashboard.
              </p>
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {phoneError && (
                <p className="mt-1 text-xs text-rose-600">{phoneError}</p>
              )}
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setPendingProfile(null)}
                  disabled={loading}
                  className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitWithPhone}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                >
                  {loading ? <Spinner size="sm" className="py-0" /> : (phoneInput ? 'Continue' : 'Skip & continue')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
