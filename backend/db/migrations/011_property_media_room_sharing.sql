-- 011_property_media_room_sharing.sql
-- Change Request — adds optional video URL and PG room_sharing.
--   • video_url     — single optional video for the listing (≤300 MB enforced at upload).
--   • room_sharing  — only used by `pg` properties (e.g. 'single', 'double', 'triple', 'shared').

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS video_url    TEXT,
  ADD COLUMN IF NOT EXISTS room_sharing VARCHAR(20);
