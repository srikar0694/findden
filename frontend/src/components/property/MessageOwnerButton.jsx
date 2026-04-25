import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { messagesService } from '../../services/messages.service';
import Spinner from '../shared/Spinner';

/**
 * <MessageOwnerButton>
 * --------------------
 * Implements CR §4.3 — buyer-to-seller messaging with subscription quota.
 *
 * Behaviour:
 *  - On mount, fetches the buyer's current messaging quota.
 *  - Opens a modal where the buyer can write a message.
 *  - On send, calls POST /messages/property/:id.
 *  - If the API responds with 402 PAYMENT_REQUIRED, the modal is closed and
 *    the buyer is redirected to /pricing (per the change request).
 *  - Otherwise, surfaces a success/error toast via the onResult callback.
 *
 * Props:
 *  - propertyId   : string (required)
 *  - propertyTitle: string (used for placeholder text)
 *  - className    : optional extra classes for the trigger button
 *  - onSent       : optional callback fired after a successful send
 */
export default function MessageOwnerButton({
  propertyId,
  propertyTitle,
  className = '',
  onSent,
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [quota, setQuota] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    messagesService.getQuota()
      .then((res) => setQuota(res?.data || null))
      .catch(() => {});
  }, []);

  const refreshQuota = () => {
    messagesService.getQuota()
      .then((res) => setQuota(res?.data || null))
      .catch(() => {});
  };

  const handleOpen = () => {
    setError('');
    // If we already know the buyer is over quota, jump straight to pricing.
    if (quota && quota.remaining <= 0) {
      navigate('/pricing');
      return;
    }
    setOpen(true);
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    setError('');
    try {
      await messagesService.send(propertyId, text.trim());
      setOpen(false);
      setText('');
      refreshQuota();
      if (onSent) onSent();
    } catch (err) {
      // 402 → redirect to /pricing.
      if (err.status === 402 || err.code === 'PAYMENT_REQUIRED') {
        setOpen(false);
        navigate(err.redirectTo || '/pricing');
        return;
      }
      setError(err.message || 'Could not send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={
          className ||
          'w-full border border-blue-600 text-blue-600 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors'
        }
      >
        💬 Message Owner
        {quota && (
          <span className="ml-2 text-xs text-gray-400 font-normal">
            ({quota.remaining}/{quota.limit} left)
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => !sending && setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 10, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Message the owner</h3>
                  {quota && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      You have <span className="font-semibold text-gray-700">{quota.remaining}</span>{' '}
                      of {quota.limit} messages left this month.
                    </p>
                  )}
                </div>
                <button
                  onClick={() => !sending && setOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Hi, I'm interested in ${propertyTitle || 'this property'}. Could you share more details about availability and visit timings?`}
                rows={5}
                maxLength={2000}
                className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 resize-none"
              />
              <div className="flex justify-between items-center text-[11px] text-gray-400 mt-1">
                <span>The owner will see your name and contact info.</span>
                <span>{text.length}/2000</span>
              </div>

              {error && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setOpen(false)}
                  disabled={sending}
                  className="px-4 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !text.trim()}
                  className="px-5 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {sending ? <Spinner size="sm" className="py-0" /> : 'Send'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
