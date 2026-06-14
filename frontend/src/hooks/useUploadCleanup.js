import { useEffect, useRef } from 'react';
import { uploadsService } from '../services/uploads.service';

/**
 * useUploadCleanup
 * ----------------
 * Tracks R2 URLs uploaded during a post/edit session and deletes them
 * from Cloudflare R2 when they are no longer needed:
 *
 *   1. Immediately when the user removes an image/video from the form.
 *   2. On page unmount (navigate away / browser close) if the form was
 *      never successfully submitted.
 *
 * Usage:
 *   const { markSubmitted } = useUploadCleanup(form.images, form.video_url);
 *   // Call markSubmitted() right before/after a successful form submit
 *   // so the cleanup effect knows NOT to delete anything on unmount.
 *
 * @param {string[]} images    - current value of form.images
 * @param {string}   videoUrl  - current value of form.video_url
 */
export function useUploadCleanup(images, videoUrl) {
  // Whether the form was successfully submitted — prevents cleanup on unmount.
  const submittedRef = useRef(false);

  // Always-current snapshots used inside the unmount cleanup (avoids stale closure).
  const imagesRef  = useRef(images);
  const videoRef   = useRef(videoUrl);
  useEffect(() => { imagesRef.current = images; },  [images]);
  useEffect(() => { videoRef.current  = videoUrl; }, [videoUrl]);

  // ── Detect removed images and delete them from R2 immediately ─────────────
  const prevImagesRef = useRef(images);
  useEffect(() => {
    const prev = prevImagesRef.current;
    const curr = images;
    prevImagesRef.current = curr;

    const removed = prev.filter(
      (url) => url && /^https?:\/\//.test(url) && !curr.includes(url)
    );
    if (removed.length > 0) uploadsService.deleteUploads(removed);
  }, [images]);

  // ── Detect removed video and delete it from R2 immediately ────────────────
  const prevVideoRef = useRef(videoUrl);
  useEffect(() => {
    const prev = prevVideoRef.current;
    const curr = videoUrl;
    prevVideoRef.current = curr;

    if (prev && /^https?:\/\//.test(prev) && prev !== curr) {
      uploadsService.deleteUploads([prev]);
    }
  }, [videoUrl]);

  // ── On unmount: delete everything still in form if not submitted ──────────
  useEffect(() => {
    return () => {
      if (submittedRef.current) return;

      const toDelete = [
        ...imagesRef.current.filter((u) => u && /^https?:\/\//.test(u)),
        ...(videoRef.current && /^https?:\/\//.test(videoRef.current)
          ? [videoRef.current]
          : []),
      ];
      if (toDelete.length > 0) {
        // Best-effort — fire and forget (page is unmounting).
        uploadsService.deleteUploads(toDelete);
      }
    };
  }, []); // intentionally empty — runs only on unmount

  return {
    /** Call this on successful form submission to prevent cleanup on unmount. */
    markSubmitted: () => { submittedRef.current = true; },
  };
}
