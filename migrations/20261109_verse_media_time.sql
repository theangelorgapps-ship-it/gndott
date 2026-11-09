-- Highlights and saved verses can remember where the video was playing
-- when the viewer marked the passage. Seconds into playback; NULL when the
-- mark came from a standalone Bible reader with no media attached.
ALTER TABLE library_verses ADD COLUMN media_time REAL;
