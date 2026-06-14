import { useRef, useState } from 'react';
import { uploadsService } from '../../services/uploads.service';

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api')
  .replace(/\/api\/?$/, '');

const MAX_IMAGE_MB = 25;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

/**
 * Resolve any stored image reference to a displayable URL.
 *
 * Handles:
 *  • https://...       R2 / external CDN URL          → pass-through
 *  • http://...        local dev URL                  → pass-through
 *  • /uploads/...      legacy local-disk path         → prepend API origin
 *  • blob:...          local object URL preview       → pass-through
 *  • data:image/...    inline base64                  → pass-through
 */
function resolveImageUrl(ref) {
  if (!ref || typeof ref !== 'string') return '';
  if (/^https?:\/\//.test(ref)) return ref;
  if (ref.startsWith('/uploads/')) return `${API_ORIGIN}${ref}`;
  if (ref.startsWith('blob:') || ref.startsWith('data:')) return ref;
  return ref;
}

/**
 * ImageUploader
 *
 * Shows a local blob preview immediately on file pick, uploads in the
 * background, then swaps each blob URL for the final server URL.
 *
 * Props
 *   value     {string[]}        current list of image URLs
 *   onChange  (string[]) => void
 *   max       {number}          maximum images (default 10)
 */
export default function ImageUploader({ value = [], onChange, max = 10 }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const remaining = Math.max(0, max - value.length);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setError('');

    const accepted = Array.from(files).filter((f) =>
      /^image\/(png|jpe?g|webp)$/i.test(f.type)
    );
    if (accepted.length === 0) {
      setError('Please choose PNG, JPG, or WebP images.');
      return;
    }

    // Client-side size check — immediate feedback before any network call.
    const oversized = accepted.filter((f) => f.size > MAX_IMAGE_BYTES);
    if (oversized.length > 0) {
      setError(
        `${oversized.map((f) => f.name).join(', ')} exceed${oversized.length === 1 ? 's' : ''} the ${MAX_IMAGE_MB} MB limit.`
      );
      return;
    }

    if (accepted.length > remaining) {
      setError(
        `You can add ${remaining} more image${remaining === 1 ? '' : 's'} (max ${max}).`
      );
      return;
    }

    // Create blob preview URLs immediately — user sees images right away.
    const blobUrls = accepted.map((f) => URL.createObjectURL(f));

    // Snapshot current value + append blobs. We use this as the base for
    // the later swap so we don't rely on a functional update in onChange
    // (the parent may not support updater functions).
    const optimistic = [...value, ...blobUrls];
    onChange(optimistic);

    setUploading(true);
    try {
      const res = await uploadsService.uploadPropertyImages(accepted);
      const serverUrls = res.data?.urls ?? [];

      // Swap each blob placeholder for its final server URL in place.
      const final = optimistic.map((url) => {
        const i = blobUrls.indexOf(url);
        return i !== -1 ? (serverUrls[i] ?? url) : url;
      });
      onChange(final);
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
      // Roll back — remove the blob placeholders.
      onChange(optimistic.filter((u) => !blobUrls.includes(u)));
    } finally {
      // Revoke blob objects regardless of outcome.
      blobUrls.forEach((b) => URL.revokeObjectURL(b));
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeAt = (i) => {
    const url = value[i];
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    const next = [...value];
    next.splice(i, 1);
    onChange(next);
  };

  const moveLeft = (i) => {
    if (i === 0) return;
    const next = [...value];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Property Images
        <span className="text-xs text-gray-400 font-normal ml-2">
          ({value.length}/{max})
        </span>
      </label>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg px-4 py-6 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 bg-gray-50'
        } ${remaining === 0 ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <p className="text-sm text-gray-600">
          {uploading
            ? 'Uploading…'
            : remaining === 0
            ? `Maximum ${max} images reached`
            : 'Drag images here, or click to choose'}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          PNG, JPG, or WebP · up to {MAX_IMAGE_MB} MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {/* Image grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
          {value.map((url, i) => {
            const isPending = url?.startsWith('blob:');
            return (
              <div
                key={`${url}-${i}`}
                className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-[4/3] bg-gray-100"
              >
                <img
                  src={resolveImageUrl(url)}
                  alt={`Property ${i + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />

                {/* Spinner while blob is still being uploaded */}
                {isPending && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                    <svg
                      className="animate-spin h-5 w-5 text-blue-600"
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
                  </div>
                )}

                {/* Hover controls */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-between p-1.5 opacity-0 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); moveLeft(i); }}
                    disabled={i === 0}
                    title="Move earlier"
                    className="bg-white/90 text-gray-700 rounded px-1.5 py-0.5 text-xs font-medium disabled:opacity-40"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeAt(i); }}
                    title="Remove"
                    className="bg-red-600/95 text-white rounded px-1.5 py-0.5 text-xs font-medium"
                  >
                    ✕
                  </button>
                </div>

                {i === 0 && (
                  <span className="absolute top-1 left-1 bg-blue-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                    Cover
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { resolveImageUrl };
