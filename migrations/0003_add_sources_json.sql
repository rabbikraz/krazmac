-- Add sourcesJson column to shiurim table for storing clipped source images
ALTER TABLE shiurim ADD COLUMN sources_json TEXT;
