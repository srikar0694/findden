import { useRef, useState } from 'react';
import { uploadsService } from '../../services/uploads.service';

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api')
  .replace(/\/api\/?$/, '');

function resolveUrl(ref) {
  if (!ref) return '';
  if (/^https?:\/\//.test(ref)) return ref;
  if (ref.startsWith('/uploads/')) return `${API_ORIGIN}${ref}`;
  return ref;
}

const MAX_BYTES = 300 * 1024 * 1024; // CR — 300 MB

/**
 * VideoUploader — optional single video for a property listing.
 * Props: value (string|null), onChange((url|null) => void)
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
      setError(`Video exceeds the 300 MB limit.`);
      return;
    }
    setUploading(true);
    try {
      const res = await uploadsService.uploadPropertyVideo(file);
      onChange(res.data?.url || null);
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Property Video <span className="text-gray-400 font-normal">(optional)</span>
      </label>

      {value ? (
        <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
          <video src={resolveUrl(value)} controls className="w-full max-h-64 bg-black" />
          <div className="flex items-center justify-between p-2">
            <span className="text-xs text-gray-500 truncate">Uploaded</span>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs text-red-600 hover:underline"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg px-4 py-6 text-center cursor-pointer hover:border-blue-400 bg-gray-50 transition-colors"
        >
          <p className="text-sm text-gray-600">
            {uploading ? 'Uploading…' : 'Click to add a video'}
          </p>
          <p className="text-xs text-gray-400 mt-1">MP4, MOV, or WebM · up to 300 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            hidden
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
