import { useRef, useState } from 'react';
import { uploadsService } from '../../services/uploads.service';

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api')
  .replace(/\/api\/?$/, '');

/**
 * Resolve a stored video reference to a displayable URL.
 *
 * Handles:
 *  • https://...       R2 / external CDN URL          → pass-through
 *  • http://...        local dev URL                  → pass-through
 *  • /uploads/...      legacy local-disk path         → prepend API origin
 *  • blob:...          local object URL preview       → pass-through
 */
function resolveVideoUrl(ref) {
  if (!ref || typeof ref !== 'string') return '';
  if (/^https?:\/\//.test(ref)) return ref;
  if (ref.startsWith('/uploads/')) return `${API_ORIGIN}${ref}`;
  if (ref.startsWith('blob:')) return ref;
  return ref;
}

const MAX_BYTES = 300 * 1024 * 1024; // 300 MB

/**
 * VideoUploader
 *
 * Shows a local blob preview immediately on file pick, uploads in the
 * background, then swaps the blob URL for the final server URL.
 * Page never refreshes — all state lives in the parent via onChange.
 *
 * Props
 *   value     {string | null}   current video URL (server or null)
 *   onChange  (string|null) => void
 */
export default function VideoUploader({ value, onChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setError('');

    if (!/^video\//i.test(file.type)) {
      setError('Please choose a video file (MP4, MOV, or WebM).');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Video exceeds the 300 MB limit.');
      return;
    }

    // Show local preview immediately while upload is in flight.
    const blobUrl = URL.createObjectURL(file);
    onChange(blobUrl);
    setUploading(true);

    try {
      const res = await uploadsService.uploadPropertyVideo(file);
      const serverUrl = res.data?.url ?? null;
      // Swap blob for the real server / R2 URL.
      onChange(serverUrl);
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
      // Roll back to no video.
      onChange(null);
    } finally {
      URL.revokeObjectURL(blobUrl);
      setUploading(false);
    }
  };

  const handleRemove = () => {
    if (value?.startsWith('blob:')) URL.revokeObjectURL(value);
    onChange(null);
  };

  const resolvedSrc = resolveVideoUrl(value);
  const isPending = value?.startsWith('blob:');

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Property Video{' '}
        <span className="text-gray-400 font-normal">(optional)</span>
      </label>

      {resolvedSrc ? (
        <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
          {/* Video preview */}
          <div className="relative w-full max-h-64 bg-black flex items-center justify-center">
            <video
              src={resolvedSrc}
              controls={!isPending}
              className="w-full max-h-64 bg-black"
            />
            {/* Spinner overlay while blob is uploading */}
            {isPending && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 gap-2">
                <svg
                  className="animate-spin h-8 w-8 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                <span className="text-white text-xs">Uploading…</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-gray-500 truncate">
              {isPending ? 'Uploading video…' : 'Video uploaded'}
            </span>
            <button
              type="button"
              onClick={handleRemove}
              className="text-xs text-red-600 hover:underline ml-4 shrink-0"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          className={`border-2 border-dashed border-gray-300 rounded-lg px-4 py-6 text-center cursor-pointer hover:border-blue-400 bg-gray-50 transition-colors ${
            uploading ? 'opacity-60 pointer-events-none' : ''
          }`}
        >
          <p className="text-sm text-gray-600">
            {uploading ? 'Uploading…' : 'Click to add a video'}
          </p>
          <p className="text-xs text-gray-400 mt-1">MP4, MOV, or WebM · up to 300 MB</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
