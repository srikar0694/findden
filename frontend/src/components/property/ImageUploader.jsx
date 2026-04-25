import { useRef, useState } from 'react';
import { uploadsService } from '../../services/uploads.service';

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api')
  .replace(/\/api\/?$/, '');

/**
 * Resolve a stored image reference to a fully-qualified URL.
 * Accepts both external URIs (https://…) and our static /uploads/… paths.
 */
function resolveImageUrl(ref) {
  if (!ref) return '';
  if (/^https?:\/\//.test(ref)) return ref;
  if (ref.startsWith('/uploads/')) return `${API_ORIGIN}${ref}`;
  return ref;
}

/**
 * ImageUploader
 * Drag-drop or pick image files from the device. Uploads to the backend
 * (which decodes base64 and writes to disk) and returns relative URLs that
 * can be embedded straight into the property `images` array.
 *
 * Props
 *   value     {string[]}  — current list of image URLs
 *   onChange  (urls) => void
 *   max       {number}    — maximum images allowed (default 10)
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
    const accepted = Array.from(files).filter((f) => /^image\/(png|jpe?g|webp)$/i.test(f.type));
    if (accepted.length === 0) {
      setError('Please choose PNG, JPG, or WebP images.');
      return;
    }
    if (accepted.length > remaining) {
      setError(`You can add ${remaining} more image${remaining === 1 ? '' : 's'} (max ${max}).`);
      return;
    }
    setUploading(true);
    try {
      const res = await uploadsService.uploadPropertyImages(accepted);
      onChange([...(value || []), ...(res.data?.urls || [])]);
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeAt = (i) => {
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

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg px-4 py-6 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 bg-gray-50'
        } ${remaining === 0 ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <p className="text-sm text-gray-600">
          {uploading
            ? 'Uploading…'
            : remaining === 0
              ? `Maximum ${max} images reached`
              : 'Drag images here, or click to choose'}
        </p>
        <p className="text-xs text-gray-400 mt-1">PNG, JPG, or WebP · up to 5 MB each</p>
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

      {value.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
          {value.map((url, i) => (
            <div key={`${url}-${i}`} className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-[4/3] bg-gray-100">
              <img src={resolveImageUrl(url)} alt={`Property ${i + 1}`} className="w-full h-full object-cover" />
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
                  title="Remove image"
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
          ))}
        </div>
      )}
    </div>
  );
}

export { resolveImageUrl };
